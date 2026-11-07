import { verifyAdminAuth } from "../../utils/adminAuth";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { INITIAL_META_CAMPAIGNS, INITIAL_META_CONFIG, INITIAL_PRODUCTS } from "../../data/initialData";
import type { MetaCampaign, MetaMarketingApiConfig } from "../../types/store";

let storedConfig: MetaMarketingApiConfig = { ...INITIAL_META_CONFIG };
let storedCampaigns: MetaCampaign[] = [...INITIAL_META_CAMPAIGNS];

export async function handleMetaCampaignsLoader({ request, context }: LoaderFunctionArgs) {
	const auth = await verifyAdminAuth(request, context);
	if (!auth.authorized) return Response.json({ success:false, error:"Unauthorized" }, { status:401, headers: { "Cache-Control":"no-store" } });
	const url = new URL(request.url);
	const actionType = url.searchParams.get("action");

	if (actionType === "verify_token" && storedConfig.accessToken) {
		try {
			const res = await fetch(
				`https://graph.facebook.com/v21.0/me?access_token=${encodeURIComponent(storedConfig.accessToken)}`,
			);
			const data = (await res.json()) as { id?: string; name?: string; error?: unknown };
			return Response.json({
				success: !data.error,
				metaAccount: data,
				connected: !data.error,
			});
		} catch (e) {
			return Response.json({
				success: false,
				error: e instanceof Error ? e.message : "Failed to verify Meta token",
			});
		}
	}

	const totalSpent = storedCampaigns.reduce((sum, c) => sum + (c.spentAED || 0), 0);
	const totalImpressions = storedCampaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
	const totalClicks = storedCampaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
	const totalLeads = storedCampaigns.reduce((sum, c) => sum + (c.leadsCount || 0), 0);
	const totalConversions = storedCampaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);

	return Response.json({
		success: true,
		config: storedConfig,
		campaigns: storedCampaigns,
		summary: {
			totalSpentAED: totalSpent,
			totalImpressions,
			totalClicks,
			totalLeads,
			totalConversions,
			averageCTR: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) + "%" : "0%",
			costPerLeadAED: totalLeads > 0 ? (totalSpent / totalLeads).toFixed(1) : "0",
		},
		documentationUrl: "https://developers.facebook.com/documentation/ads-commerce/marketing-api",
		apiVersion: storedConfig.apiVersion,
	});
}

export async function handleMetaCampaignsAction({ request, context }: ActionFunctionArgs) {
	const auth = await verifyAdminAuth(request, context);
	if (!auth.authorized) return Response.json({ success:false, error:"Unauthorized" }, { status:401 });
	try {
		const body = (await request.json()) as {
			intent: string;
			config?: Partial<MetaMarketingApiConfig>;
			campaign?: Omit<
				MetaCampaign,
				"id" | "spentAED" | "impressions" | "clicks" | "leadsCount" | "conversions" | "createdAt"
			>;
			campaignId?: string;
			status?: "ACTIVE" | "PAUSED";
			dailyBudget?: number;
		};

		if (body.intent === "update_config" && body.config) {
			storedConfig = {
				...storedConfig,
				...body.config,
				isConnected: Boolean(body.config.accessToken && body.config.adAccountId),
			};
			return Response.json({
				success: true,
				message: "Meta Marketing API configuration updated successfully",
				config: storedConfig,
			});
		}

		if (body.intent === "create_campaign" && body.campaign) {
			const newCamp: MetaCampaign = {
				...body.campaign,
				id: `camp-meta-${Date.now().toString(36)}`,
				spentAED: 0,
				impressions: 0,
				clicks: 0,
				leadsCount: 0,
				conversions: 0,
				createdAt: new Date().toISOString(),
			};
			storedCampaigns.unshift(newCamp);
			return Response.json({
				success: true,
				message: "Campaign created successfully",
				campaign: newCamp,
			});
		}

		if (body.intent === "update_status" && body.campaignId && body.status) {
			storedCampaigns = storedCampaigns.map((c) =>
				c.id === body.campaignId ? { ...c, status: body.status! } : c,
			);
			return Response.json({
				success: true,
				message: `Campaign status updated to ${body.status}`,
			});
		}

		if (body.intent === "update_budget" && body.campaignId && body.dailyBudget !== undefined) {
			storedCampaigns = storedCampaigns.map((c) =>
				c.id === body.campaignId ? { ...c, dailyBudget: body.dailyBudget! } : c,
			);
			return Response.json({
				success: true,
				message: `Daily budget updated to ${body.dailyBudget} AED`,
			});
		}

		if (body.intent === "delete_campaign" && body.campaignId) {
			storedCampaigns = storedCampaigns.filter((c) => c.id !== body.campaignId);
			return Response.json({
				success: true,
				message: "Campaign deleted successfully",
			});
		}

		return Response.json(
			{ success: false, error: `Invalid intent: ${body.intent}` },
			{ status: 400 },
		);
	} catch (e) {
		return Response.json(
			{
				success: false,
				error: e instanceof Error ? e.message : "Error processing request",
			},
			{ status: 500 },
		);
	}
}

