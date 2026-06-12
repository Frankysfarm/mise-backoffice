-- Migration 051: Kunden-Loyalty-Punkte-System
-- Phase 77: Punkte pro Bestellung sammeln, ab Schwelle einlösen
-- 10 Punkte pro € | 1 Punkt = 0,01 € Rabatt | Mindest-Einlösung 100 Punkte

-- ── Konten (1 pro E-Mail + Location) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_loyalty_accounts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  customer_email  TEXT        NOT NULL,
  customer_name   TEXT,
  total_points    INTEGER     NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  lifetime_points INTEGER     NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
  tier            TEXT        NOT NULL DEFAULT 'bronze'
                              CHECK (tier IN ('bronze','silver','gold','platinum')),
  tier_updated_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, customer_email)
);

-- ── Transaktionen ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_point_transactions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID        NOT NULL REFERENCES customer_loyalty_accounts(id) ON DELETE CASCADE,
  location_id   UUID        NOT NULL,
  order_id      UUID        REFERENCES customer_orders(id),
  type          TEXT        NOT NULL CHECK (type IN ('earn','redeem','expire','manual','refund')),
  points        INTEGER     NOT NULL,   -- positiv = earn/refund/manual+, negativ = redeem/expire/manual-
  balance_after INTEGER     NOT NULL,
  description   TEXT,
  expires_at    TIMESTAMPTZ,            -- nur für 'earn'-Buchungen gesetzt
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indizes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_location
  ON customer_loyalty_accounts(location_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_email
  ON customer_loyalty_accounts(customer_email);
CREATE INDEX IF NOT EXISTS idx_loyalty_txn_account
  ON loyalty_point_transactions(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_txn_order
  ON loyalty_point_transactions(order_id)
  WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loyalty_txn_expires
  ON loyalty_point_transactions(expires_at)
  WHERE type = 'earn' AND expires_at IS NOT NULL;

-- ── View: Konto-Zusammenfassung ───────────────────────────────────────────────
CREATE OR REPLACE VIEW v_loyalty_account_summary AS
SELECT
  a.id,
  a.location_id,
  a.customer_email,
  a.customer_name,
  a.total_points,
  a.lifetime_points,
  a.tier,
  a.last_activity_at,
  a.created_at,
  COUNT(t.id) FILTER (WHERE t.type = 'earn')   AS earn_transactions,
  COUNT(t.id) FILTER (WHERE t.type = 'redeem') AS redeem_transactions,
  COALESCE(SUM(t.points) FILTER (WHERE t.type = 'earn'), 0) AS total_earned,
  COALESCE(ABS(SUM(t.points) FILTER (WHERE t.type = 'redeem')), 0) AS total_redeemed
FROM customer_loyalty_accounts a
LEFT JOIN loyalty_point_transactions t ON t.account_id = a.id
GROUP BY a.id;

-- ── View: Top-Kunden-Leaderboard ──────────────────────────────────────────────
CREATE OR REPLACE VIEW v_loyalty_leaderboard AS
SELECT
  a.location_id,
  a.id            AS account_id,
  a.customer_email,
  a.customer_name,
  a.total_points,
  a.lifetime_points,
  a.tier,
  a.last_activity_at,
  RANK() OVER (PARTITION BY a.location_id ORDER BY a.lifetime_points DESC) AS rank
FROM customer_loyalty_accounts a
WHERE a.lifetime_points > 0;
