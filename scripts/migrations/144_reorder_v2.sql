-- 144_reorder_v2.sql
-- Phase 302 — Smart-Reorder-Engine V2 mit Saisonalität
--
-- Erweitert das Reorder-System um:
--   - Wochentagsmuster (wann bestellt ein Kunde typischerweise?)
--   - Saisonale Boost-Faktoren (Monate mit höherer Bestellfrequenz)
--   - Artikel-Affinität (welche Artikel werden oft zusammen bestellt?)
--   - Recency-gewichtetes Scoring

-- ── V2-Erweiterte Reorder-Profile ─────────────────────────────────────────────
-- Erweitert customer_reorder_profiles um V2-Felder (ALTER-safe: neue Spalten)
ALTER TABLE customer_reorder_profiles
  ADD COLUMN IF NOT EXISTS hour_pattern      JSONB DEFAULT '{}',
  -- {"0": 0, "1": 0, ..., "23": 5} — Bestellanzahl je Stunde (0–23 UTC)
  ADD COLUMN IF NOT EXISTS day_pattern       JSONB DEFAULT '{}',
  -- {"0": 0, ..., "6": 3} — Bestellanzahl je Wochentag (0=Sonntag)
  ADD COLUMN IF NOT EXISTS month_pattern     JSONB DEFAULT '{}',
  -- {"1": 0, ..., "12": 8} — Bestellanzahl je Monat
  ADD COLUMN IF NOT EXISTS top_combos        JSONB DEFAULT '[]',
  -- [{items: ["Döner", "Cola"], count: 4}] — häufige Kombos
  ADD COLUMN IF NOT EXISTS recency_score     NUMERIC(4,2),
  -- 0–1: 1.0 = letzte Bestellung < 7 Tage, 0.0 = > 90 Tage
  ADD COLUMN IF NOT EXISTS v2_computed_at    TIMESTAMPTZ;

-- ── Saisonale Standort-Muster (Aggregiert je Location + Monat) ────────────────
CREATE TABLE IF NOT EXISTS location_seasonal_patterns (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  month            SMALLINT    NOT NULL CHECK (month BETWEEN 1 AND 12),
  year             SMALLINT    NOT NULL,
  total_orders     INT         NOT NULL DEFAULT 0,
  total_revenue    NUMERIC(12,2) NOT NULL DEFAULT 0,
  avg_daily_orders NUMERIC(6,1),
  top_items        JSONB       NOT NULL DEFAULT '[]', -- [{name, count}] Top-10
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_lsp_location ON location_seasonal_patterns(location_id);
CREATE INDEX IF NOT EXISTS idx_lsp_month    ON location_seasonal_patterns(location_id, month);

ALTER TABLE location_seasonal_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lsp_admin_rls" ON location_seasonal_patterns
  USING (location_id IN (
    SELECT location_id FROM employees WHERE user_id = auth.uid()
  ));

-- ── V2-Score-View: Kombiniert Aktualität + Frequenz + Saison ─────────────────
-- Gibt je Customer-Profil einen Score 0–100 für "wie aktiv/wertvoll"
CREATE OR REPLACE VIEW v_reorder_v2_scores AS
SELECT
  crp.id,
  crp.location_id,
  crp.customer_phone,
  crp.customer_name,
  crp.total_orders,
  crp.total_spent_eur,
  crp.last_order_at,
  crp.preferred_hour,
  crp.top_items,
  crp.hour_pattern,
  crp.day_pattern,
  crp.month_pattern,
  crp.top_combos,
  crp.recency_score,
  -- Composite V2 Score (0–100):
  --   40% Frequenz-Score  (Anzahl Bestellungen, capped bei 20)
  --   30% Recency-Score   (1.0 = frisch, 0 = alt)
  --   30% Wert-Score      (total_spent_eur, capped bei 500)
  ROUND(
    LEAST(crp.total_orders::NUMERIC / 20.0, 1.0) * 40
    + COALESCE(crp.recency_score, 0) * 30
    + LEAST(crp.total_spent_eur / 500.0, 1.0) * 30
  , 1) AS v2_score,
  crp.v2_computed_at
FROM customer_reorder_profiles crp;
