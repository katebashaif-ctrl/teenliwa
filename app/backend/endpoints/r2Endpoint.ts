import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { verifyAdminAuth } from "../../utils/adminAuth";

interface R2ObjectLike {
  body: ReadableStream;
  httpMetadata?: { contentType?: string; cacheControl?: string };
  etag?: string;
  size?: number;
  key?: string;
}
interface R2BucketLike {
  get(key: string): Promise<R2ObjectLike | null>;
  put(key: string, value: ArrayBuffer | ArrayBufferView | string | ReadableStream, options?: any): Promise<any>;
  list(options?: any): Promise<{ objects?: Array<{ key: string; size: number; uploaded: Date }> }>;
}

function getBucket(context?: any): R2BucketLike | null {
  const bucket = context?.cloudflare?.env?.BUCKET;
  return bucket && typeof bucket.get === "function" && typeof bucket.put === "function"
    ? bucket as R2BucketLike : null;
}

function getBucketName(context?: any): string {
  return String(context?.cloudflare?.env?.R2_BUCKET || "bt-liwa");
}

function safeImageKey(value: string): boolean {
  const normalized = value.replace(/^\/+/, "");
  const parts = normalized.split("/");
  return !value.includes("..") && !value.includes("%") && !value.includes("\\") &&
    parts.length >= 2 && parts.every((part) => part && part !== "." && part !== "..") &&
    /^(images|products)\//.test(normalized) && /\.(jpg|jpeg|png|webp|gif)$/i.test(normalized);
}

function mimeType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "application/octet-stream";
}

export async function handleR2Loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || url.searchParams.get("file");
  const bucket = getBucket(context);

  // Only explicitly allowlisted image objects are public. All other object keys are private.
  if (key) {
    if (!safeImageKey(key)) return Response.json({ success: false, error: "Private object" }, { status: 404 });
    if (!bucket) return Response.json({ success: false, error: "Image storage is unavailable" }, { status: 503 });
    try {
      const object = await bucket.get(key.replace(/^\/+/, ""));
      if (!object) return new Response("Not found", { status: 404 });
      return new Response(object.body, {
        headers: {
          "Content-Type": object.httpMetadata?.contentType || mimeType(key),
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "public, max-age=31536000, immutable",
          ...(object.etag ? { ETag: object.etag } : {}),
        },
      });
    } catch (error) {
      console.error("R2 image read failed:", error);
      return new Response("Image storage error", { status: 503 });
    }
  }

  // Catalog data is stored in D1 now, never read from a public JSON object in R2.
  if (url.searchParams.get("intent") === "get_catalog") {
    return Response.json({ success: false, fromR2: false, message: "The catalogue is served from the D1 database." }, {
      status: 410, headers: { "Cache-Control": "no-store" },
    });
  }

  const auth = await verifyAdminAuth(request, context);
  if (!auth.authorized) return Response.json({ success: false, error: auth.reason || "Unauthorized" }, { status: 401 });
  if (!bucket) return Response.json({ success: false, connected: false, s3Configured: false, bucket: getBucketName(context), listError: "R2 bucket binding BUCKET is unavailable" }, { status: 503 });

  try {
    const listing = await bucket.list({ limit: 200 });
    const objects = listing.objects || [];
    const remoteImages = objects
      .map((object) => object.key)
      .filter((objectKey) => safeImageKey(objectKey))
      .map((objectKey) => "/api/r2?key=" + encodeURIComponent(objectKey));
    return Response.json({
      success: true, connected: true, s3Configured: true, bucket: getBucketName(context),
      accountId: "", endpoint: "", publicUrl: "", publicUrlConfigured: false,
      accessKeyConfigured: true, hasSecretKey: true, remoteObjectsCount: objects.length,
      remoteImages, latencyMs: 0, listError: null, persistedOnDisk: false,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("R2 bucket listing failed:", error);
    return Response.json({
      success: false, connected: false, s3Configured: true, bucket: getBucketName(context),
      remoteObjectsCount: 0, remoteImages: [], listError: "Could not list R2 objects",
    }, { status: 503 });
  }
}

export async function handleR2Action({ request, context }: ActionFunctionArgs) {
  const auth = await verifyAdminAuth(request, context);
  if (!auth.authorized) return Response.json({ success: false, error: auth.reason || "Unauthorized" }, { status: 401 });
  let body: { intent?: string; imageName?: string; imageBase64?: string };
  try { body = await request.json(); }
  catch { return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  if (body.intent === "save_r2_config") {
    return Response.json({ success: false, error: "R2 credentials are managed by Cloudflare bindings and cannot be saved from the browser." }, { status: 400 });
  }
  if (body.intent === "sync_catalog") {
    return Response.json({ success: false, r2Synced: false, localSynced: false, error: "The product catalogue is stored in D1; R2 is only for image objects." }, { status: 410 });
  }
  if (body.intent !== "upload_base64") {
    return Response.json({ success: false, error: "Unsupported R2 operation" }, { status: 400 });
  }

  const bucket = getBucket(context);
  if (!bucket) return Response.json({ success: false, error: "R2 bucket binding BUCKET is unavailable" }, { status: 503 });
  if (!body.imageBase64) return Response.json({ success: false, error: "imageBase64 is required" }, { status: 400 });
  if (body.imageBase64.length > 7 * 1024 * 1024) return Response.json({ success: false, error: "Image exceeds the 5 MB upload limit" }, { status: 413 });

  const match = body.imageBase64.match(/^data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return Response.json({ success: false, error: "Invalid Base64 image" }, { status: 400 });
  try {
    const extRaw = match[1].toLowerCase();
    const ext = extRaw === "jpeg" ? "jpg" : extRaw;
    const contentType = extRaw === "jpg" ? "image/jpeg" : "image/" + extRaw;
    const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
    if (bytes.byteLength > 5 * 1024 * 1024) return Response.json({ success: false, error: "Image exceeds the 5 MB upload limit" }, { status: 413 });
    const safeName = String(body.imageName || "product").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
    const filename = Date.now().toString(36) + "-" + safeName + "." + ext;
    const key = "products/" + filename;
    await bucket.put(key, bytes, {
      httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" },
    });
    return Response.json({
      success: true, r2Synced: true, key, filename,
      url: "/api/r2?key=" + encodeURIComponent(key), isR2Hosted: true,
      message: "Image uploaded to Cloudflare R2",
    });
  } catch (error) {
    console.error("R2 image upload failed:", error);
    return Response.json({ success: false, error: "Image upload failed" }, { status: 503 });
  }
}
