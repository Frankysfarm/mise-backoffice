-- Phase 1831–1835: Fahrer-Pünktlichkeits-V2, Bestellpriorität, Zonen-Effizienz-Dashboard, Pünktlichkeits-Cockpit, Fahrer-Score-Badge
-- Erstellt: 2026-07-16

-- Tabelle: Pünktlichkeits-Snapshots je Fahrer (täglicher Snapshot für 7-Tage-Verlauf)
CREATE TABLE IF NOT EXISTS fahrer_puenktlichkeit_snapshots (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    location_id     UUID NOT NULL,
    fahrer_id       UUID NOT NULL,
    snapshot_datum  DATE NOT NULL DEFAULT CURRENT_DATE,
    quote_pct       NUMERIC(5,2) NOT NULL DEFAULT 0,
    gesamt_stopps   INTEGER NOT NULL DEFAULT 0,
    puenktlich      INTEGER NOT NULL DEFAULT 0,
    zu_spaet        INTEGER NOT NULL DEFAULT 0,
    grade           TEXT NOT NULL DEFAULT 'C' CHECK (grade IN ('A','B','C','D')),
    ampel           TEXT NOT NULL DEFAULT 'gelb' CHECK (ampel IN ('gruen','gelb','rot')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(location_id, fahrer_id, snapshot_datum)
);

CREATE INDEX IF NOT EXISTS idx_fahrer_puenktlichkeit_snapshots_loc_fahrer
    ON fahrer_puenktlichkeit_snapshots (location_id, fahrer_id, snapshot_datum DESC);

-- Tabelle: Zonen-Effizienz-Snapshots (tägliche Zusammenfassung für Trendanalyse)
CREATE TABLE IF NOT EXISTS zonen_effizienz_snapshots (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    location_id     UUID NOT NULL,
    zone            TEXT NOT NULL,
    snapshot_datum  DATE NOT NULL DEFAULT CURRENT_DATE,
    touren          INTEGER NOT NULL DEFAULT 0,
    umsatz_cents    INTEGER NOT NULL DEFAULT 0,
    km_gesamt       NUMERIC(10,2) NOT NULL DEFAULT 0,
    umsatz_pro_km   NUMERIC(8,2) NOT NULL DEFAULT 0,
    ampel           TEXT NOT NULL DEFAULT 'gelb' CHECK (ampel IN ('gruen','gelb','rot')),
    ausreisser      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(location_id, zone, snapshot_datum)
);

CREATE INDEX IF NOT EXISTS idx_zonen_effizienz_snapshots_loc_zone
    ON zonen_effizienz_snapshots (location_id, zone, snapshot_datum DESC);

-- delivery_config: Pünktlichkeits-Schwellwerte für Phase 1831/1834
INSERT INTO delivery_config (location_id, key, value, updated_at)
SELECT l.id, 'puenktlichkeit_gruen_schwelle', '85', NOW()
FROM locations l
ON CONFLICT (location_id, key) DO NOTHING;

INSERT INTO delivery_config (location_id, key, value, updated_at)
SELECT l.id, 'puenktlichkeit_gelb_schwelle', '65', NOW()
FROM locations l
ON CONFLICT (location_id, key) DO NOTHING;

INSERT INTO delivery_config (location_id, key, value, updated_at)
SELECT l.id, 'zonen_effizienz_ausreisser_pct', '80', NOW()
FROM locations l
ON CONFLICT (location_id, key) DO NOTHING;

-- Kommentar
COMMENT ON TABLE fahrer_puenktlichkeit_snapshots IS 'Tägliche Pünktlichkeits-Snapshots je Fahrer für 7-Tage-Verlauf (Phase 1831/1834)';
COMMENT ON TABLE zonen_effizienz_snapshots IS 'Tägliche Zonen-Effizienz-Snapshots für Dashboard-Trendanalyse (Phase 1833)';
