-- Migration 261: Fahrer-Reaktionszeit + Kochzeit-Genauigkeit
-- Phase 1742–1746 (2026-07-15)

-- Reaktionszeit-Log je Fahrer (Dispatch → Tour-Start)
CREATE TABLE IF NOT EXISTS fahrer_reaktionszeit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL,
    driver_id       UUID NOT NULL,
    batch_id        UUID,
    dispatch_at     TIMESTAMPTZ NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL,
    reaktionszeit_sek INTEGER NOT NULL,
    ausreisser      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fahrer_reaktionszeit_log_location_date
    ON fahrer_reaktionszeit_log (location_id, dispatch_at DESC);

CREATE INDEX IF NOT EXISTS idx_fahrer_reaktionszeit_log_driver
    ON fahrer_reaktionszeit_log (driver_id, dispatch_at DESC);

-- Kochzeit-Genauigkeits-Log je Gericht
CREATE TABLE IF NOT EXISTS kochzeit_genauigkeit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL,
    order_id        UUID,
    gericht_name    TEXT NOT NULL,
    geschaetzte_min NUMERIC(5,1) NOT NULL,
    tatsaechliche_min NUMERIC(5,1) NOT NULL,
    delta_min       NUMERIC(5,1) NOT NULL,
    ausreisser      BOOLEAN NOT NULL DEFAULT false,
    erfasst_am      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kochzeit_genauigkeit_log_location
    ON kochzeit_genauigkeit_log (location_id, erfasst_am DESC);

-- Bestellmuster-Cache je Stunde (für Zeitfenster-Hinweis)
CREATE TABLE IF NOT EXISTS bestellmuster_stunden_cache (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL,
    wochentag       SMALLINT NOT NULL,  -- 0=Sonntag … 6=Samstag
    stunde          SMALLINT NOT NULL,  -- 0–23
    avg_bestellungen NUMERIC(6,1),
    relative_auslastung NUMERIC(4,2),
    beliebtheitsstufe TEXT,
    aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (location_id, wochentag, stunde)
);

-- delivery_config: neue Keys
INSERT INTO delivery_config (key, value, beschreibung) VALUES
    ('reaktionszeit_ausreisser_sek', '300', 'Schwelle Reaktionszeit-Ausreißer (Sek)'),
    ('kochzeit_delta_warnung_min', '5',   'Kochzeit-Δ-Warnung ab X Minuten')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE fahrer_reaktionszeit_log IS 'Phase 1742: Reaktionszeit Dispatch→Tour-Start je Fahrer';
COMMENT ON TABLE kochzeit_genauigkeit_log IS 'Phase 1743: Δ geschätzte vs. tatsächliche Kochzeit je Gericht';
COMMENT ON TABLE bestellmuster_stunden_cache IS 'Phase 1746: Historisches Bestellmuster je Stunde/Wochentag';
