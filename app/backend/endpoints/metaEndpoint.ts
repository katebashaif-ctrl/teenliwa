import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getD1Database, getWorkerEnv, toFils } from "../../db/d1";
import { getProductsFromDb } from "../../db/productsDb";
import { verifyAdminAuth } from "../../utils/adminAuth";
import type { MetaCampaign, MetaMarketingApiConfig } from "../../types/store";

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function getMetaAccessToken(context?: any): string {
  return String(getWorkerEnv(context).META_ACCESS_TOKEN || "").trim();
}

function safeMetaConfig(value: Partial<MetaMarketingApiConfig> | null | undefined): MetaMarketingApiConfig {
  const apiVersion = String(value?.apiVersion || "v21.0").trim();
  const cleanId = (candidate: unknown): string =>
    String(candidate || "").trim().slice(0, 100);
  return {
    adAccountId: cleanId(value?.adAccountId),
    accessToken: "",
    pixelId: cleanId(value?.pixelId),
    catalogId: cleanId(value?.catalogId),
    businessManagerId: cleanId(value?.businessManagerId),
    isConnected: false,
    apiVersion: /^v\\d+\\.\\d+$/.test(apiVersion) ? apiVersion : "v21.0",
  };
}

async function readStoredMetaConfig(db: NonNullable<ReturnType<typeof getD1Database>>): Promise<MetaMarketingApiConfig> {
  const row = await db.prepare("SELECT setting_value FROM store_settings WHERE setting_key = 'metaMarketingConfig' LIMIT 1")
    .bind().first<{ setting_value: string }>();
  return safeMetaConfig(parseJson<Partial<MetaMarketingApiConfig>>(row?.setting_value, {}));
}

async function readCampaigns(db: NonNullable<ReturnType<typeof getD1Database>>): Promise<MetaCampaign[]> {
  const { results } = await db.prepare("SELECT campaign_json FROM meta_campaigns ORDER BY created_at DESC").bind()
    .all<{ campaign_json: string }>();
  return (results || []).map((row) => parseJson<MetaCampaign>(row.campaign_json, null as any)).filter(Boolean);
}

