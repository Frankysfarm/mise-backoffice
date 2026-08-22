-- Migration 018: Driver Payout Engine + Financial Reports
-- Erstellt: Fahrer-Abrechnungssystem (Konfiguration, Einzelabrechnung, Periodenabschluss)
-- Multi-Tenant: alle Tabellen filtern nach location_id

-- ==============================================================
-- Payout-Konfiguration pro Location
-- ==============================================================
CREATE TABLE IF NOT EXISTS driver_payout_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  -- Basis-Vergütung pro Lieferung (€)
  base_per_delivery NUMERIC(6,2) NOT NULL DEFAULT 3.00,
  -- km-Bonus (€ pro km, nach Luftlinie zur Lieferadresse)
  km_rate         NUMERIC(5,3) NOT NULL DEFAULT 0.25,
  -- Spitzenzeiten-Bonus (Multiplikator, z.B. 1.2 = +20%)
  peak_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  -- Rating-Bonus: je 0.1 über 4.0 → +bonus_per_rating_point €
  bonus_per_rating_point NUMERIC(5,2) NOT NULL DEFAULT 0.10,
  -- Mindestrating für Bonus (kein Bonus unter diesem Rating)
  min_rating_for_bonus NUMERIC(3,1) NOT NULL DEFAULT 4.0,
  -- Meilenstein-Boni (JSON: {count: bonus_eur})
  milestone_bonuses JSONB NOT NULL DEFAULT '{"10": 2.00, "25": 5.00, "50": 10.00}'::jsonb,
  -- Zeitfenster die als Spitzenzeiten gelten (JSON-Array: [{weekday:1-7, start:"11:00", end:"14:00"}])
  peak_windows    JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Währung (ISO 4217)
  currency        VARCHAR(3) NOT NULL DEFAULT 'EUR',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(location_id)
);

-- ==============================================================
-- Einzelabrechnung pro Lieferung
-- ==============================================================
CREATE TABLE IF NOT EXISTS driver_payout_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id           UUID NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  order_id            UUID REFERENCES customer_orders(id) ON DELETE SET NULL,
  batch_id            UUID REFERENCES mise_delivery_batches(id) ON DELETE SET NULL,
  batch_stop_id       UUID REFERENCES mise_delivery_batch_stops(id) ON DELETE SET NULL,
  -- Berechnete Felder
  base_amount         NUMERIC(8,2) NOT NULL DEFAULT 0,
  km_bonus            NUMERIC(8,2) NOT NULL DEFAULT 0,
  peak_bonus          NUMERIC(8,2) NOT NULL DEFAULT 0,
  rating_bonus        NUMERIC(8,2) NOT NULL DEFAULT 0,
  milestone_bonus     NUMERIC(8,2) NOT NULL DEFAULT 0,
  total_amount        NUMERIC(8,2) NOT NULL DEFAULT 0,
  -- Kontext
  delivery_km         NUMERIC(6,2),          -- km zur Lieferadresse
  was_peak_time       BOOLEAN NOT NULL DEFAULT FALSE,
  driver_rating_at_time NUMERIC(3,1),
  deliveries_today_at_time INT,              -- wie viele Lieferungen hatte der Fahrer heute beim Abschluss
  -- Status
  period_id           UUID,                  -- wird gesetzt wenn Periode abgeschlossen
  paid_out            BOOLEAN NOT NULL DEFAULT FALSE,
  paid_out_at         TIMESTAMPTZ,
  -- Metadaten
  config_snapshot     JSONB,                 -- Snapshot der Config bei Berechnung
  completed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================
-- Perioden-Abrechnungen (tägliche / wöchentliche Zusammenfassung)
-- ==============================================================
CREATE TABLE IF NOT EXISTS driver_payout_periods (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id         UUID NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  -- Zeitraum
  period_start      TIMESTAMPTZ NOT NULL,
  period_end        TIMESTAMPTZ NOT NULL,
  period_type       VARCHAR(10) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'custom')),
  -- Aggregierte Werte
  deliveries_count  INT NOT NULL DEFAULT 0,
  total_km          NUMERIC(8,2) NOT NULL DEFAULT 0,
  total_base        NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_km_bonus    NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_peak_bonus  NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_rating_bonus NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_milestone_bonus NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_payout      NUMERIC(10,2) NOT NULL DEFAULT 0,
  avg_rating        NUMERIC(3,1),
  on_time_rate_pct  NUMERIC(5,1),
  -- Status
  status            VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
  approved_by       UUID REFERENCES auth.users(id),
  approved_at       TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================
