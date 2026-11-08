-- Teen Liwa v2 initial schema for the dedicated Cloudflare D1 database.
-- Money values are integer fils (AED 10.50 = 1050). Never store API secrets here.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_ar TEXT,
  name_en TEXT,
  slug TEXT NOT NULL COLLATE NOCASE UNIQUE,
  description TEXT,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER,
  sku TEXT COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  name_en TEXT,
  slug TEXT NOT NULL COLLATE NOCASE UNIQUE,
  description TEXT,
  price_fils INTEGER NOT NULL CHECK (price_fils >= 0),
  compare_at_price_fils INTEGER CHECK (compare_at_price_fils IS NULL OR compare_at_price_fils >= price_fils),
  image_url TEXT,
  unit TEXT NOT NULL DEFAULT 'item',
  origin TEXT,
  harvest_date TEXT,
  season TEXT,
  tag TEXT,
  badge TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0,1)),
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0,1)),
  track_inventory INTEGER NOT NULL DEFAULT 0 CHECK (track_inventory IN (0,1)),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  minimum_order_quantity INTEGER NOT NULL DEFAULT 1 CHECK (minimum_order_quantity >= 1),
  maximum_order_quantity INTEGER NOT NULL DEFAULT 50 CHECK (maximum_order_quantity >= minimum_order_quantity),
  details_json TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL COLLATE NOCASE UNIQUE,
  email TEXT COLLATE NOCASE,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_spent_fils INTEGER NOT NULL DEFAULT 0 CHECK (total_spent_fils >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS customer_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  label TEXT,
  emirate TEXT NOT NULL,
  area TEXT,
  address_line TEXT NOT NULL,
  building TEXT,
  apartment TEXT,
  delivery_notes TEXT,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS delivery_zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zone_code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  emirate TEXT NOT NULL,
  area TEXT,
  delivery_fee_fils INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_fils >= 0),
  free_delivery_threshold_fils INTEGER CHECK (free_delivery_threshold_fils IS NULL OR free_delivery_threshold_fils >= 0),
  estimated_days INTEGER NOT NULL DEFAULT 1 CHECK (estimated_days >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL COLLATE NOCASE UNIQUE,
  tracking_token_hash TEXT COLLATE NOCASE UNIQUE,
  customer_id INTEGER,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  emirate TEXT NOT NULL,
  area TEXT,
  address_line TEXT NOT NULL,
  building TEXT,
  apartment TEXT,
  delivery_notes TEXT,
  delivery_zone_id INTEGER,
  delivery_zone_name TEXT,
  subtotal_fils INTEGER NOT NULL CHECK (subtotal_fils >= 0),
  delivery_fee_fils INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_fils >= 0),
  discount_fils INTEGER NOT NULL DEFAULT 0 CHECK (discount_fils >= 0),
  tax_fils INTEGER NOT NULL DEFAULT 0 CHECK (tax_fils >= 0),
  total_fils INTEGER NOT NULL CHECK (total_fils >= 0),
  currency TEXT NOT NULL DEFAULT 'AED' CHECK (length(currency) = 3),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cod','ziina','card_on_delivery','whatsapp')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','processing','paid','failed','cancelled','refunded','partially_refunded')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','awaiting_payment','confirmed','processing','shipped','delivered','cancelled','refunded')),
  customer_notes TEXT,
  gift_note TEXT,
  source TEXT NOT NULL DEFAULT 'web_store',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  CHECK (discount_fils <= subtotal_fils + delivery_fee_fils + tax_fils),
  CHECK (total_fils = subtotal_fils + delivery_fee_fils + tax_fils - discount_fils),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (delivery_zone_id) REFERENCES delivery_zones(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER,
  product_sku TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'item',
  unit_price_fils INTEGER NOT NULL CHECK (unit_price_fils >= 0),
  total_price_fils INTEGER NOT NULL CHECK (total_price_fils >= 0),
  options_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (total_price_fils = unit_price_fils * quantity),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('ziina')),
  provider_payment_id TEXT,
  provider_transaction_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  amount_fils INTEGER NOT NULL CHECK (amount_fils >= 0),
  currency TEXT NOT NULL DEFAULT 'AED' CHECK (length(currency) = 3),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed','cancelled','refunded','partially_refunded')),
  redirect_url TEXT,
  failure_code TEXT,
  failure_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  UNIQUE (provider, provider_payment_id)
);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payment_id INTEGER,
  signature_verified INTEGER NOT NULL DEFAULT 0 CHECK (signature_verified IN (0,1)),
  processing_status TEXT NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received','processing','processed','failed','ignored')),
  payload_sha256 TEXT,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  UNIQUE (provider, provider_event_id),
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
  reason TEXT NOT NULL CHECK (reason IN ('initial_stock','restock','sale','cancellation','return','adjustment')),
  order_id INTEGER,
  note TEXT,
  actor_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  actor_id TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner','admin','manager','support')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER NOT NULL,
  session_token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS store_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketing_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  emirate TEXT,
  source_campaign TEXT,
  interested_product TEXT,
  quantity_estimated TEXT,
  budget_fils INTEGER CHECK (budget_fils IS NULL OR budget_fils >= 0),
  lead_status TEXT NOT NULL DEFAULT 'new' CHECK (lead_status IN ('new','contacted','qualified','won','lost')),
  ai_score TEXT CHECK (ai_score IS NULL OR ai_score IN ('high','medium','low')),
  ai_summary TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cms_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO categories (name, name_ar, name_en, slug, sort_order) VALUES
  ('الرطب', 'الرطب', 'Rutab', 'rutab', 1),
  ('التين', 'التين', 'Figs', 'fig', 2),
  ('الفقع', 'الفقع', 'Truffles', 'faqa', 3),
  ('الصناديق', 'الصناديق', 'Gift Boxes', 'boxes', 4),
  ('التمور', 'التمور', 'Dates', 'dates', 5),
  ('المكسرات', 'المكسرات', 'Nuts', 'nuts', 6),
  ('الفقع', 'الفقع', 'Truffle', 'truffle', 7),
  ('الفواكه', 'الفواكه', 'Fruits', 'fruits', 8);

CREATE INDEX IF NOT EXISTS idx_categories_active_sort ON categories(is_active, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_category_listing ON products(category_id, is_active, is_available, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured, sort_order) WHERE deleted_at IS NULL AND is_active = 1 AND is_available = 1;
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON customer_addresses(customer_id, is_default DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_lookup ON delivery_zones(emirate, area, is_active);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_payment_status_created ON orders(payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_created ON orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone_created ON orders(customer_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_created ON payments(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_processing ON payment_webhook_events(processing_status, received_at);
CREATE INDEX IF NOT EXISTS idx_inventory_product_created ON inventory_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_order ON inventory_movements(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_expiry ON admin_sessions(admin_user_id, expires_at) WHERE revoked_at IS NULL;
