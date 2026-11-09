import type { Product } from "../types/store";
import { fromFils, toFils, type D1DatabaseLike } from "./d1";

type ProductRow = Record<string, any>;

function safeJson(value: unknown): Record<string, any> {
  if (typeof value !== "string") return value && typeof value === "object" ? value as Record<string, any> : {};
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" ? parsed : {}; } catch { return {}; }
}

function slugify(value: string): string {
  const slug = value.normalize("NFKC").toLowerCase().trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
  return (slug || "product") + "-" + Date.now().toString(36);
}

function mapRow(row: ProductRow): Product {
  const details = safeJson(row.details_json);
  const tracked = Number(row.track_inventory) === 1;
  const stockQuantity = Number(row.stock_quantity || 0);
  const active = Number(row.is_active) === 1;
  const configuredAvailable = Number(row.is_available) === 1;
  const available = configuredAvailable && (!tracked || stockQuantity > 0);
  return {
    ...details,
    id: String(row.id),
    sku: row.sku || undefined,
    name: String(row.name || ""),
    nameEn: row.name_en || details.nameEn || row.name,
    category: (row.category_slug || details.category || "rutab") as Product["category"],
    price: fromFils(row.price_fils),
    originalPrice: row.compare_at_price_fils == null ? undefined : fromFils(row.compare_at_price_fils),
    unit: row.unit || details.unit || "item",
    origin: row.origin || details.origin || "",
    harvestDate: row.harvest_date || details.harvestDate || "",
    season: row.season || details.season || "",
    image: row.image_url || details.image || "",
    description: row.description || details.description || "",
    desc: details.desc,
    tag: row.tag || details.tag,
    badge: row.badge || details.badge,
    minQty: Number(row.minimum_order_quantity || 1),
    maxQty: Number(row.maximum_order_quantity || 50),
    disabled: active && configuredAvailable ? 0 : 1,
    disabledTxt: details.disabledTxt || (available ? "متوفر" : "غير متوفر"),
    created_at: row.created_at,
    tastingNotes: Array.isArray(details.tastingNotes) ? details.tastingNotes : [],
    storageInstructions: details.storageInstructions || "",
    inStock: active && available,
    stockQuantity: tracked ? stockQuantity : undefined,
    trackInventory: tracked,
    isActive: active,
    isAvailable: configuredAvailable,
    sortOrder: Number(row.sort_order || 0),
    featured: Number(row.is_featured) === 1,
  } as Product;
}

async function getCategoryId(db: D1DatabaseLike, category: string): Promise<number | null> {
  const slug = String(category || "rutab").trim().toLowerCase();
  await db.prepare(
    "INSERT OR IGNORE INTO categories (name, name_en, slug, sort_order) VALUES (?, ?, ?, 0)"
  ).bind(slug, slug, slug).run();
  const row = await db.prepare("SELECT id FROM categories WHERE slug = ? AND deleted_at IS NULL LIMIT 1")
    .bind(slug).first<{ id: number }>();
  return row ? Number(row.id) : null;
}

async function getProductById(db: D1DatabaseLike, id: string): Promise<Product | null> {
  const row = await db.prepare(`
    SELECT p.*, c.slug AS category_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.id = ? AND p.deleted_at IS NULL
    LIMIT 1
  `).bind(Number(id)).first<ProductRow>();
  return row ? mapRow(row) : null;
}

export async function initializeProductsSchema(db: D1DatabaseLike): Promise<boolean> {
  try {
    await db.prepare("SELECT id, price_fils, details_json FROM products LIMIT 1").first();
    await db.prepare("SELECT id, slug FROM categories LIMIT 1").first();
    return true;
  } catch (error) {
    console.error("Teen Liwa v2 product schema is not installed. Apply migrations-v2 first.", error);
    return false;
  }
}

/** D1 is the only catalogue source of truth. R2 is used for image objects, not product records. */
export async function getProductsFromDb(
  db?: D1DatabaseLike,
  includeInactive = false,
): Promise<{ products: Product[]; storageType: "d1_database" | "memory_cache" }> {
  if (!db) return { products: [], storageType: "memory_cache" };
  const where = includeInactive
    ? "p.deleted_at IS NULL"
    : "p.deleted_at IS NULL AND p.is_active = 1";
  const { results } = await db.prepare(`
    SELECT p.*, c.slug AS category_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE ${where}
    ORDER BY p.sort_order ASC, p.created_at DESC
  `).bind().all<ProductRow>();
  return { products: (results || []).map(mapRow), storageType: "d1_database" };
}

function detailsFor(product: Product): string {
  const details: Record<string, unknown> = {
    nameEn: product.nameEn,
    harvestDate: product.harvestDate,
    season: product.season,
    tastingNotes: product.tastingNotes,
    storageInstructions: product.storageInstructions,
    desc: product.desc,
    disabledTxt: product.disabledTxt,
  };
  return JSON.stringify(details);
}

