import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { AwsClient } from "aws4fetch";

interface R2Config {
  accountId: string;
  token: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  publicUrl: string;
}

import { verifyAdminAuth } from "../../utils/adminAuth";

const CFG: R2Config = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID || "",
  token: process.env.CLOUDFLARE_API_TOKEN || "",
  accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "",
  bucket: process.env.CLOUDFLARE_R2_BUCKET || "bt-liwa",
  endpoint:
    process.env.CLOUDFLARE_R2_ENDPOINT && process.env.CLOUDFLARE_R2_ENDPOINT.includes("r2.cloudflarestorage.com")
      ? process.env.CLOUDFLARE_R2_ENDPOINT.replace(/\/+$/, "")
      : (process.env.CLOUDFLARE_ACCOUNT_ID ? `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com` : ""),
  publicUrl: (process.env.CLOUDFLARE_R2_PUBLIC_URL || "").replace(/\/+$/, ""),
};

function getR2Client(): AwsClient | null {
  if (!CFG.accessKeyId || !CFG.secretAccessKey) return null;
  return new AwsClient({
    accessKeyConfigured: Boolean(CFG.accessKeyId),
    secretAccessKey: CFG.secretAccessKey,
    service: "s3",
    region: "auto",
  });
}

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "gif":
      return "image/gif";
    case "json":
      return "application/json";
    default:
      return "application/octet-stream";
  }
}