export async function handleMetaCampaignsLoader({ request, context }: LoaderFunctionArgs) {
  const auth = await verifyAdminAuth(request, context);
  if (!auth.authorized) return Response.json({ success: false, error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const env = getWorkerEnv(context);
  const metaAccessToken = getMetaAccessToken(context);
  const url = new URL(request.url);

  if (url.searchParams.get("action") === "verify_token") {
    if (!metaAccessToken) return Response.json({ success: false, connected: false, error: "Configure META_ACCESS_TOKEN as a Cloudflare Worker secret." }, { status: 503 });
    try {
      const config = await readStoredMetaConfig(getD1Database(context)!);
      const response = await fetch(`https://graph.facebook.com/${encodeURIComponent(config.apiVersion)}/me?access_token=${encodeURIComponent(metaAccessToken)}`);
      const data = await response.json() as { id?: string; name?: string; error?: unknown };
      return Response.json({ success: response.ok && !data.error, metaAccount: data, connected: response.ok && !data.error }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to verify Meta token" }, { status: 503 });
    }
  }

  const db = getD1Database(context);
  if (!db) return Response.json({ success: false, error: "CMS database is unavailable" }, { status: 503 });
  try {
    const [storedConfig, storedCampaigns] = await Promise.all([readStoredMetaConfig(db), readCampaigns(db)]);
    const config = { ...storedConfig, accessToken: "", isConnected: Boolean(metaAccessToken && storedConfig.adAccountId) };
    const totalSpent = storedCampaigns.reduce((sum, campaign) => sum + (campaign.spentAED || 0), 0);
    const totalImpressions = storedCampaigns.reduce((sum, campaign) => sum + (campaign.impressions || 0), 0);
    const totalClicks = storedCampaigns.reduce((sum, campaign) => sum + (campaign.clicks || 0), 0);
    const totalLeads = storedCampaigns.reduce((sum, campaign) => sum + (campaign.leadsCount || 0), 0);
    const totalConversions = storedCampaigns.reduce((sum, campaign) => sum + (campaign.conversions || 0), 0);
    return Response.json({
      success: true, config, campaigns: storedCampaigns,
      summary: {
        totalSpentAED: totalSpent, totalImpressions, totalClicks, totalLeads, totalConversions,
        averageCTR: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) + "%" : "0%",
        costPerLeadAED: totalLeads > 0 ? (totalSpent / totalLeads).toFixed(2) : "0",
      },
      documentationUrl: "https://developers.facebook.com/documentation/ads-commerce/marketing-api",
      apiVersion: config.apiVersion,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Meta campaign read failed:", error);
    return Response.json({ success: false, error: "Could not load Meta CMS data" }, { status: 503 });
  }
}

export async function handleMetaCampaignsAction({ request, context }: ActionFunctionArgs) {
  const auth = await verifyAdminAuth(request, context);
  if (!auth.authorized) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const db = getD1Database(context);
  if (!db) return Response.json({ success: false, error: "CMS database is unavailable" }, { status: 503 });

  try {
    const body = await request.json() as {
      intent: string;
      config?: Partial<MetaMarketingApiConfig>;
      campaign?: Omit<MetaCampaign, "id" | "spentAED" | "impressions" | "clicks" | "leadsCount" | "conversions" | "createdAt">;
      campaignId?: string;
      status?: "ACTIVE" | "PAUSED" | "ARCHIVED";
      dailyBudget?: number;
    };

    if (body.intent === "update_config" && body.config) {
      const config = safeMetaConfig(body.config);
      await db.prepare(`
        INSERT INTO store_settings (setting_key, setting_value, is_public, updated_at)
        VALUES ('metaMarketingConfig', ?, 0, CURRENT_TIMESTAMP)
        ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value,
          is_public = 0, updated_at = CURRENT_TIMESTAMP
      `).bind(JSON.stringify(config)).run();
      return Response.json({ success: true, message: "Meta settings saved. Configure META_ACCESS_TOKEN as a Worker secret.", config });
    }

    if (body.intent === "create_campaign" && body.campaign) {
      const campaignInput = body.campaign;
      const objectives = ["OUTCOME_SALES", "OUTCOME_LEADS", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS"];
      const categories = ["all", "rutab", "fig", "faqa", "boxes", "dates", "nuts", "truffle", "fruits"];
      const callsToAction = ["SHOP_NOW", "ORDER_NOW", "GET_QUOTE", "WHATSAPP_MESSAGE"];
      const name = String(campaignInput.name || "").trim();
      const dailyBudget = Number(campaignInput.dailyBudget);
      if (!name || name.length > 160 ||
          !Number.isFinite(dailyBudget) || dailyBudget < 0 ||
          !objectives.includes(String(campaignInput.objective)) ||
          !categories.includes(String(campaignInput.productCategory)) ||
          !callsToAction.includes(String(campaignInput.callToAction))) {
        return Response.json({
          success: false,
          error: "Campaign name, objective, category, call-to-action and non-negative AED budget must be valid",
        }, { status: 400 });
      }

      const headline = String(campaignInput.headline || "").trim();
      const primaryText = String(campaignInput.primaryText || "").trim();
      if (!headline || headline.length > 255 || !primaryText || primaryText.length > 2000) {
        return Response.json({ success: false, error: "Campaign headline and primary text are required and must fit their limits" }, { status: 400 });
      }

      const normalizeList = (value: unknown, maxItems: number, maxLength: number): string[] => {
        if (!Array.isArray(value)) return [];
        return value
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim().slice(0, maxLength))
          .filter(Boolean)
          .slice(0, maxItems);
      };
      const campaign: MetaCampaign = {
        name,
        objective: campaignInput.objective,
        status: "PAUSED",
        dailyBudget,
        spentAED: 0,
        impressions: 0,
        clicks: 0,
        leadsCount: 0,
        conversions: 0,
        targetEmirates: normalizeList(campaignInput.targetEmirates, 8, 80),
        targetInterests: normalizeList(campaignInput.targetInterests, 30, 120),
        productCategory: campaignInput.productCategory,
        headline,
        primaryText,
        callToAction: campaignInput.callToAction,
        imageUrl: String(campaignInput.imageUrl || "").trim().slice(0, 1000),
        leadFormName: campaignInput.leadFormName ? String(campaignInput.leadFormName).trim().slice(0, 160) : undefined,
        id: "camp-meta-" + crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      await db.prepare(`
        INSERT INTO meta_campaigns (campaign_id, name, status, daily_budget_fils, campaign_json)
        VALUES (?, ?, ?, ?, ?)
      `).bind(campaign.id, campaign.name, campaign.status, toFils(dailyBudget), JSON.stringify(campaign)).run();
      return Response.json({ success: true, message: "Campaign created successfully", campaign });
    }

    if (body.intent === "update_status" && body.campaignId && body.status) {
      if (!["ACTIVE", "PAUSED", "ARCHIVED"].includes(body.status)) return Response.json({ success: false, error: "Invalid campaign status" }, { status: 400 });
      const row = await db.prepare("SELECT campaign_json FROM meta_campaigns WHERE campaign_id = ? LIMIT 1")
        .bind(body.campaignId).first<{ campaign_json: string }>();
      if (!row) return Response.json({ success: false, error: "Campaign not found" }, { status: 404 });
      const campaign = { ...parseJson<MetaCampaign>(row.campaign_json, {} as MetaCampaign), status: body.status };
      await db.prepare("UPDATE meta_campaigns SET status = ?, campaign_json = ?, updated_at = CURRENT_TIMESTAMP WHERE campaign_id = ?")
        .bind(body.status, JSON.stringify(campaign), body.campaignId).run();
      return Response.json({ success: true, message: "Campaign status updated" });
    }

    if (body.intent === "update_budget" && body.campaignId && body.dailyBudget !== undefined) {
      if (!Number.isFinite(Number(body.dailyBudget)) || Number(body.dailyBudget) < 0) return Response.json({ success: false, error: "Invalid daily budget" }, { status: 400 });
      const row = await db.prepare("SELECT campaign_json FROM meta_campaigns WHERE campaign_id = ? LIMIT 1")
        .bind(body.campaignId).first<{ campaign_json: string }>();
      if (!row) return Response.json({ success: false, error: "Campaign not found" }, { status: 404 });
      const campaign = { ...parseJson<MetaCampaign>(row.campaign_json, {} as MetaCampaign), dailyBudget: Number(body.dailyBudget) };
      await db.prepare("UPDATE meta_campaigns SET daily_budget_fils = ?, campaign_json = ?, updated_at = CURRENT_TIMESTAMP WHERE campaign_id = ?")
        .bind(toFils(Number(body.dailyBudget)), JSON.stringify(campaign), body.campaignId).run();
      return Response.json({ success: true, message: "Daily budget updated" });
    }

    if (body.intent === "delete_campaign" && body.campaignId) {
      const result: any = await db.prepare("DELETE FROM meta_campaigns WHERE campaign_id = ?").bind(body.campaignId).run();
      const changes = Number(result?.meta?.changes ?? result?.meta?.rows_written ?? 0);
      return changes > 0
        ? Response.json({ success: true, message: "Campaign deleted successfully" })
        : Response.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    return Response.json({ success: false, error: "Invalid campaign intent" }, { status: 400 });
  } catch (error) {
    console.error("Meta CMS write failed:", error);
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Error processing request" }, { status: 503 });
  }
}

export async function handleMetaCatalogFeed({ request, context }: LoaderFunctionArgs) {
  const db = getD1Database(context);
  if (!db) return Response.json({ success: false, error: "Product catalogue is unavailable" }, { status: 503 });
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "xml";
  const baseUrl = `${url.protocol}//${url.host}`;
  try {
    const { products } = await getProductsFromDb(db, false);
    const availableProducts = products.filter((product) => product.inStock && !product.disabled);
    if (format === "csv") {
      const headers = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand", "google_product_category", "custom_label_0"];
      const rows = availableProducts.map((product) => {
        const cleanDescription = (product.description || "").replace(/"/g, '""').replace(/\n/g, " ");
        const cleanName = product.name.replace(/"/g, '""');
        const imageUrl = product.image.startsWith("http") ? product.image : `${baseUrl}${product.image.startsWith("/") ? product.image : "/" + product.image}`;
        const productLink = `${baseUrl}/#prod-${product.id}`;
        const availability = product.inStock ? "in stock" : "out of stock";
        const priceFormatted = Number(product.price).toFixed(2) + " AED";
        return [
          `"${product.id}"`, `"${cleanName}"`, `"${cleanDescription}"`,
          `"${availability}"`, '"new"', `"${priceFormatted}"`,
          `"${productLink}"`, `"${imageUrl}"`, '"Teen Liwa"',
          '"Food, Beverages & Tobacco > Food Items > Fresh Produce"',
          `"${String(product.origin || "Liwa").replace(/"/g, '""')}"`,
        ].join(",");
      });
      const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
      return new Response(csv, { headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="meta_facebook_catalog.csv"',
        "Cache-Control": "no-store",
      }});
    }

    const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    const xmlItems = availableProducts.map((product) => {
      const imageUrl = product.image.startsWith("http") ? product.image : `${baseUrl}${product.image.startsWith("/") ? product.image : "/" + product.image}`;
      const productLink = `${baseUrl}/#prod-${product.id}`;
      return `
    <item>
      <g:id>${escapeXml(product.id)}</g:id>
      <g:title>${escapeXml(product.name)}</g:title>
      <g:description>${escapeXml(product.desc || product.description || product.name)}</g:description>
      <g:link>${escapeXml(productLink)}</g:link>
      <g:image_link>${escapeXml(imageUrl)}</g:image_link>
      <g:brand>Teen Liwa</g:brand>
      <g:condition>new</g:condition>
      <g:availability>in stock</g:availability>
      <g:price>${Number(product.price).toFixed(2)} AED</g:price>
      <g:shipping_country>AE</g:shipping_country>
      <g:shipping_service>Standard Cold Delivery</g:shipping_service>
      <g:shipping_price>0.00 AED</g:shipping_price>
      <g:google_product_category>Food, Beverages &amp; Tobacco &gt; Food Items &gt; Fresh Produce</g:google_product_category>
      <g:custom_label_0>${escapeXml(product.origin || "Liwa")}</g:custom_label_0>
      <g:custom_label_1>${escapeXml(product.tag || "general")}</g:custom_label_1>
    </item>`;
    }).join("");
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>Teen Liwa Product Catalog Feed</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Official product catalog feed for Meta / Facebook Ads and Instagram Shop</description>
${xmlItems}
  </channel>
</rss>`;
    return new Response(rss, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Meta product feed read failed:", error);
    return Response.json({ success: false, error: "Could not read the D1 product catalogue" }, { status: 503 });
  }
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function handleMetaWebhook({ request, context }: ActionFunctionArgs) {
  const secret = String(getWorkerEnv(context).META_APP_SECRET || "").trim();
  if (!secret) return Response.json({ success: false, error: "Meta webhook secret is not configured" }, { status: 503 });
  const rawBody = await request.text();
  const supplied = request.headers.get("X-Hub-Signature-256") || "";
  if (!supplied.startsWith("sha256=")) return Response.json({ success: false, error: "Missing Meta signature" }, { status: 401 });
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const expected = "sha256=" + toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
    if (expected.length !== supplied.length) return Response.json({ success: false, error: "Invalid Meta signature" }, { status: 401 });
    let difference = 0;
    for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
    if (difference !== 0) return Response.json({ success: false, error: "Invalid Meta signature" }, { status: 401 });
    JSON.parse(rawBody);
    return Response.json({ success: true, received: true }, { status: 202 });
  } catch {
    return Response.json({ success: false, error: "Invalid Meta webhook payload or signature" }, { status: 400 });
  }
}
