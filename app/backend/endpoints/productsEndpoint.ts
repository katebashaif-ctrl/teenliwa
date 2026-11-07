import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { verifyAdminAuth } from "../../utils/adminAuth";
import {
  getProductsFromDb,
  createProductInDb,
  updateProductInDb,
  deleteProductFromDb,
  clearAllProductsInDb,
} from "../../db/productsDb";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function handleProductsLoader({ request, context }: LoaderFunctionArgs) {
  const d1 = (context as any)?.cloudflare?.env?.DB;
  const url = new URL(request.url);
  const categoryFilter = url.searchParams.get("category");
  const searchQuery = url.searchParams.get("q")?.toLowerCase();

  try {
    const { products, storageType } = await getProductsFromDb(d1);
    let filtered = products;
    if (categoryFilter && categoryFilter !== "all") {
      filtered = filtered.filter((p) => p.category === categoryFilter || p.tag === categoryFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery) ||
          p.nameEn?.toLowerCase().includes(searchQuery) ||
          p.description?.toLowerCase().includes(searchQuery),
      );
    }

    return Response.json(
      { success: true, count: filtered.length, storageType, products: filtered },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("Error fetching products from database:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch products from database",
        detail: error instanceof Error ? error.message : "unknown",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function handleProductsAction({ request, context }: ActionFunctionArgs) {
  const auth = await verifyAdminAuth(request, context);
  if (!auth.authorized) return Response.json({ success: false, error: auth.reason || "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  const d1 = (context as any)?.cloudflare?.env?.DB;
  if (!d1) return Response.json({ success:false, error:"Product database is unavailable" }, { status:503, headers:NO_STORE_HEADERS });
  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const method = request.method.toUpperCase();
  const intent = body.intent || (method === "DELETE" ? "delete_product" : method === "PATCH" ? "update_product" : "create_product");

  if (intent === "clear_all_products") {
    try {
      const result = await clearAllProductsInDb(d1);
      if (!result.dbSaved) return Response.json({ success:false, error:"Product catalog could not be cleared in D1" }, { status:503, headers:NO_STORE_HEADERS });
      return Response.json({ success: true, message: "All products cleared successfully", ...result }, { headers: NO_STORE_HEADERS });
    } catch (error) {
      return Response.json(
        { success: false, error: "Failed to clear products", detail: error instanceof Error ? error.message : "unknown" },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }
  }

  if (intent === "create_product") {
    const { product } = body;
    if (!product || !product.name || product.price === undefined) {
      return Response.json({ success: false, error: "Missing required product fields (name and price)" }, { status: 400 });
    }
    try {
      const result = await createProductInDb(product, d1);
      if (!result.dbSaved) return Response.json({ success:false, error:"Product could not be saved to D1" }, { status:503, headers:NO_STORE_HEADERS });
      return Response.json(
        { success: true, message: "Product created successfully", product: result.product, dbSaved: result.dbSaved, r2Synced: result.r2Synced },
        { headers: NO_STORE_HEADERS },
      );
    } catch (error) {
      console.error("Error creating product in DB:", error);
      return Response.json(
        { success: false, error: "Failed to create product in database", detail: error instanceof Error ? error.message : "unknown" },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }
  }

  if (intent === "update_product" || method === "PATCH") {
    const { id, updates } = body;
    if (!id || !updates) {
      return Response.json({ success: false, error: "id and updates required" }, { status: 400 });
    }
    try {
      const result = await updateProductInDb(id, updates, d1);
      if (!result.dbSaved) return Response.json({ success:false, error:"Product changes could not be saved to D1" }, { status:503, headers:NO_STORE_HEADERS });
      if (!result.product) {
        return Response.json({ success: false, error: "Product not found" }, { status: 404, headers: NO_STORE_HEADERS });
      }
      return Response.json(
        { success: true, message: "Product updated successfully", product: result.product, dbSaved: result.dbSaved, r2Synced: result.r2Synced },
        { headers: NO_STORE_HEADERS },
      );
    } catch (error) {
      return Response.json(
        { success: false, error: "Failed to update product", detail: error instanceof Error ? error.message : "unknown" },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }
  }

  if (intent === "delete_product" || method === "DELETE") {
    const id = body.id || body.productId;
    if (!id) return Response.json({ success: false, error: "Product id required" }, { status: 400 });
    try {
      const result = await deleteProductFromDb(id, d1);
      if (!result.dbSaved) return Response.json({ success:false, error:"Product could not be deleted from D1" }, { status:503, headers:NO_STORE_HEADERS });
      return Response.json({ success: true, message: "Product deleted successfully", ...result }, { headers: NO_STORE_HEADERS });
    } catch (error) {
      return Response.json(
        { success: false, error: "Failed to delete product from database", detail: error instanceof Error ? error.message : "unknown" },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }
  }

  return Response.json({ success: false, error: `Unsupported intent: ${intent}` }, { status: 400, headers: NO_STORE_HEADERS });
}
