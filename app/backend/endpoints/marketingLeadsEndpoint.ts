import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { fromFils, getD1Database, toFils } from "../../db/d1";
import { verifyAdminAuth } from "../../utils/adminAuth";

type LeadRow = Record<string, any>;

function parseArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch { return []; }
}

function mapLead(row: LeadRow) {
  return {
    id: String(row.id),
    customerName: String(row.customer_name || ""),
    name: String(row.customer_name || ""),
    phone: String(row.phone || ""),
    emirate: String(row.emirate || ""),
    city: row.city || undefined,
    sourceCampaign: row.source_campaign || "",
    interestedProduct: row.interested_product || "",
    interestedProducts: parseArray(row.interested_products_json),
    quantityEstimated: row.quantity_estimated || "",
    budgetAED: row.budget_fils == null ? undefined : fromFils(row.budget_fils),
    totalEstimatedValueAED: row.total_estimated_value_fils == null ? undefined : fromFils(row.total_estimated_value_fils),
    leadStatus: row.lead_status || "new",
    status: row.lead_status || "new",
    aiScore: row.ai_score || undefined,
    aiSummary: row.ai_summary || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
  };
}

export async function handleMarketingLeadsLoader({ request, context }: LoaderFunctionArgs) {
  const auth = await verifyAdminAuth(request, context);
  if (!auth.authorized) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const db = getD1Database(context);
  if (!db) return Response.json({ success: false, error: "CMS database is unavailable" }, { status: 503 });
  try {
    const { results } = await db.prepare("SELECT * FROM marketing_leads WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 500")
      .bind().all<LeadRow>();
    return Response.json({ success: true, leads: (results || []).map(mapLead) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Marketing lead read failed:", error);
    return Response.json({ success: false, error: "Could not load marketing leads" }, { status: 503 });
  }
}

export async function handleMarketingLeadsAction({ request, context }: ActionFunctionArgs) {
  const auth = await verifyAdminAuth(request, context);
  if (!auth.authorized) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const db = getD1Database(context);
  if (!db) return Response.json({ success: false, error: "CMS database is unavailable" }, { status: 503 });
  let body: any;
  try { body = await request.json(); }
  catch { return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }
  const intent = String(body.intent || "");
  try {
    if (intent === "create_lead") {
      const lead = body.lead || {};
      const customerName = String(lead.customerName || lead.name || "").trim();
      const phone = String(lead.phone || "").trim();
      if (!customerName || !phone) return Response.json({ success: false, error: "Customer name and phone are required" }, { status: 400 });
      const budgetFils = lead.budgetAED == null || lead.budgetAED === "" ? null : toFils(Number(lead.budgetAED));
      const totalFils = lead.totalEstimatedValueAED == null || lead.totalEstimatedValueAED === "" ? null : toFils(Number(lead.totalEstimatedValueAED));
      const inserted = await db.prepare(`
        INSERT INTO marketing_leads (
          customer_name, phone, emirate, city, source_campaign, interested_product,
          interested_products_json, quantity_estimated, budget_fils, total_estimated_value_fils,
          lead_status, ai_score, ai_summary, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
      `).bind(
        customerName.slice(0, 160), phone.slice(0, 30), String(lead.emirate || "").slice(0, 80),
        String(lead.city || "").slice(0, 100), String(lead.sourceCampaign || "").slice(0, 160),
        String(lead.interestedProduct || "").slice(0, 160), JSON.stringify(parseArray(lead.interestedProducts)),
        String(lead.quantityEstimated || "").slice(0, 80), budgetFils, totalFils,
        ["new", "contacted", "qualified", "won", "lost"].includes(lead.leadStatus) ? lead.leadStatus : "new",
        ["high", "medium", "low"].includes(lead.aiScore) ? lead.aiScore : null,
        String(lead.aiSummary || "").slice(0, 2000), String(lead.notes || "").slice(0, 2000)
      ).first<LeadRow>();
      if (!inserted) return Response.json({ success: false, error: "Lead could not be saved" }, { status: 503 });
      return Response.json({ success: true, lead: mapLead(inserted) }, { status: 201 });
    }

    const id = Number(body.id);
    if (!Number.isSafeInteger(id) || id < 1) return Response.json({ success: false, error: "Valid lead id is required" }, { status: 400 });
    if (intent === "update_status") {
      const status = String(body.status || "");
      if (!["new", "contacted", "qualified", "won", "lost"].includes(status)) return Response.json({ success: false, error: "Invalid lead status" }, { status: 400 });
      const result: any = await db.prepare("UPDATE marketing_leads SET lead_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL")
        .bind(status, id).run();
      return Number(result?.meta?.changes ?? result?.meta?.rows_written ?? 0) > 0
        ? Response.json({ success: true })
        : Response.json({ success: false, error: "Lead not found" }, { status: 404 });
    }
    if (intent === "update_score") {
      const score = String(body.score || "");
      if (!["high", "medium", "low"].includes(score)) return Response.json({ success: false, error: "Invalid lead score" }, { status: 400 });
      const result: any = await db.prepare("UPDATE marketing_leads SET ai_score = ?, ai_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL")
        .bind(score, String(body.summary || "").slice(0, 2000), id).run();
      return Number(result?.meta?.changes ?? result?.meta?.rows_written ?? 0) > 0
        ? Response.json({ success: true })
        : Response.json({ success: false, error: "Lead not found" }, { status: 404 });
    }
    if (intent === "delete_lead") {
      const result: any = await db.prepare("UPDATE marketing_leads SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL")
        .bind(id).run();
      return Number(result?.meta?.changes ?? result?.meta?.rows_written ?? 0) > 0
        ? Response.json({ success: true })
        : Response.json({ success: false, error: "Lead not found" }, { status: 404 });
    }
    return Response.json({ success: false, error: "Unsupported lead operation" }, { status: 400 });
  } catch (error) {
    console.error("Marketing lead write failed:", error);
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Could not save marketing lead" }, { status: 400 });
  }
}
