-- Migration 047: loyalty_program_rules, loyalty_program_items, loyalty_redemptions

CREATE TABLE IF NOT EXISTS loyalty_program_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  min_order_value NUMERIC(10, 2),
  order_type TEXT CHECK (order_type IS NULL OR order_type IN ('lieferung', 'abholung', 'vor_ort')),
  new_customers_only BOOLEAN NOT NULL DEFAULT false,
  allowed_category_ids TEXT,
  time_windows JSONB,
  allowed_days JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(program_id, name)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_program_rules_program_id ON loyalty_program_rules(program_id);

CREATE TABLE IF NOT EXISTS loyalty_program_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES loyalty_program_rules(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  is_optional BOOLEAN NOT NULL DEFAULT true,
  max_quantity_per_redemption INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(rule_id, menu_item_id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_program_items_rule_id ON loyalty_program_items(rule_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_program_items_menu_item_id ON loyalty_program_items(menu_item_id);

CREATE TABLE IF NOT EXISTS loyalty_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  redeemed_menu_item_ids UUID[] NOT NULL,
  kunde_email TEXT NOT NULL,
  kunde_telefon TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_program_id ON loyalty_redemptions(program_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_order_id ON loyalty_redemptions(order_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_customer ON loyalty_redemptions(kunde_email, kunde_telefon, redeemed_at);