function positiveInteger(value: unknown, fallback: number, label: string): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive whole number`);
  }
  return parsed;
}

function nonNegativeInteger(value: unknown, fallback: number, label: string): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative whole number`);
  }
  return parsed;
}

async function assertSkuAvailable(db: D1DatabaseLike, sku: string | null, exceptId?: string): Promise<void> {
  if (!sku) return;
  const row = exceptId
    ? await db.prepare("SELECT id FROM products WHERE lower(sku) = lower(?) AND id <> ? LIMIT 1")
        .bind(sku, Number(exceptId)).first<{ id: number }>()
    : await db.prepare("SELECT id FROM products WHERE lower(sku) = lower(?) LIMIT 1")
        .bind(sku).first<{ id: number }>();
  if (row) throw new Error("رمز SKU مستخدم مسبقاً. أدخل رمزاً فريداً لهذا المنتج.");
}

export async function createProductInDb(
  input: Product,
  db: D1DatabaseLike,
): Promise<{ product: Product; dbSaved: boolean; r2Synced: boolean }> {
  const name = String(input?.name || "").trim();
  if (!name) throw new Error("اسم المنتج مطلوب.");
  if (name.length > 200) throw new Error("اسم المنتج يجب ألا يتجاوز 200 حرف.");

  const priceFils = toFils(Number(input.price));
  const compareAt = input.originalPrice == null || input.originalPrice === ("" as any)
    ? null
    : toFils(Number(input.originalPrice));
  if (compareAt != null && compareAt < priceFils) {
    throw new Error("السعر قبل الخصم يجب أن يكون أكبر من أو مساوياً للسعر الحالي.");
  }

  const sku = String(input.sku || "").trim() || null;
  await assertSkuAvailable(db, sku);
  const minimumOrderQuantity = positiveInteger(input.minQty, 1, "Minimum order quantity");
  const maximumOrderQuantity = positiveInteger(input.maxQty, 50, "Maximum order quantity");
  if (maximumOrderQuantity < minimumOrderQuantity) {
    throw new Error("الحد الأقصى للطلب يجب أن يكون أكبر من أو مساوياً للحد الأدنى.");
  }

  const tracked = input.trackInventory === true ||
    (input.trackInventory === undefined && input.stockQuantity !== undefined);
  const stock = tracked ? nonNegativeInteger(input.stockQuantity, 0, "Stock quantity") : 0;
  const active = input.isActive !== undefined
    ? (input.isActive ? 1 : 0)
    : input.disabled === 1 ? 0 : 1;
  const available = input.isAvailable !== undefined
    ? (input.isAvailable ? 1 : 0)
    : input.inStock === false ? 0 : 1;
  const categoryId = await getCategoryId(db, String(input.category || "rutab"));
  const slug = slugify(name);

  const inserted = await db.prepare(`
    INSERT INTO products (
      category_id, sku, name, name_en, slug, description, price_fils, compare_at_price_fils,
      image_url, unit, origin, harvest_date, season, tag, badge, is_active,
      is_available, is_featured, track_inventory, stock_quantity,
      minimum_order_quantity, maximum_order_quantity, details_json, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).bind(
    categoryId, sku, name, String(input.nameEn || "").trim() || null, slug,
    String(input.description || "").trim(), priceFils, compareAt,
    String(input.image || "").trim() || null, String(input.unit || "").trim() || "item",
    String(input.origin || "").trim() || null, String(input.harvestDate || "").trim() || null,
    String(input.season || "").trim() || null, String(input.tag || "").trim() || null,
    String(input.badge || "").trim() || null, active, available,
    input.featured ? 1 : 0, tracked ? 1 : 0, stock,
    minimumOrderQuantity, maximumOrderQuantity, detailsFor(input),
    nonNegativeInteger(input.sortOrder, 0, "Sort order")
  ).first<{ id: number }>();

  if (!inserted?.id) throw new Error("Product insert did not return an id");

  const product = await getProductById(db, String(inserted.id));
  if (!product) throw new Error("Product was inserted but could not be reloaded");

  if (tracked && stock > 0) {
    await db.prepare(`
      INSERT INTO inventory_movements (product_id, product_name, quantity_delta, reason, note)
      VALUES (?, ?, ?, 'initial_stock', 'Initial stock from CMS')
    `).bind(Number(inserted.id), product.name, stock).run();
  }
  return { product, dbSaved: true, r2Synced: false };
}

export async function updateProductInDb(
  id: string,
  updates: Partial<Product>,
  db: D1DatabaseLike,
): Promise<{ product: Product | null; dbSaved: boolean; r2Synced: boolean }> {
  const existing = await getProductById(db, id);
  if (!existing) return { product: null, dbSaved: false, r2Synced: false };

  const updated: Product = { ...existing, ...updates, id: existing.id };
  const name = String(updated.name || "").trim();
  if (!name) throw new Error("اسم المنتج مطلوب.");
  if (name.length > 200) throw new Error("اسم المنتج يجب ألا يتجاوز 200 حرف.");

  const priceFils = toFils(Number(updated.price));
  const compareAt = updated.originalPrice == null
    ? null
    : toFils(Number(updated.originalPrice));
  if (compareAt != null && compareAt < priceFils) {
    throw new Error("السعر قبل الخصم يجب أن يكون أكبر من أو مساوياً للسعر الحالي.");
  }

  const sku = String(updated.sku || "").trim() || null;
  await assertSkuAvailable(db, sku, id);
  const minimumOrderQuantity = positiveInteger(updated.minQty, 1, "Minimum order quantity");
  const maximumOrderQuantity = positiveInteger(updated.maxQty, 50, "Maximum order quantity");
  if (maximumOrderQuantity < minimumOrderQuantity) {
    throw new Error("الحد الأقصى للطلب يجب أن يكون أكبر من أو مساوياً للحد الأدنى.");
  }

  const wasTracked = existing.trackInventory === true;
  const tracked = updates.trackInventory !== undefined
    ? updates.trackInventory === true
    : updates.stockQuantity !== undefined ? true : wasTracked;
  const stockInput = updates.stockQuantity !== undefined
    ? updates.stockQuantity
    : wasTracked ? existing.stockQuantity : 0;
  const stock = tracked ? nonNegativeInteger(stockInput, 0, "Stock quantity") : 0;
  const previousTrackedStock = wasTracked
    ? nonNegativeInteger(existing.stockQuantity, 0, "Previous stock quantity")
    : 0;
  const stockDelta = (tracked ? stock : 0) - previousTrackedStock;

  const active = updates.isActive !== undefined
    ? (updates.isActive ? 1 : 0)
    : updates.disabled !== undefined
      ? (updates.disabled === 1 ? 0 : 1)
      : (existing.isActive !== false ? 1 : 0);
  const available = updates.isAvailable !== undefined
    ? (updates.isAvailable ? 1 : 0)
    : updates.inStock !== undefined
      ? (updates.inStock ? 1 : 0)
      : (existing.isAvailable !== false ? 1 : 0);
  const categoryId = await getCategoryId(db, String(updated.category || "rutab"));

  await db.prepare(`
    UPDATE products SET
      category_id = ?, sku = ?, name = ?, name_en = ?, description = ?, price_fils = ?,
      compare_at_price_fils = ?, image_url = ?, unit = ?, origin = ?, harvest_date = ?,
      season = ?, tag = ?, badge = ?, is_active = ?, is_available = ?, is_featured = ?,
      track_inventory = ?, stock_quantity = ?, minimum_order_quantity = ?,
      maximum_order_quantity = ?, details_json = ?, sort_order = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND deleted_at IS NULL
  `).bind(
    categoryId, sku, name, String(updated.nameEn || "").trim() || null,
    String(updated.description || "").trim(), priceFils, compareAt,
    String(updated.image || "").trim() || null, String(updated.unit || "").trim() || "item",
    String(updated.origin || "").trim() || null, String(updated.harvestDate || "").trim() || null,
    String(updated.season || "").trim() || null, String(updated.tag || "").trim() || null,
    String(updated.badge || "").trim() || null, active, available,
    updated.featured ? 1 : 0, tracked ? 1 : 0, stock,
    minimumOrderQuantity, maximumOrderQuantity, detailsFor(updated),
    nonNegativeInteger(updated.sortOrder, 0, "Sort order"), Number(id)
  ).run();

  if (stockDelta !== 0) {
    await db.prepare(`
      INSERT INTO inventory_movements (product_id, product_name, quantity_delta, reason, note)
      VALUES (?, ?, ?, 'adjustment', 'Stock adjusted from CMS')
    `).bind(Number(id), name.slice(0, 200), stockDelta).run();
  }
  return { product: await getProductById(db, id), dbSaved: true, r2Synced: false };
}

export async function deleteProductFromDb(
  id: string,
  db: D1DatabaseLike,
): Promise<{ deleted: boolean; dbSaved: boolean; r2Synced: boolean }> {
  const result: any = await db.prepare(`
    UPDATE products SET is_active = 0, is_available = 0,
      deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND deleted_at IS NULL
  `).bind(Number(id)).run();
  const changes = Number(result?.meta?.changes ?? result?.meta?.rows_written ?? 0);
  return { deleted: changes > 0, dbSaved: changes > 0, r2Synced: false };
}

export async function clearAllProductsInDb(
  db: D1DatabaseLike,
): Promise<{ cleared: boolean; dbSaved: boolean; r2Synced: boolean }> {
  await db.prepare(`
    UPDATE products SET is_active = 0, is_available = 0,
      deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE deleted_at IS NULL
  `).run();
  return { cleared: true, dbSaved: true, r2Synced: false };
}
