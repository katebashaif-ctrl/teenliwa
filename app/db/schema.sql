-- Migration: 0001_create_orders_tables.sql
-- Description: Unified orders, order_items, and customers tables for Teen Liwa Store

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  tracking_number TEXT NOT NULL UNIQUE,
  order_number TEXT,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  phone TEXT,
  customer_phone TEXT,
  emirate TEXT,
  customer_emirate TEXT,
  address TEXT,
  customer_address TEXT,
  items TEXT,
  items_json TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  delivery_fee REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cod',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  gift_note TEXT,
  source TEXT NOT NULL DEFAULT 'web_store',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price REAL NOT NULL,
  unit TEXT NOT NULL,
  packaging_option TEXT,
  total_price REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT,
  phone TEXT PRIMARY KEY,
  name TEXT,
  fname TEXT,
  lname TEXT,
  emirate TEXT,
  address TEXT,
  last_address TEXT,
  total_orders INTEGER NOT NULL DEFAULT 1,
  total_spent REAL NOT NULL DEFAULT 0,
  last_order_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_order_tracking TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
