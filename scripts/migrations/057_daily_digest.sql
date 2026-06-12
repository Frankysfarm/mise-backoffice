-- Migration 057: Daily Operations Digest
-- Speichert tägliche KPI-Snapshots + KI-Zusammenfassungen pro Location.

CREATE TABLE IF NOT EXISTS delivery_daily_digests (
    id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    location_id      TEXT        NOT NULL,
    digest_date      DATE        NOT NULL,
    metrics          JSONB       NOT NULL DEFAULT '{}',
    anomalies        JSONB       NOT NULL DEFAULT '[]',
    ai_summary       TEXT,
    generated_at     TIMESTAMPTZ DEFAULT now(),
    UNIQUE (location_id, digest_date)
);

CREATE INDEX IF NOT EXISTS idx_ddd_loc_date
    ON delivery_daily_digests (location_id, digest_date DESC);

ALTER TABLE delivery_daily_digests ENABLE ROW LEVEL SECURITY;

-- Policy: service-role bypasses RLS (standard pattern)
CREATE POLICY "service_full_access" ON delivery_daily_digests
    USING (true)
    WITH CHECK (true);
