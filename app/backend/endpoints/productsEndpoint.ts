import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getD1Database } from "../../db/d1";
import { verifyAdminAuth } from "../../utils/adminAuth";
import {
  getProductsFromDb, createProductInDb, updateProductInDb,
  deleteProductFromDb, clearAllProductsInDb,
} from "../../db/productsDb";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function handleProductsLoader({ request, context }: LoaderFunctionArgs) {
  const db = getD1Database(context);
  if (!db) return Response.json({ success: false, error: "Product database is unavailable" }, { status: 503, headers: NO_STORE_HEADERS });
  const auth = await verifyAdminAuth(request, context);
  try {
    const { products, storageType } = await getProductsFromDb(db, auth.authorized);
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const query = url.searchParams.get("q")?.trim().toLowerCase();
    let filtered = products;
    if (category && category !== "all") filtered = filtered.filter((p) => p.category === category || p.tag === category);
    if (query) filtered = filtered.filter((p) =>
      p.name.toLowerCase().includes(query) ||
      p.nameEn?.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query)
    );
    return Response.json({ success: true, count: filtered.length, storageType, products: filtered }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("D1 product read failed:", error);
    return Response.json({ success: false, error: "Failed to load products" }, { status: 503, headers: NO_STORE_HEADERS });
  }
}

export async function handleProductsAction({ request, context }: ActionFunctionArgs) {
  const auth = await verifyAdminAuth(request, context);
  if (!auth.authorized) return Response.json({ success: false, error: auth.reason || "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  const db = getD1Database(context);
  if (!db) return Response.json({ success: false, error: "Product database is unavailable" }, { status: 503, headers: NO_STORE_HEADERS });

  let body: any;
  try { body = await request.json(); }
  catch { return Response.json({ success: false, error: "Invalid JSON payload" }, { status: 400, headers: NO_STORE_HEADERS }); }

  const method = request.method.toUpperCase();
  const intent = body.intent || (method === "DELETE" ? "delete_product" : method === "PATCH" ? "update_product" : "create_product");
  try {
    if (intent === "clear_all_products") {
      const result = await clearAllProductsInDb(db);
      return Response.json({ success: result.dbSaved, ...result }, { headers: NO_STORE_HEADERS });
    }
    if (intent === "create_product") {
      const product = body.product;
      if (!product || typeof product.name !== "string" || !product.name.trim() ||
          !Number.isFinite(Number(product.price)) || Number(product.price) < 0) {
        return Response.json({ success: false, error: "A product name and valid AED price are required" }, { status: 400, headers: NO_STORE_HEADERS });
      }
      const result = await createProductInDb(product, db);
      return Response.json({ success: true, product: result.product, dbSaved: true }, { headers: NO_STORE_HEADERS });
    }
    if (intent === "update_product" || method === "PATCH") {
      const { id, updates } = body;
      if (!/^\d+$/.test(String(id || "")) || !updates || typeof updates !== "object" || Array.isArray(updates)) {
        return Response.json({ success: false, error: "A numeric product id and updates are required" }, { status: 400, headers: NO_STORE_HEADERS });
      }
      const result = await updateProductInDb(String(id), updates, db);
      if (!result.product) return Response.json({ success: false, error: "Product not found" }, { status: 404, headers: NO_STORE_HEADERS });
      return Response.json({ success: true, product: result.product, dbSaved: result.dbSaved }, { headers: NO_STORE_HEADERS });
    }
    if (intent === "delete_product" || method === "DELETE") {
      const id = body.id || body.productId;
      if (!/^\d+$/.test(String(id || ""))) return Response.json({ success: false, error: "Numeric product id required" }, { status: 400, headers: NO_STORE_HEADERS });
      const result = await deleteProductFromDb(String(id), db);
      if (!result.deleted) return Response.json({ success: false, error: "Product not found" }, { status: 404, headers: NO_STORE_HEADERS });
      return Response.json({ success: true, ...result }, { headers: NO_STORE_HEADERS });
    }
    return Response.json({ success: false, error: "Unsupported product intent" }, { status: 400, headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("Product CMS write failed:", error);
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Product update failed" }, { status: 400, headers: NO_STORE_HEADERS });
  }
}
