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

function validatePublicSetting(key: string, value: unknown): unknown {
  const asText = (maxLength: number, required = false): string => {
    if (typeof value !== "string") throw new Error(`Invalid value for ${key}`);
    const normalized = value.trim();
    if ((required && !normalized) || normalized.length > maxLength) throw new Error(`Invalid value for ${key}`);
    return normalized;
  };
  const asBoolean = (): boolean => {
    if (typeof value !== "boolean") throw new Error(`Invalid value for ${key}`);
    return value;
  };
  const asAmount = (): number => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(Math.round(amount * 100))) {
      throw new Error(`Invalid AED amount for ${key}`);
    }
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  };

  switch (key) {
    case "storeName": return asText(120, true);
    case "storeTagline": return asText(240);
    case "whatsappNumber":
    case "contactPhone": return asText(30, true);
    case "freeDeliveryThreshold":
    case "standardDeliveryFee": return asAmount();
    case "bannerNotice": return asText(300);
    case "bannerActive":
    case "facebookCatalogFeedEnabled":
    case "ziinaEnabled":
    case "ziinaTestMode": return asBoolean();
    case "featuredSeason": return asText(100);
    case "metaPixelId": return asText(80);
    case "currency":
      if (value !== "AED") throw new Error("Teen Liwa store currency must be AED");
      return "AED";
    default:
      throw new Error(`Unsupported setting: ${key}`);
  }
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

  const entries = Object.entries(incoming).filter(([key, value]) => PUBLIC_SETTING_KEYS.has(key) && value !== undefined);
  if (!entries.length) return Response.json({ success: false, error: "No supported settings supplied" }, { status: 400 });

  try {
    const statements = entries.map(([key, value]) => {
      const validatedValue = validatePublicSetting(key, value);
      return db.prepare(`
        INSERT INTO store_settings (setting_key, setting_value, is_public, updated_at)
        VALUES (?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(setting_key) DO UPDATE SET
          setting_value = excluded.setting_value,
          is_public = 1,
          updated_at = CURRENT_TIMESTAMP
      `).bind(key, JSON.stringify(validatedValue));
    });
    if (db.batch) await db.batch(statements);
    else for (const statement of statements) await statement.run();
    return Response.json({ success: true, saved: statements.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith("Invalid ") || error.message.startsWith("Unsupported ") || error.message.includes("currency"))) {
      return Response.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error("Store settings write failed:", error);
    return Response.json({ success: false, error: "Settings could not be saved" }, { status: 503 });
  }
}