-- Indizes
-- ==============================================================
CREATE INDEX IF NOT EXISTS idx_payout_records_driver_location
  ON driver_payout_records(driver_id, location_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_payout_records_location_period
  ON driver_payout_records(location_id, period_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_payout_records_unpaid
  ON driver_payout_records(location_id, paid_out, completed_at DESC)
  WHERE paid_out = FALSE;

CREATE INDEX IF NOT EXISTS idx_payout_periods_driver_location
  ON driver_payout_periods(driver_id, location_id, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_payout_periods_status
  ON driver_payout_periods(location_id, status, period_start DESC);

-- ==============================================================
-- DB-Funktion: Periode generieren (aggregiert Records zu Period)
-- ==============================================================
CREATE OR REPLACE FUNCTION generate_driver_period_payout(
  p_driver_id   UUID,
  p_location_id UUID,
  p_start       TIMESTAMPTZ,
  p_end         TIMESTAMPTZ,
  p_type        TEXT DEFAULT 'daily'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_period_id UUID;
  v_agg RECORD;
BEGIN
  -- Aggregiere alle Records im Zeitraum
  SELECT
    COUNT(*)::INT                    AS deliveries,
    COALESCE(SUM(delivery_km), 0)    AS total_km,
    COALESCE(SUM(base_amount), 0)    AS total_base,
    COALESCE(SUM(km_bonus), 0)       AS total_km_bonus,
    COALESCE(SUM(peak_bonus), 0)     AS total_peak_bonus,
    COALESCE(SUM(rating_bonus), 0)   AS total_rating_bonus,
    COALESCE(SUM(milestone_bonus), 0) AS total_milestone_bonus,
    COALESCE(SUM(total_amount), 0)   AS total_payout,
    ROUND(AVG(driver_rating_at_time)::NUMERIC, 1) AS avg_rating
  INTO v_agg
  FROM driver_payout_records
  WHERE driver_id = p_driver_id
    AND location_id = p_location_id
    AND completed_at >= p_start
    AND completed_at < p_end
    AND period_id IS NULL;  -- nur noch nicht zugeordnete Records

  -- Neue Period erstellen
  INSERT INTO driver_payout_periods (
    location_id, driver_id, period_start, period_end, period_type,
    deliveries_count, total_km, total_base, total_km_bonus,
    total_peak_bonus, total_rating_bonus, total_milestone_bonus, total_payout,
    avg_rating, status
  ) VALUES (
    p_location_id, p_driver_id, p_start, p_end, p_type,
    v_agg.deliveries, v_agg.total_km, v_agg.total_base, v_agg.total_km_bonus,
    v_agg.total_peak_bonus, v_agg.total_rating_bonus, v_agg.total_milestone_bonus, v_agg.total_payout,
    v_agg.avg_rating, 'draft'
  )
  RETURNING id INTO v_period_id;

  -- Records der Periode zuordnen
  UPDATE driver_payout_records
  SET period_id = v_period_id
  WHERE driver_id = p_driver_id
    AND location_id = p_location_id
    AND completed_at >= p_start
    AND completed_at < p_end
    AND period_id IS NULL;

  RETURN v_period_id;
END;
$$;

-- ==============================================================
-- View: Aktuelle Ausstehende Abrechnungen (für Admin-Dashboard)
-- ==============================================================
CREATE OR REPLACE VIEW v_pending_payouts AS
SELECT
  pp.id,
  pp.location_id,
  pp.driver_id,
  d.name AS driver_name,
  d.vehicle AS driver_vehicle,
  pp.period_type,
  pp.period_start,
  pp.period_end,
  pp.deliveries_count,
  pp.total_km,
  pp.total_payout,
  pp.avg_rating,
  pp.on_time_rate_pct,
  pp.status,
  pp.created_at
FROM driver_payout_periods pp
JOIN mise_drivers d ON d.id = pp.driver_id
WHERE pp.status IN ('draft', 'approved')
ORDER BY pp.period_start DESC;

-- ==============================================================
-- View: Tages-Abrechnung-Übersicht pro Location
-- ==============================================================
CREATE OR REPLACE VIEW v_daily_payout_summary AS
SELECT
  location_id,
  DATE(completed_at AT TIME ZONE 'Europe/Berlin') AS payout_date,
  COUNT(DISTINCT driver_id) AS active_drivers,
  COUNT(*) AS total_deliveries,
  ROUND(SUM(total_km)::NUMERIC, 1) AS total_km,
  ROUND(SUM(total_amount)::NUMERIC, 2) AS total_payout_eur,
  ROUND(AVG(total_amount)::NUMERIC, 2) AS avg_payout_per_delivery,
  ROUND(SUM(CASE WHEN was_peak_time THEN total_amount ELSE 0 END)::NUMERIC, 2) AS peak_time_payout
FROM driver_payout_records
GROUP BY location_id, DATE(completed_at AT TIME ZONE 'Europe/Berlin')
ORDER BY payout_date DESC;

-- ==============================================================
-- Default-Konfiguration sicherstellen (idempotent via ON CONFLICT)
-- ==============================================================
-- (Wird bei erster Nutzung der API automatisch erstellt)
