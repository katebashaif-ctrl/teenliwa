/** Signed, short-lived server-side admin sessions. Configure ADMIN_PASSWORD (16+ chars)
 * and ADMIN_SESSION_SECRET (32+ random chars) as Cloudflare Worker secrets.
 */
export const ADMIN_COOKIE_NAME = "teenliwa_admin_session";
const SESSION_SECONDS = 8 * 60 * 60;
function envOf(context?: any): Record<string, string | undefined> { return ((context as any)?.cloudflare?.env || process.env || {}) as Record<string, string | undefined>; }
function parseCookies(header: string): Record<string, string> {
 const out: Record<string, string> = {};
 for (const part of header.split(";")) { const i = part.indexOf("="); if (i > 0) { const key = part.slice(0, i).trim(); try { out[key] = decodeURIComponent(part.slice(i + 1).trim()); } catch { out[key] = ""; } } }
 return out;
}
function equal(a: string, b: string): boolean { if (!a || !b || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function toHex(buffer: ArrayBuffer): string { return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, "0")).join(""); }
async function sign(expiry: string, secret: string): Promise<string> {
 const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
 return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("teenliwa-admin-v1:" + expiry)));
}
export async function createAdminSessionCookie(request: Request, context?: any): Promise<string | null> {
 const secret = String(envOf(context).ADMIN_SESSION_SECRET || ""); if (secret.length < 32) return null;
 const expiry = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS); const signature = await sign(expiry, secret);
 const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
 return ADMIN_COOKIE_NAME + "=" + encodeURIComponent(expiry + "." + signature) + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + SESSION_SECONDS + secure;
}
export function clearAdminSessionCookie(request: Request): string { const secure = new URL(request.url).protocol === "https:" ? "; Secure" : ""; return ADMIN_COOKIE_NAME + "=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" + secure; }
export async function verifyAdminAuth(request: Request, context?: any): Promise<{ authorized: boolean; reason?: string }> {
 const secret = String(envOf(context).ADMIN_SESSION_SECRET || ""); if (secret.length < 32) return { authorized: false, reason: "Admin authentication is not configured" };
 const token = parseCookies(request.headers.get("cookie") || "")[ADMIN_COOKIE_NAME] || ""; const parts = token.split("."); const expiry = parts[0] || ""; const signature = parts[1] || "";
 if (!/^\d{10}$/.test(expiry) || !signature || parts.length !== 2 || Number(expiry) <= Math.floor(Date.now() / 1000)) return { authorized: false, reason: "Admin session is missing or expired" };
 try { if (!equal(signature, await sign(expiry, secret))) return { authorized: false, reason: "Invalid admin session" };
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) { const origin = request.headers.get("origin"); if (origin && origin !== new URL(request.url).origin) return { authorized: false, reason: "Cross-origin request rejected" }; }
  return { authorized: true };
 } catch { return { authorized: false, reason: "Unable to validate admin session" }; }
}
/** Same-origin fetch sends the HttpOnly session cookie automatically. Never ship tokens to clients. */
export function getAdminRequestHeaders(): Record<string, string> { return {}; }
