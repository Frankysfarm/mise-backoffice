-- Migration 036: Delivery Fee Threshold + Free-Delivery-Schwelle
--
-- Erweitert delivery_zones um die Kostenlos-Liefern-Schwelle:
-- Wenn Bestellwert >= free_delivery_above_eur, entfällt die Liefergebühr.
--
-- Außerdem neue v_delivery_fee_rules VIEW für einfaches Dashboard-Rendering.

-- ============================================================
-- 1. Neue Spalte: free_delivery_above_eur
-- ============================================================
ALTER TABLE delivery_zones
  ADD COLUMN IF NOT EXISTS free_delivery_above_eur numeric(7,2)
    CHECK (free_delivery_above_eur IS NULL OR free_delivery_above_eur > 0);

COMMENT ON COLUMN delivery_zones.free_delivery_above_eur IS
  'Kostenlos-Liefern-Schwelle in EUR. NULL = kein kostenloses Liefern für diese Zone. '
  'Wenn Bestellwert >= diesem Wert, wird surcharge_eur auf 0 reduziert.';

-- ============================================================
-- 2. Default-Werte für bestehende Zeilen (Zone A–D)
-- ============================================================
UPDATE delivery_zones SET free_delivery_above_eur = 15.00 WHERE name = 'A' AND free_delivery_above_eur IS NULL;
UPDATE delivery_zones SET free_delivery_above_eur = 25.00 WHERE name = 'B' AND free_delivery_above_eur IS NULL;
UPDATE delivery_zones SET free_delivery_above_eur = 35.00 WHERE name = 'C' AND free_delivery_above_eur IS NULL;
-- Zone D: kein kostenloses Liefern (bleibt NULL)

-- ============================================================
-- 3. v_delivery_fee_rules — convenient view for admin + fee calculator
-- ============================================================
CREATE OR REPLACE VIEW v_delivery_fee_rules AS
SELECT
  dz.id,
  dz.location_id,
  dz.name                       AS zone,
  dz.label                      AS zone_label,
  dz.color                      AS zone_color,
  dz.min_km,
  dz.max_km,
  dz.surcharge_eur,
  dz.min_order_eur,
  dz.free_delivery_above_eur,
  dz.eta_base_min,
  dz.active,
  dz.updated_at
FROM delivery_zones dz
ORDER BY dz.location_id, dz.min_km;

COMMENT ON VIEW v_delivery_fee_rules IS
  'Alle Zonen einer Location mit Gebühren-Spalten für Admin-Dashboard und Fee-Calculator.';
