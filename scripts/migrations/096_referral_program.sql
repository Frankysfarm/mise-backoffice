-- ────────────────────────────────────────────────────────────────────────────
-- Migration 096: Smart Referral Program Engine
-- Phase 190 — Kunden-Empfehlungs-Programm mit automatischer Belohnungsverteilung
-- ────────────────────────────────────────────────────────────────────────────

-- Programm-Konfiguration pro Location
CREATE TABLE IF NOT EXISTS referral_programs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  is_enabled            boolean NOT NULL DEFAULT false,
  referrer_reward_eur   numeric(8,2) NOT NULL DEFAULT 3.00,  -- Belohnung für Empfehler
  referee_reward_eur    numeric(8,2) NOT NULL DEFAULT 2.00,  -- Belohnung für Neukunden
  min_order_eur         numeric(8,2) NOT NULL DEFAULT 10.00, -- Mindestbestellwert für Freischaltung
  valid_days            integer NOT NULL DEFAULT 30,          -- Gültigkeit des Gutscheins
  max_referrals_per_user integer NOT NULL DEFAULT 20,        -- Max. Empfehlungen pro Nutzer
  requires_first_order  boolean NOT NULL DEFAULT true,        -- Nur bei erster Bestellung des Geworbenen
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id)
);

-- Individuelle Empfehlungs-Codes pro Kunde
CREATE TABLE IF NOT EXISTS referral_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  customer_token  text NOT NULL,  -- rating_token oder ähnlicher Kunden-Identifier
  code            text NOT NULL,  -- 8-stelliger alphanumerischer Code
  uses_count      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, customer_token),
  UNIQUE (code)
);

-- Empfehlungs-Konversionen (Wer hat wen geworben, welche Bestellung)
CREATE TABLE IF NOT EXISTS referral_conversions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  referral_code_id      uuid NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  referee_token         text NOT NULL,  -- Kunden-Token des Geworbenen
  order_id              text,           -- Bestellung die die Freischaltung ausgelöst hat
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','delivered','rewarded','expired','cancelled')),
  referrer_reward_eur   numeric(8,2) NOT NULL DEFAULT 0,
  referee_reward_eur    numeric(8,2) NOT NULL DEFAULT 0,
  referrer_voucher_id   uuid,    -- ausgestellter Gutschein für Empfehler
  referee_voucher_id    uuid,    -- ausgestellter Gutschein für Geworbenen
  rewarded_at           timestamptz,
  expires_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referral_code_id, referee_token)  -- jeder Geworbene nur einmal pro Code
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_referral_programs_location ON referral_programs(location_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_location ON referral_codes(location_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_token ON referral_codes(customer_token);
CREATE INDEX IF NOT EXISTS idx_referral_conversions_location ON referral_conversions(location_id);
CREATE INDEX IF NOT EXISTS idx_referral_conversions_code ON referral_conversions(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_conversions_status ON referral_conversions(status)
  WHERE status IN ('pending','delivered');
CREATE INDEX IF NOT EXISTS idx_referral_conversions_expires ON referral_conversions(expires_at)
  WHERE status = 'pending';

-- RLS
ALTER TABLE referral_programs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_referral_programs"    ON referral_programs    FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_referral_codes"       ON referral_codes       FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_referral_conversions" ON referral_conversions FOR ALL TO service_role USING (true);

-- Updated-At Trigger
CREATE OR REPLACE FUNCTION update_referral_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_referral_programs_updated_at
  BEFORE UPDATE ON referral_programs
  FOR EACH ROW EXECUTE FUNCTION update_referral_updated_at();

CREATE TRIGGER trg_referral_codes_updated_at
  BEFORE UPDATE ON referral_codes
  FOR EACH ROW EXECUTE FUNCTION update_referral_updated_at();

CREATE TRIGGER trg_referral_conversions_updated_at
  BEFORE UPDATE ON referral_conversions
  FOR EACH ROW EXECUTE FUNCTION update_referral_updated_at();

-- Statistik-View pro Location
CREATE OR REPLACE VIEW v_referral_stats AS
SELECT
  rc.location_id,
  COUNT(DISTINCT rc.id)                                          AS total_referral_codes,
  COUNT(DISTINCT rc.id) FILTER (WHERE rc.uses_count > 0)        AS active_referrers,
  COUNT(conv.id)                                                 AS total_conversions,
  COUNT(conv.id) FILTER (WHERE conv.status = 'rewarded')        AS rewarded_conversions,
  COUNT(conv.id) FILTER (WHERE conv.status = 'pending')         AS pending_conversions,
  COALESCE(SUM(conv.referrer_reward_eur + conv.referee_reward_eur)
    FILTER (WHERE conv.status = 'rewarded'), 0)                 AS total_rewards_eur,
  CASE
    WHEN COUNT(conv.id) = 0 THEN 0
    ELSE ROUND(
      COUNT(conv.id) FILTER (WHERE conv.status = 'rewarded')::numeric
      / COUNT(conv.id)::numeric * 100, 1)
  END                                                            AS conversion_rate_pct
FROM referral_codes rc
LEFT JOIN referral_conversions conv ON conv.referral_code_id = rc.id
GROUP BY rc.location_id;

-- Top-Empfehler-View
CREATE OR REPLACE VIEW v_top_referrers AS
SELECT
  rc.id           AS code_id,
  rc.location_id,
  rc.customer_token,
  rc.code,
  rc.uses_count,
  rc.created_at,
  COUNT(conv.id) FILTER (WHERE conv.status = 'rewarded') AS rewarded_count,
  COALESCE(SUM(conv.referrer_reward_eur)
    FILTER (WHERE conv.status = 'rewarded'), 0)           AS total_earned_eur
FROM referral_codes rc
LEFT JOIN referral_conversions conv ON conv.referral_code_id = rc.id
GROUP BY rc.id, rc.location_id, rc.customer_token, rc.code, rc.uses_count, rc.created_at;

-- Cleanup-Funktion: abgelaufene Pending-Konversionen markieren
CREATE OR REPLACE FUNCTION expire_stale_referral_conversions()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE expired_count integer;
BEGIN
  UPDATE referral_conversions
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < now();
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;
