-- Migration 046: loyalty_programs (rule-based bonus system)
--
-- HINWEIS: Falls die alte Stempelkarten-Tabelle loyalty_programs existiert,
-- wird sie zu loyalty_stamp_programs umbenannt, um Namenskollision zu vermeiden.
-- App-Code-Referenzen wurden entsprechend auf loyalty_stamp_programs aktualisiert.

DO $$
BEGIN
  -- Alte Stempelkarten-Tabelle umbenennen falls vorhanden (erkennt am title-Feld)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loyalty_programs'
      AND column_name = 'title'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE loyalty_programs RENAME TO loyalty_stamp_programs;
    -- Index umbenennen
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_loyalty_programs_tenant') THEN
      ALTER INDEX idx_loyalty_programs_tenant RENAME TO idx_loyalty_stamp_programs_tenant;
    END IF;
    RAISE NOTICE 'loyalty_programs (Stempelkarten) -> loyalty_stamp_programs umbenannt';
  END IF;
END $$;

-- Neue rule-basierte Bonusprogramm-Tabelle erstellen
CREATE TABLE IF NOT EXISTS loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  max_redemptions_per_customer_per_month INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_programs_tenant_active ON loyalty_programs(tenant_id, is_active);

-- Trigger fuer updated_at (nur erstellen wenn nicht vorhanden)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'loyalty_programs_updated_at'
      AND tgrelid = 'loyalty_programs'::regclass
  ) THEN
    CREATE TRIGGER loyalty_programs_updated_at
      BEFORE UPDATE ON loyalty_programs
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