export async function handleR2Loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || url.searchParams.get("file");
  const intent = url.searchParams.get("intent");
  const normalizedImageKey = (key || "").replace(/^\/+/, "");
  const publicImageKey = Boolean(key && !key.includes("..") && !key.includes("\\") && /^(images|products)\//.test(normalizedImageKey) && /\.(jpg|jpeg|png|webp|gif)$/i.test(normalizedImageKey));
  if (!publicImageKey && intent !== "get_catalog") {
    const auth = await verifyAdminAuth(request, context);
    if (!auth.authorized) return Response.json({ success:false, error:auth.reason || "Unauthorized" }, { status:401 });
  }
  if (key && !publicImageKey) return Response.json({ success:false, error:"Private object" }, { status:404 });
  const r2 = getR2Client();

  // 1. Direct object streaming from R2
  if (key) {
    if (!r2) {
      return new Response("Cloudflare R2 credentials not configured", { status: 503 });
    }

    try {
      const cleanKey = key.replace(/^\/+/, "");
      const objUrl = `${CFG.endpoint}/${CFG.bucket}/${cleanKey}`;
      const s3Res = await r2.fetch(objUrl);

      if (!s3Res.ok) {
        return new Response(`File not found in R2: ${s3Res.status}`, { status: s3Res.status });
      }

      const mimeType = getMimeType(cleanKey);

      return new Response(s3Res.body, {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "public, max-age=31536000, immutable",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (e) {
      return new Response(e instanceof Error ? e.message : "Error streaming from R2", { status: 500 });
    }
  }

  // 2. Fetch remote or local catalog
  if (intent === "get_catalog") {
    if (r2) {
      try {
        const catalogUrl = `${CFG.endpoint}/${CFG.bucket}/data/store.json`;
        const res = await r2.fetch(catalogUrl);

        if (res.ok) {
          const text = await res.text();
          const data = JSON.parse(text);
          if (data && typeof data === "object" && data.settings && typeof data.settings === "object") delete data.settings.ziinaApiKey;

          return Response.json({
            success: true,
            fromR2: true,
            data,
            message: "Catalog fetched from Cloudflare R2",
          });
        }
      } catch (err) {
        console.warn("R2 catalog fetch exception, checking local fallback:", err);
      }
    }


    return Response.json({
      success: false,
      fromR2: false,
      s3Configured: r2 !== null,
      message: "No remote or local catalog found",
    });
  }

  // 3. Status probe
  const s3Configured = r2 !== null;
  let connected = false;
  let remoteObjectsCount = 0;
  let remoteImages: string[] = [];
  let listError: string | null = null;
  let latencyMs = 0;

  if (r2) {
    const t0 = Date.now();
    try {
      const listUrl = `${CFG.endpoint}/${CFG.bucket}?list-type=2&max-keys=200`;
      const res = await r2.fetch(listUrl);
      latencyMs = Date.now() - t0;
      if (res.ok) {
        connected = true;
        const xml = await res.text();
        const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
        remoteObjectsCount = keys.length;
        remoteImages = keys
          .filter((k) => /\.(jpg|jpeg|png|webp|gif)$/i.test(k))
          .map((k) => {
            if (CFG.publicUrl) {
              return `${CFG.publicUrl}/${k}`;
            }
            return `/api/r2?key=${encodeURIComponent(k)}`;
          });
      } else {
        listError = `LIST HTTP ${res.status}`;
      }
    } catch (e) {
      latencyMs = Date.now() - t0;
      listError = e instanceof Error ? e.message : "Connection error";
    }
  } else {
    listError = "Secret Access Key not configured";
  }

  return Response.json({
    success: true,
    connected,
    s3Configured,
    publicUrlConfigured: Boolean(CFG.publicUrl),
    bucket: CFG.bucket,
    accountId: CFG.accountId,
    accessKeyId: CFG.accessKeyId,
    endpoint: CFG.endpoint,
    publicUrl: CFG.publicUrl,
    hasSecretKey: Boolean(CFG.secretAccessKey),
    remoteObjectsCount,
    remoteImages,
    latencyMs,
    listError,
    persistedOnDisk: false,
  });
}

export async function handleR2Action({ request, context }: ActionFunctionArgs) {
  const auth = await verifyAdminAuth(request, context);
  if (!auth.authorized) return Response.json({ success:false, error:auth.reason || "Unauthorized" }, { status:401 });
  let body: {
    intent?: string;
    data?: unknown;
    imageName?: string;
    imageBase64?: string;
    config?: Partial<R2Config>;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  // A. Save R2 Configuration (persisted to app/data/r2-config.json)
  if (body.intent === "save_r2_config") {
    return Response.json({ success:false, error:"Configure R2 credentials as Cloudflare Worker secrets; this API does not accept or store credentials." }, { status:400 });
  }

  const r2 = getR2Client();

  // B. Sync catalog to R2. Worker-local files are not durable storage.
  if (body.intent === "sync_catalog") {
    if (!r2) {
      return Response.json({ success:false, r2Synced:false, localSynced:false, error:"R2 Worker secrets are not configured" }, { status:503 });
    }

    const t0 = Date.now();
    try {
      const putUrl = `${CFG.endpoint}/${CFG.bucket}/data/store.json`;
      const putRes = await r2.fetch(putUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify(body.data, null, 2),
      });

      const latencyMs = Date.now() - t0;

      if (!putRes.ok) {
        return Response.json(
          {
            success: false,
            r2Synced: false,
            localSynced: false,
            latencyMs,
            error: `Failed to save to R2: HTTP ${putRes.status}`,
            detail: (await putRes.text()).slice(0, 400),
          },
          { status: 502 }
        );
      }

      return Response.json({
        success: true,
        r2Synced: true,
        localSynced: true,
        latencyMs,
        message: "Catalog synced successfully to Cloudflare R2 (data/store.json)",
      });
    } catch (e) {
      return Response.json(
        {
          success: false,
          r2Synced: false,
          localSynced: true,
          error: "Exception uploading to R2",
          detail: e instanceof Error ? e.message : "unknown",
        },
        { status: 500 }
      );
    }
  }

  // C. Upload Base64 Image to Cloudflare R2
  if (body.intent === "upload_base64") {
    if (!body.imageBase64) {
      return Response.json({ success: false, error: "imageBase64 is required" }, { status: 400 });
    }

    if (body.imageBase64.length > 7 * 1024 * 1024) return Response.json({ success:false, error:"Image exceeds the 5 MB upload limit" }, { status:413 });
    const m = body.imageBase64.match(/^data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=]+)$/i);
    if (!m) {
      return Response.json({ success: false, error: "Invalid Base64 format" }, { status: 400 });
    }
    const extRaw = m[1].toLowerCase();
    const ext = extRaw === "jpeg" ? "jpg" : extRaw;
    const contentType = `image/${extRaw === "jpg" ? "jpeg" : extRaw}`;
    const base64Data = m[2];

    const safeName = (body.imageName || "product").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${Date.now()}-${safeName}.${ext}`;
    const r2Key = `products/${filename}`;

    if (!r2) {
      return Response.json(
        {
          success: false,
          r2Synced: false,
          error: "Cloudflare R2 keys not configured",
        },
        { status: 503 }
      );
    }

    try {
      const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      if (bytes.byteLength > 5 * 1024 * 1024) return Response.json({ success:false, error:"Image exceeds the 5 MB upload limit" }, { status:413 });
      const putUrl = `${CFG.endpoint}/${CFG.bucket}/${r2Key}`;

      const putRes = await r2.fetch(putUrl, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
        body: bytes,
      });

      if (!putRes.ok) {
        return Response.json(
          {
            success: false,
            r2Synced: false,
            error: `R2 PUT failed: HTTP ${putRes.status}`,
            detail: (await putRes.text()).slice(0, 500),
          },
          { status: 502 }
        );
      }

      let finalImageUrl = "";
      if (CFG.publicUrl) {
        finalImageUrl = `${CFG.publicUrl}/${r2Key}`;
      } else {
        finalImageUrl = `/api/r2?key=${encodeURIComponent(r2Key)}`;
      }

      return Response.json({
        success: true,
        r2Synced: true,
        key: r2Key,
        filename,
        url: finalImageUrl,
        isR2Hosted: true,
        message: "Image uploaded to Cloudflare R2",
      });
    } catch (e) {
      return Response.json(
        {
          success: false,
          r2Synced: false,
          error: "Exception uploading to R2",
          detail: e instanceof Error ? e.message : "unknown",
        },
        { status: 500 }
      );
    }
  }

  return Response.json(
    { success: false, error: `Unknown intent: ${body.intent}` },
    { status: 400 }
  );
}
