-- Migration 098: Smart Minimum-Order-Value A/B-Test Engine
-- Phase 194

-- A/B Tests für Mindestbestellwert-Experimente
CREATE TABLE IF NOT EXISTS mov_ab_tests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed')),
  -- Zonen-Filter (NULL = alle Zonen)
  zone_filter      TEXT[] DEFAULT NULL,           -- z.B. ['B','C'] oder NULL für alle
  -- Tageszeit-Filter (NULL = ganztags)
  hour_from        SMALLINT DEFAULT NULL CHECK (hour_from IS NULL OR (hour_from >= 0 AND hour_from <= 23)),
  hour_to          SMALLINT DEFAULT NULL CHECK (hour_to IS NULL OR (hour_to >= 0 AND hour_to <= 23)),
  start_at         TIMESTAMPTZ,
  end_at           TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Varianten eines Tests (mind. 2: Kontrolle + Variante)
CREATE TABLE IF NOT EXISTS mov_ab_variants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id          UUID NOT NULL REFERENCES mov_ab_tests(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,                 -- z.B. "Kontrolle (15€)" / "Variante A (12€)"
  is_control       BOOLEAN NOT NULL DEFAULT FALSE,
  -- MOV-Überschreibung je Zone (NULL = Zonenkonfiguration unverändert)
  mov_zone_a_eur   NUMERIC(6,2) DEFAULT NULL,
  mov_zone_b_eur   NUMERIC(6,2) DEFAULT NULL,
  mov_zone_c_eur   NUMERIC(6,2) DEFAULT NULL,
  mov_zone_d_eur   NUMERIC(6,2) DEFAULT NULL,
  allocation_pct   SMALLINT NOT NULL DEFAULT 50 CHECK (allocation_pct > 0 AND allocation_pct <= 100),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Zuweisung eines Kunden (per phone/email-Hash) zu einer Variante
CREATE TABLE IF NOT EXISTS mov_ab_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id          UUID NOT NULL REFERENCES mov_ab_tests(id) ON DELETE CASCADE,
  variant_id       UUID NOT NULL REFERENCES mov_ab_variants(id) ON DELETE CASCADE,
  customer_hash    TEXT NOT NULL,                 -- hash(phone|email)
  zone             TEXT NOT NULL,                 -- welche Zone beim Abruf
  assigned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(test_id, customer_hash)
);

-- Konversions-Events: Bestellversuch + Ergebnis
CREATE TABLE IF NOT EXISTS mov_ab_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id          UUID NOT NULL REFERENCES mov_ab_tests(id) ON DELETE CASCADE,
  variant_id       UUID NOT NULL REFERENCES mov_ab_variants(id) ON DELETE CASCADE,
  location_id      UUID NOT NULL,
  customer_hash    TEXT NOT NULL,
  zone             TEXT NOT NULL,
  hour_of_day      SMALLINT NOT NULL,
  order_total_eur  NUMERIC(8,2) NOT NULL,
  mov_applied_eur  NUMERIC(6,2) NOT NULL,         -- effektiver MOV-Wert dieser Variante
  converted        BOOLEAN NOT NULL,              -- TRUE = Bestellung abgeschlossen
  order_id         UUID,                          -- gesetzt wenn converted=TRUE
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- View: Varianten-Metriken aggregiert
CREATE OR REPLACE VIEW v_mov_ab_metrics AS
SELECT
  t.location_id,
  t.id           AS test_id,
  t.name         AS test_name,
  t.status,
  v.id           AS variant_id,
  v.name         AS variant_name,
  v.is_control,
  v.allocation_pct,
  COUNT(DISTINCT a.customer_hash)                       AS assigned_customers,
  COUNT(e.id)                                           AS total_events,
  COUNT(e.id) FILTER (WHERE e.converted)                AS conversions,
  CASE WHEN COUNT(e.id) > 0
    THEN ROUND(100.0 * COUNT(e.id) FILTER (WHERE e.converted) / COUNT(e.id), 1)
    ELSE 0
  END                                                   AS conversion_rate_pct,
  COALESCE(SUM(e.order_total_eur) FILTER (WHERE e.converted), 0)  AS revenue_eur,
  CASE WHEN COUNT(e.id) FILTER (WHERE e.converted) > 0
    THEN ROUND(SUM(e.order_total_eur) FILTER (WHERE e.converted) /
               COUNT(e.id) FILTER (WHERE e.converted), 2)
    ELSE 0
  END                                                   AS avg_order_value_eur
FROM mov_ab_tests t
JOIN mov_ab_variants v ON v.test_id = t.id
LEFT JOIN mov_ab_assignments a ON a.test_id = t.id AND a.variant_id = v.id
LEFT JOIN mov_ab_events e ON e.test_id = t.id AND e.variant_id = v.id
GROUP BY t.location_id, t.id, t.name, t.status, v.id, v.name, v.is_control, v.allocation_pct;

-- Indizes
CREATE INDEX IF NOT EXISTS idx_mov_ab_tests_location ON mov_ab_tests(location_id);
CREATE INDEX IF NOT EXISTS idx_mov_ab_assignments_test ON mov_ab_assignments(test_id, customer_hash);
CREATE INDEX IF NOT EXISTS idx_mov_ab_events_test ON mov_ab_events(test_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mov_ab_events_location ON mov_ab_events(location_id, created_at DESC);

-- updated_at-Trigger
CREATE OR REPLACE FUNCTION update_mov_ab_tests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_mov_ab_tests_updated_at ON mov_ab_tests;
CREATE TRIGGER trg_mov_ab_tests_updated_at
  BEFORE UPDATE ON mov_ab_tests
  FOR EACH ROW EXECUTE FUNCTION update_mov_ab_tests_updated_at();

-- RLS
ALTER TABLE mov_ab_tests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mov_ab_variants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mov_ab_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mov_ab_events      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full" ON mov_ab_tests       FOR ALL USING (true);
CREATE POLICY "service role full" ON mov_ab_variants    FOR ALL USING (true);
CREATE POLICY "service role full" ON mov_ab_assignments FOR ALL USING (true);
CREATE POLICY "service role full" ON mov_ab_events      FOR ALL USING (true);
