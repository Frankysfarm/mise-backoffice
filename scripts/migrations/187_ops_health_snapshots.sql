-- 187_ops_health_snapshots.sql
-- Phase 392 Backend: Stündliche Ops-Health-Snapshots für Trend-Analyse
-- Persistiert KPIs aus dem Ops-Snapshot-Endpoint alle 15 Min für historische Auswertung.

CREATE TABLE IF NOT EXISTS ops_health_snapshots (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           UUID        NOT NULL REFERENCES mise_locations(id) ON DELETE CASCADE,
  snapped_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Queue
  queue_total           SMALLINT    NOT NULL DEFAULT 0,
  queue_neu             SMALLINT    NOT NULL DEFAULT 0,
  queue_zubereitung     SMALLINT    NOT NULL DEFAULT 0,
  queue_bereit          SMALLINT    NOT NULL DEFAULT 0,
  queue_unterwegs       SMALLINT    NOT NULL DEFAULT 0,

  -- Fahrer
  drivers_online        SMALLINT    NOT NULL DEFAULT 0,
  drivers_idle          SMALLINT    NOT NULL DEFAULT 0,
  drivers_active        SMALLINT    NOT NULL DEFAULT 0,
  drivers_offline       SMALLINT    NOT NULL DEFAULT 0,

  -- Alerts
  alerts_critical       SMALLINT    NOT NULL DEFAULT 0,
  alerts_warning        SMALLINT    NOT NULL DEFAULT 0,
  alerts_total          SMALLINT    NOT NULL DEFAULT 0,

  -- SLA
  sla_on_time_pct       SMALLINT,               -- 0–100, NULL wenn keine Daten
  sla_avg_deviation_min SMALLINT,

  -- Throughput
  throughput_per_hour   SMALLINT    NOT NULL DEFAULT 0,  -- extrapoliert

  -- Delays
  delays_active         SMALLINT    NOT NULL DEFAULT 0,

  -- Revenue (heute bis jetzt)
  revenue_today_eur     NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Abgeleiteter Gesundheits-Score 0–100
  health_score          SMALLINT    NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index: Trend-Abfragen nach Location + Zeit
CREATE INDEX IF NOT EXISTS idx_ops_health_location_time
  ON ops_health_snapshots (location_id, snapped_at DESC);

-- Index: Cleanup alter Einträge
CREATE INDEX IF NOT EXISTS idx_ops_health_created_at
  ON ops_health_snapshots (created_at);

-- RLS
ALTER TABLE ops_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_ops_health" ON ops_health_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_own_ops_health" ON ops_health_snapshots
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM user_location_access WHERE user_id = auth.uid()
    )
  );

-- Cleanup-Funktion: Snapshots älter als N Tage löschen
CREATE OR REPLACE FUNCTION prune_ops_health_snapshots(days_to_keep INT DEFAULT 90)
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM ops_health_snapshots
  WHERE created_at < now() - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View: Stündliche Aggregation der letzten 48h (für Trend-Charts)
CREATE OR REPLACE VIEW v_ops_health_hourly AS
SELECT
  location_id,
  date_trunc('hour', snapped_at) AS hour_bucket,
  ROUND(AVG(health_score))::SMALLINT          AS avg_health_score,
  ROUND(AVG(queue_total))::SMALLINT           AS avg_queue_total,
  ROUND(AVG(drivers_online))::SMALLINT        AS avg_drivers_online,
  ROUND(AVG(sla_on_time_pct))::SMALLINT       AS avg_sla_on_time_pct,
  ROUND(AVG(throughput_per_hour))::SMALLINT   AS avg_throughput_per_hour,
  MAX(alerts_critical)                         AS max_alerts_critical,
  COUNT(*)                                     AS snapshot_count
FROM ops_health_snapshots
WHERE snapped_at >= now() - INTERVAL '48 hours'
GROUP BY location_id, date_trunc('hour', snapped_at)
ORDER BY location_id, hour_bucket DESC;
