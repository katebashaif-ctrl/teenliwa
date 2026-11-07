import type { Product } from "../types/store";
import { AwsClient } from "aws4fetch";
import { INITIAL_PRODUCTS } from "../data/initialData";

export interface D1DatabaseLike {
  prepare: (query: string) => {
    bind: (...params: any[]) => {
      run: () => Promise<any>;
      all: <T = any>() => Promise<{ results?: T[]; success?: boolean }>;
      first: <T = any>() => Promise<T | null>;
    };
  };
  exec?: (query: string) => Promise<any>;
}

// D1 is authoritative when available; this cache is only a fallback for runtimes
// without a database binding.
let memoryProductsCache: Product[] = [...INITIAL_PRODUCTS];
let isProductSchemaInitialized = false;

function getR2Config() {
  const env = process.env || {};
  const accountId = String(env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const accessKeyId = String(env.CLOUDFLARE_R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "").trim();
  const bucket = String(env.CLOUDFLARE_R2_BUCKET || env.R2_BUCKET || "").trim();
  const configuredEndpoint = String(env.CLOUDFLARE_R2_ENDPOINT || "").trim();
  const endpoint = configuredEndpoint.includes("r2.cloudflarestorage.com") ? configuredEndpoint.replace(/\/+$/, "") : (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  return { accessKeyId, secretAccessKey, bucket, endpoint };
}
function getR2Client(): { client: AwsClient; bucket: string; endpoint: string } | null {
  const config = getR2Config();
  if (!config.accessKeyId || !config.secretAccessKey || !config.bucket || !config.endpoint) return null;
  return {
    client: new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: "s3",
      region: "auto",
    }),
    bucket: config.bucket,
    endpoint: config.endpoint.replace(/\/+$/, ""),
  };
}

export async function initializeProductsSchema(db: D1DatabaseLike, force = false): Promise<boolean> {
  if (isProductSchemaInitialized && !force) return true;
  const ddl = `
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      image_url TEXT,
      seed_key TEXT,
      available INTEGER DEFAULT 1,
      category_id TEXT,
      sort_order INTEGER DEFAULT 1,
      minimum_order_quantity INTEGER DEFAULT 1,
      maximum_order_quantity INTEGER,
      data_json TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  try {
    await db.prepare(ddl).run();
    isProductSchemaInitialized = true;
    return true;
  } catch (error) {
    if (typeof db.exec === "function") {
      try {
        await db.exec(ddl);
        isProductSchemaInitialized = true;
        return true;
      } catch (execError) {
        console.warn("Product schema creation warning:", execError);
      }
    }
    console.warn("Product schema creation warning:", error);
    return false;
  }
}

export function mapD1RowToProduct(row: any): Product {
  let extraData: Partial<Product> = {};
  try {
    if (row.data_json) {
      extraData = typeof row.data_json === "string" ? JSON.parse(row.data_json) : row.data_json;
    }
  } catch {}

  const categoryMap: Record<string, Product["category"]> = {
    "cat-1": "rutab", "cat-2": "figs", "cat-3": "dates", "cat-4": "truffles",
    "cat-5": "heritage_boxes", "cat-6": "preserves", rutab: "rutab", figs: "figs",
    dates: "dates", truffles: "truffles", heritage_boxes: "heritage_boxes", preserves: "preserves",
  };
  const available = row.available == null ? extraData.inStock !== false : Number(row.available) === 1;

  return {
    ...extraData,
    id: row.id,
    name: row.name,
    nameEn: extraData.nameEn || row.name,
    category: extraData.category || categoryMap[row.category_id] || "rutab",
    price: Number(row.price) || 0,
    unit: extraData.unit || "box",
    origin: extraData.origin || "Liwa & Al Ain Farms",
    harvestDate: extraData.harvestDate || "Fresh Harvest",
    season: extraData.season || "Local Season",
    image: row.image_url || extraData.image || "/images/redfig.jpg",
    description: row.description || extraData.description || "",
    tastingNotes: extraData.tastingNotes || [],
    storageInstructions: extraData.storageInstructions || "Keep refrigerated",
    inStock: available,
    stockQuantity: extraData.stockQuantity ?? 50,
    featured: extraData.featured ?? false,
  } as Product;
}

export async function syncProductsToR2(products: Product[]): Promise<boolean> {
  const r2 = getR2Client();
  if (!r2) return false;
  try {
    const response = await r2.client.fetch(`${r2.endpoint}/${r2.bucket}/data/store.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache, no-store, must-revalidate" },
      body: JSON.stringify({ lastUpdated: new Date().toISOString(), products }, null, 2),
    });
    return response.ok;
  } catch (error) {
    console.warn("Could not sync products to R2:", error);
    return false;
  }
}

