import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getD1Database } from "../../db/d1";
import { verifyAdminAuth } from "../../utils/adminAuth";

const PUBLIC_SETTING_KEYS = new Set([
  "storeName", "storeTagline", "whatsappNumber", "contactPhone",
  "freeDeliveryThreshold", "standardDeliveryFee", "bannerNotice",
  "bannerActive", "featuredSeason", "metaPixelId",
  "facebookCatalogFeedEnabled", "currency", "ziinaEnabled", "ziinaTestMode",
]);

function parseValue(value: string): unknown {
  try { return JSON.parse(value); } catch { return value; }
}

export async function handleSettingsLoader({ context }: LoaderFunctionArgs) {
  const db = getD1Database(context);
  if (!db) return Response.json({ success: false, error: "Settings database is unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    const { results } = await db.prepare("SELECT setting_key, setting_value FROM store_settings WHERE is_public = 1").bind()
      .all<{ setting_key: string; setting_value: string }>();
    const settings: Record<string, unknown> = {};
    for (const row of results || []) {
      if (PUBLIC_SETTING_KEYS.has(row.setting_key)) settings[row.setting_key] = parseValue(row.setting_value);
    }
    return Response.json({ success: true, settings }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Store settings read failed:", error);
    return Response.json({ success: false, error: "Failed to load store settings" }, { status: 503 });
  }
}

export async function handleSettingsAction({ request, context }: ActionFunctionArgs) {
  const auth = await verifyAdminAuth(request, context);
  if (!auth.authorized) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (request.method.toUpperCase() !== "PUT" && request.method.toUpperCase() !== "PATCH") {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405, headers: { Allow: "PUT, PATCH" } });
  }
  const db = getD1Database(context);
  if (!db) return Response.json({ success: false, error: "Settings database is unavailable" }, { status: 503 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }
  const incoming = body?.settings;
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return Response.json({ success: false, error: "settings object is required" }, { status: 400 });
  }

  const statements = Object.entries(incoming)
    .filter(([key, value]) => PUBLIC_SETTING_KEYS.has(key) && value !== undefined)
    .map(([key, value]) => db.prepare(`
      INSERT INTO store_settings (setting_key, setting_value, is_public, updated_at)
      VALUES (?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(setting_key) DO UPDATE SET
        setting_value = excluded.setting_value,
        is_public = 1,
        updated_at = CURRENT_TIMESTAMP
    `).bind(key, JSON.stringify(value)));
  if (!statements.length) return Response.json({ success: false, error: "No supported settings supplied" }, { status: 400 });
  try {
    if (db.batch) await db.batch(statements);
    else for (const statement of statements) await statement.run();
    return Response.json({ success: true, saved: statements.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Store settings write failed:", error);
    return Response.json({ success: false, error: "Settings could not be saved" }, { status: 503 });
  }
}
