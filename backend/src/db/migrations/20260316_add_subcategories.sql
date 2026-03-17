-- Subcategories: add parent_id to categories (self-join) and subcategory_id to products

-- 1. Add parent_id to categories table
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- 2. Add subcategory_id to products table (nullable)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_products_subcategory_id ON products(subcategory_id);