async function fetchProductsFromR2(): Promise<Product[] | null> {
  const r2 = getR2Client();
  if (!r2) return null;
  try {
    const response = await r2.client.fetch(`${r2.endpoint}/${r2.bucket}/data/store.json`, {
      headers: { "Cache-Control": "no-cache" },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { products?: Product[] };
    return Array.isArray(data.products) ? data.products : null;
  } catch (error) {
    console.warn("Could not fetch products from R2:", error);
    return null;
  }
}

async function readProductsFromD1(db: D1DatabaseLike): Promise<Product[]> {
  await initializeProductsSchema(db);
  const { results } = await db
    .prepare("SELECT * FROM products ORDER BY sort_order ASC, created_at DESC")
    .bind()
    .all<any>();
  return Array.isArray(results) ? results.map(mapD1RowToProduct) : [];
}

export async function getProductsFromDb(d1?: D1DatabaseLike): Promise<{
  products: Product[];
  storageType: "d1_database" | "r2_database" | "memory_cache";
}> {
  if (d1) {
    try {
      // An empty D1 catalog is intentional (for example after clearing products).
      // Never reseed or merge sample products into an existing database.
      const products = await readProductsFromD1(d1);
      memoryProductsCache = products;
      return { products, storageType: "d1_database" };
    } catch (error) {
      console.warn("D1 products query error:", error);
    }
  }

  const r2Products = await fetchProductsFromR2();
  if (r2Products !== null) {
    memoryProductsCache = r2Products;
    return { products: r2Products, storageType: "r2_database" };
  }
  return { products: memoryProductsCache, storageType: "memory_cache" };
}

async function getCanonicalProducts(d1?: D1DatabaseLike): Promise<Product[]> {
  if (d1) {
    try {
      memoryProductsCache = await readProductsFromD1(d1);
    } catch (error) {
      console.warn("Could not reload canonical D1 products:", error);
    }
  }
  return memoryProductsCache;
}

export async function createProductInDb(product: Product, d1?: D1DatabaseLike): Promise<{
  product: Product;
  dbSaved: boolean;
  r2Synced: boolean;
}> {
  let dbSaved = false;
  if (d1) {
    try {
      await initializeProductsSchema(d1);
      await d1.prepare(`INSERT OR REPLACE INTO products (
        id, name, description, price, image_url, available, category_id,
        sort_order, minimum_order_quantity, maximum_order_quantity, data_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 0, ?, ?)`)
        .bind(product.id, product.name, product.description || "", product.price, product.image || "",
          product.inStock ? 1 : 0, product.category, JSON.stringify(product), new Date().toISOString())
        .run();
      dbSaved = true;
    } catch (error) {
      console.error("D1 product insert error:", error);
    }
  }
  if (!d1 || dbSaved) {
    memoryProductsCache = d1
      ? await getCanonicalProducts(d1)
      : [product, ...memoryProductsCache.filter((item) => item.id !== product.id)];
  }
  const r2Synced = !d1 || dbSaved ? await syncProductsToR2(memoryProductsCache) : false;
  return { product, dbSaved, r2Synced };
}

export async function updateProductInDb(
  id: string,
  updates: Partial<Product>,
  d1?: D1DatabaseLike,
): Promise<{ product: Product | null; dbSaved: boolean; r2Synced: boolean }> {
  let existing: Product | undefined;
  if (d1) {
    try {
      await initializeProductsSchema(d1);
      const row = await d1.prepare("SELECT * FROM products WHERE id = ?").bind(id).first<any>();
      if (row) existing = mapD1RowToProduct(row);
    } catch (error) {
      console.warn("Could not read product from D1 before update:", error);
    }
  } else {
    existing = memoryProductsCache.find((item) => item.id === id);
  }
  if (!existing) return { product: null, dbSaved: false, r2Synced: false };

  const updated: Product = { ...existing, ...updates, id };
  let dbSaved = false;
  if (d1) {
    try {
      await d1.prepare(`UPDATE products SET
        name = ?, description = ?, price = ?, image_url = ?, available = ?,
        category_id = ?, data_json = ? WHERE id = ?`)
        .bind(updated.name, updated.description || "", updated.price, updated.image || "",
          updated.inStock ? 1 : 0, updated.category, JSON.stringify(updated), id)
        .run();
      dbSaved = true;
    } catch (error) {
      console.error("D1 product update error:", error);
    }
  }
  if (!d1 || dbSaved) {
    memoryProductsCache = d1
      ? await getCanonicalProducts(d1)
      : memoryProductsCache.map((item) => item.id === id ? updated : item);
  }
  const r2Synced = !d1 || dbSaved ? await syncProductsToR2(memoryProductsCache) : false;
  return { product: updated, dbSaved, r2Synced };
}

export async function deleteProductFromDb(id: string, d1?: D1DatabaseLike): Promise<{
  deleted: boolean;
  dbSaved: boolean;
  r2Synced: boolean;
}> {
  let dbSaved = false;
  if (d1) {
    try {
      await initializeProductsSchema(d1);
      await d1.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
      dbSaved = true;
    } catch (error) {
      console.error("D1 product delete error:", error);
    }
  }
  if (!d1 || dbSaved) {
    memoryProductsCache = d1
      ? await getCanonicalProducts(d1)
      : memoryProductsCache.filter((item) => item.id !== id);
  }
  const r2Synced = !d1 || dbSaved ? await syncProductsToR2(memoryProductsCache) : false;
  return { deleted: true, dbSaved, r2Synced };
}

export async function clearAllProductsInDb(d1?: D1DatabaseLike): Promise<{
  cleared: boolean;
  dbSaved: boolean;
  r2Synced: boolean;
}> {
  let dbSaved = false;
  if (d1) {
    try {
      await initializeProductsSchema(d1);
      await d1.prepare("DELETE FROM products").bind().run();
      dbSaved = true;
    } catch (error) {
      console.error("D1 products clear error:", error);
    }
  }
  memoryProductsCache = d1 && !dbSaved ? memoryProductsCache : [];
  const r2Synced = !d1 || dbSaved ? await syncProductsToR2(memoryProductsCache) : false;
  return { cleared: true, dbSaved, r2Synced };
}
