-- Migration 086: Customer Browser Web Push (VAPID) Notifications
-- Phase 172 — VAPID-basierte Browser-Push-Benachrichtigungen für Storefront-Kunden

-- ─── Config ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_web_push_config (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id         uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  enabled             boolean     NOT NULL DEFAULT false,
  events_enabled      text[]      NOT NULL DEFAULT ARRAY[
    'driver_departing','driver_almost_there','delivered','delayed'
  ],
  daily_limit_per_sub integer     NOT NULL DEFAULT 10,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id)
);

CREATE OR REPLACE FUNCTION trg_cwp_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_cwp_config_updated_at ON customer_web_push_config;
CREATE TRIGGER set_cwp_config_updated_at
  BEFORE UPDATE ON customer_web_push_config
  FOR EACH ROW EXECUTE FUNCTION trg_cwp_config_updated_at();

-- ─── Subscriptions ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_push_subscriptions (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id  uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  endpoint     text        NOT NULL,
  p256dh_key   text        NOT NULL,
  auth_key     text        NOT NULL,
  email        text,
  order_id     uuid,
  user_agent   text,
  lang         text        NOT NULL DEFAULT 'de',
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_cps_location    ON customer_push_subscriptions(location_id);
CREATE INDEX IF NOT EXISTS idx_cps_email       ON customer_push_subscriptions(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cps_order       ON customer_push_subscriptions(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cps_last_used   ON customer_push_subscriptions(last_used_at DESC);

-- ─── Log ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_web_push_log (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id     uuid        NOT NULL,
  subscription_id uuid        REFERENCES customer_push_subscriptions(id) ON DELETE SET NULL,
  event_type      text        NOT NULL,
  title           text        NOT NULL,
  body            text        NOT NULL,
  url             text,
  status          text        NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent','failed','expired','skipped')),
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cwpl_location_created  ON customer_web_push_log(location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cwpl_status            ON customer_web_push_log(status);
CREATE INDEX IF NOT EXISTS idx_cwpl_event_type        ON customer_web_push_log(event_type);

-- ─── Stats View ──────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_customer_push_stats AS
SELECT
  s.location_id,
  COUNT(DISTINCT s.id)                                                                           AS total_subs,
  COUNT(DISTINCT s.id) FILTER (WHERE s.last_used_at >= now() - interval '7 days')               AS subs_active_7d,
  COUNT(l.id)          FILTER (WHERE l.created_at   >= now() - interval '24 hours')              AS events_24h,
  COUNT(l.id)          FILTER (WHERE l.status = 'sent'    AND l.created_at >= now() - interval '24 hours') AS sent_24h,
  COUNT(l.id)          FILTER (WHERE l.status = 'failed'  AND l.created_at >= now() - interval '24 hours') AS failed_24h,
  COUNT(l.id)          FILTER (WHERE l.status = 'expired' AND l.created_at >= now() - interval '7 days')   AS expired_7d,
  ROUND(
    100.0
    * COUNT(l.id) FILTER (WHERE l.status = 'sent' AND l.created_at >= now() - interval '24 hours')
    / NULLIF(COUNT(l.id) FILTER (WHERE l.created_at >= now() - interval '24 hours'), 0)
  )                                                                                              AS delivery_rate_24h_pct
FROM customer_push_subscriptions s
LEFT JOIN customer_web_push_log l ON l.subscription_id = s.id
GROUP BY s.location_id;

-- ─── Cleanup function ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prune_old_customer_push_logs(days_old integer DEFAULT 30)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE rows_deleted integer;
BEGIN
  DELETE FROM customer_web_push_log
  WHERE created_at < now() - (days_old || ' days')::interval;
  GET DIAGNOSTICS rows_deleted = ROW_COUNT;
  RETURN rows_deleted;
END;
$$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE customer_web_push_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_push_subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_web_push_log          ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_web_push_config'    AND policyname='svc_all_cwp_config')  THEN
    CREATE POLICY svc_all_cwp_config    ON customer_web_push_config       FOR ALL TO service_role USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_push_subscriptions' AND policyname='svc_all_cps')         THEN
    CREATE POLICY svc_all_cps           ON customer_push_subscriptions    FOR ALL TO service_role USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_web_push_log'       AND policyname='svc_all_cwpl')        THEN
    CREATE POLICY svc_all_cwpl          ON customer_web_push_log          FOR ALL TO service_role USING (true);
  END IF;
END $$;
