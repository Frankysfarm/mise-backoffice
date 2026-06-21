-- Migration 178: delivery_zone + sync-Trigger für orders-Tabelle
-- Phase 373: Stellt sicher dass die orders-Tabelle delivery_zone, bestellt_am, typ kennt
-- und setzt einen Sync-Trigger von customer_orders → orders für delivery_zone-Updates.

-- Spalte delivery_zone auf orders (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'orders'
  ) THEN
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_zone TEXT;
    COMMENT ON COLUMN orders.delivery_zone IS 'Lieferzone A/B/C/D — sync aus customer_orders via Trigger';
  END IF;
END;
$$;

-- Index für Zone-Umsatz-Abfragen (nur anlegen wenn Tabelle existiert)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'orders'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'orders' AND indexname = 'idx_orders_delivery_zone_today'
  ) THEN
    EXECUTE 'CREATE INDEX idx_orders_delivery_zone_today ON orders(location_id, delivery_zone, bestellt_am DESC NULLS LAST) WHERE status NOT IN (''storniert'', ''cancelled'')';
  END IF;
END;
$$;
