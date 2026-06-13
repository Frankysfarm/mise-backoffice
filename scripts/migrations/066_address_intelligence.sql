-- Migration 066: Smart Customer Address Intelligence & Delivery Notes Engine
-- Speichert Zustellpräferenzen pro Kunde+Adresse und trackt Problem-Adressen.

-- ============================================================
-- customer_address_preferences
-- Kundenpräferenzen für spezifische Lieferadressen
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_address_preferences (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id          UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  customer_email       TEXT NOT NULL,
  -- address_hash: SHA-256 der normalisierten Adresse (hex, erste 32 Zeichen)
  address_hash         TEXT NOT NULL,
  -- Menschenlesbares Label ("Zuhause", "Arbeit", etc.)
  address_label        TEXT,
  -- Rohe Adresse zur Anzeige
  address_display      TEXT,
  -- Zustellpräferenzen
  ring_bell            BOOLEAN NOT NULL DEFAULT TRUE,
  leave_at_door        BOOLEAN NOT NULL DEFAULT FALSE,
  floor                TEXT,         -- z.B. "3. OG"
  apartment            TEXT,         -- z.B. "Apartment 4b"
  gate_code            TEXT,         -- Türcode / Zugangscode
  building_info        TEXT,         -- z.B. "Rotes Gebäude, Hintereingang"
  special_instructions TEXT,         -- Freitext-Anweisung
  use_count            INT NOT NULL DEFAULT 1,  -- wie oft wurde diese Adresse beliefert
  last_used_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, customer_email, address_hash)
);

CREATE INDEX IF NOT EXISTS idx_cap_location_email
  ON customer_address_preferences (location_id, customer_email);
CREATE INDEX IF NOT EXISTS idx_cap_hash
  ON customer_address_preferences (location_id, address_hash);

ALTER TABLE customer_address_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON customer_address_preferences
  USING (auth.role() = 'service_role');

-- ============================================================
-- delivery_address_issues
-- Problem-Adressen Log (schwierig zu beliefern, falsche Adresse, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_address_issues (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  address_hash   TEXT NOT NULL,
  address_display TEXT,            -- menschenlesbare Adresse zur Anzeige
  order_id       UUID REFERENCES customer_orders(id) ON DELETE SET NULL,
  driver_id      UUID,             -- welcher Fahrer hat das Problem gemeldet
  issue_type     TEXT NOT NULL CHECK (issue_type IN (
    'unreachable',    -- Adresse nicht erreichbar
    'wrong_address',  -- Adresse existiert nicht / falsch
    'no_answer',      -- Niemand geöffnet
    'access_denied',  -- Kein Zugang (Tor gesperrt, etc.)
    'unsafe',         -- Sicherheitsbedenken
    'other'
  )),
  driver_notes   TEXT,
  resolved       BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dai_location_hash
  ON delivery_address_issues (location_id, address_hash);
CREATE INDEX IF NOT EXISTS idx_dai_location_created
  ON delivery_address_issues (location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dai_order
  ON delivery_address_issues (order_id) WHERE order_id IS NOT NULL;

ALTER TABLE delivery_address_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON delivery_address_issues
  USING (auth.role() = 'service_role');

-- ============================================================
-- v_problematic_addresses
-- Adressen mit ≥ 2 ungelösten Issues in den letzten 90 Tagen
-- ============================================================
CREATE OR REPLACE VIEW v_problematic_addresses AS
SELECT
  location_id,
  address_hash,
  MAX(address_display)                         AS address_display,
  COUNT(*)                                     AS issue_count,
  COUNT(DISTINCT order_id)                     AS affected_orders,
  ARRAY_AGG(DISTINCT issue_type ORDER BY issue_type) AS issue_types,
  MAX(created_at)                              AS last_issue_at,
  MIN(created_at)                              AS first_issue_at
FROM delivery_address_issues
WHERE
  created_at >= NOW() - INTERVAL '90 days'
  AND resolved = FALSE
GROUP BY location_id, address_hash
HAVING COUNT(*) >= 2
ORDER BY issue_count DESC;

-- ============================================================
-- v_address_intelligence_stats
-- KPI-Übersicht pro Location
-- ============================================================
CREATE OR REPLACE VIEW v_address_intelligence_stats AS
SELECT
  l.id                                                    AS location_id,
  COUNT(DISTINCT cap.address_hash)                        AS total_saved_addresses,
  COUNT(DISTINCT dai.address_hash) FILTER (
    WHERE dai.created_at >= NOW() - INTERVAL '90 days'
    AND dai.resolved = FALSE
  )                                                       AS problematic_addresses,
  COUNT(dai.id) FILTER (
    WHERE dai.created_at >= NOW() - INTERVAL '24 hours'
  )                                                       AS issues_today,
  COUNT(dai.id) FILTER (
    WHERE dai.created_at >= NOW() - INTERVAL '7 days'
  )                                                       AS issues_this_week,
  COUNT(DISTINCT cap.customer_email)                      AS customers_with_prefs,
  ROUND(
    100.0 * COUNT(DISTINCT cap.address_hash) FILTER (
      WHERE cap.ring_bell = FALSE OR cap.leave_at_door = TRUE
        OR cap.gate_code IS NOT NULL OR cap.floor IS NOT NULL
    ) / NULLIF(COUNT(DISTINCT cap.address_hash), 0)
  , 1)                                                    AS pct_with_special_instructions
FROM locations l
LEFT JOIN customer_address_preferences cap ON cap.location_id = l.id
LEFT JOIN delivery_address_issues      dai ON dai.location_id = l.id
GROUP BY l.id;