export async function handleMetaCatalogFeed({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const format = url.searchParams.get("format") || "xml";
	const baseUrl = `${url.protocol}//${url.host}`;
	const products = INITIAL_PRODUCTS;

	if (format === "csv") {
		const headers = [
			"id",
			"title",
			"description",
			"availability",
			"condition",
			"price",
			"link",
			"image_link",
			"brand",
			"google_product_category",
			"custom_label_0",
		];

		const rows = products.map((p) => {
			const cleanDesc = (p.description || "").replace(/"/g, '""').replace(/\n/g, " ");
			const cleanName = p.name.replace(/"/g, '""');
			const imageUrl = p.image.startsWith("http") ? p.image : `${baseUrl}${p.image.startsWith("/") ? p.image : `/${p.image}`}`;
			const productLink = `${baseUrl}/#prod-${p.id}`;
			const avail = p.inStock ? "in stock" : "out of stock";
			const priceFormatted = `${p.price}.00 AED`;

			return [
				`"${p.id}"`,
				`"${cleanName}"`,
				`"${cleanDesc}"`,
				`"${avail}"`,
				`"new"`,
				`"${priceFormatted}"`,
				`"${productLink}"`,
				`"${imageUrl}"`,
				`"Teen Liwa"`,
				`"Food, Beverages & Tobacco > Food Items > Fresh Produce"`,
				`"${(p.origin || "Liwa").replace(/"/g, '""')}"`,
			].join(",");
		});

		const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
		return new Response(csvContent, {
			headers: {
				"Content-Type": "text/csv; charset=utf-8",
				"Content-Disposition": 'attachment; filename="meta_facebook_catalog.csv"',
				"Cache-Control": "max-age=3600, s-maxage=3600",
			},
		});
	}

	const escapeXml = (unsafe: string) => {
		return unsafe
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&apos;");
	};

	const xmlItems = products
		.map((p) => {
			const imageUrl = p.image.startsWith("http") ? p.image : `${baseUrl}${p.image.startsWith("/") ? p.image : `/${p.image}`}`;
			const productLink = `${baseUrl}/#prod-${p.id}`;
			const avail = p.inStock ? "in stock" : "out of stock";

			return `
    <item>
      <g:id>${escapeXml(p.id)}</g:id>
      <g:title>${escapeXml(p.name)}</g:title>
      <g:description>${escapeXml(p.desc || p.description || p.name)}</g:description>
      <g:link>${escapeXml(productLink)}</g:link>
      <g:image_link>${escapeXml(imageUrl)}</g:image_link>
      <g:brand>Teen Liwa</g:brand>
      <g:condition>new</g:condition>
      <g:availability>${avail}</g:availability>
      <g:price>${p.price}.00 AED</g:price>
      <g:shipping_country>AE</g:shipping_country>
      <g:shipping_service>Standard Cold Delivery</g:shipping_service>
      <g:shipping_price>0.00 AED</g:shipping_price>
      <g:google_product_category>Food, Beverages &amp; Tobacco &gt; Food Items &gt; Fresh Produce</g:google_product_category>
      <g:custom_label_0>${escapeXml(p.origin || "Liwa")}</g:custom_label_0>
      <g:custom_label_1>${escapeXml(p.tag || "general")}</g:custom_label_1>
    </item>`;
		})
		.join("");

	const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>Teen Liwa Product Catalog Feed</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Official product catalog feed for Meta / Facebook Ads and Instagram Shop</description>
${xmlItems}
  </channel>
</rss>`;

	return new Response(rssXml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "max-age=3600, s-maxage=3600",
		},
	});
}

export async function handleMetaWebhook({ request }: ActionFunctionArgs) {
	try {
		const payload = await request.json();
		return Response.json({ success: true, received: true, payload });
	} catch (e) {
		return Response.json({ success: false, error: "Invalid webhook payload" }, { status: 400 });
	}
}
