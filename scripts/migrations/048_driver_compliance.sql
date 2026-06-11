-- Migration 048: Fahrer-Zertifikat & Compliance-Tracking
--
-- Zweck:
--   1. driver_certifications        — Zertifikate + Ablaufdaten pro Fahrer
--   2. v_driver_compliance_status   — Compliance-Level je Fahrer (kein Standortfilter nötig)
--   3. v_expiring_soon_certs        — Zertifikate die in ≤30 Tagen ablaufen (je Standort)
--
-- Compliance-Regeln:
--   non_compliant  → food_hygiene abgelaufen oder gesperrt → Dispatch gesperrt
--   partial        → anderes Zertifikat abgelaufen/gesperrt → Warnung, kein Block
--   expiring_soon  → mindestens ein aktives Zertifikat läuft in ≤30 Tagen ab
--   compliant      → alle Zertifikate aktiv und gültig
--   no_certs       → noch keine Zertifikate eingetragen

-- ============================================================
-- 1. driver_certifications
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_certifications (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id     uuid        NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  location_id   uuid        NOT NULL REFERENCES locations(id)    ON DELETE CASCADE,
  cert_type     text        NOT NULL
    CHECK(cert_type IN (
      'food_hygiene',       -- Lebensmittelhygiene-Schulung (gesetzlich vorgeschrieben)
      'drivers_license',    -- Führerschein
      'vehicle_inspection', -- Hauptuntersuchung / TÜV
      'food_handler',       -- Lebensmittelhandhabungs-Zertifikat
      'id_verification',    -- Personalausweis-Prüfung
      'other'               -- Sonstige Dokumente
    )),
  cert_number   text,                                      -- Zertifikatsnummer / Aktenzeichen
  issued_at     date,                                      -- Ausstellungsdatum
  expires_at    date,                                      -- Ablaufdatum (NULL = kein Verfall)
  status        text        NOT NULL DEFAULT 'active'
    CHECK(status IN ('active', 'expired', 'suspended', 'pending_renewal')),
  notes         text,                                      -- Admin-Notizen
  created_by    uuid,                                      -- Admin der das Zert eingetragen hat
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(driver_id, cert_type)                             -- Ein Zertifikatstyp je Fahrer
);

COMMENT ON TABLE driver_certifications IS
  'Zertifikate und Ablaufdaten je Fahrer. '
  'food_hygiene abgelaufen → Fahrer wird vom Dispatch ausgeschlossen (hard block). '
  'Andere abgelaufene Certs erzeugen eine Warnung, blockieren aber nicht.';

-- ============================================================
-- 2. v_driver_compliance_status
-- ============================================================
CREATE OR REPLACE VIEW v_driver_compliance_status AS
WITH cert_agg AS (
  SELECT
    driver_id,
    COUNT(*)          FILTER (WHERE status = 'active')                                                           AS active_certs,
    COUNT(*)          FILTER (WHERE status = 'expired')                                                          AS expired_certs,
    COUNT(*)          FILTER (WHERE status = 'suspended')                                                        AS suspended_certs,
    COUNT(*)          FILTER (WHERE status = 'active'
                                AND expires_at IS NOT NULL
                                AND expires_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')       AS expiring_soon_count,
    BOOL_OR(cert_type = 'food_hygiene' AND status IN ('expired', 'suspended'))                                   AS food_hygiene_blocked,
    MAX(updated_at)                                                                                              AS last_cert_update
  FROM driver_certifications
  GROUP BY driver_id
)
SELECT
  d.id                                     AS driver_id,
  d.employee_id,
  d.vehicle,
  CASE
    WHEN COALESCE(ca.food_hygiene_blocked, false)                                 THEN 'non_compliant'
    WHEN COALESCE(ca.expired_certs, 0) > 0 OR COALESCE(ca.suspended_certs, 0) > 0 THEN 'partial'
    WHEN COALESCE(ca.expiring_soon_count, 0) > 0                                 THEN 'expiring_soon'
    WHEN COALESCE(ca.active_certs, 0) > 0                                        THEN 'compliant'
    ELSE 'no_certs'
  END                                      AS compliance_status,
  COALESCE(ca.active_certs, 0)             AS active_certs,
  COALESCE(ca.expired_certs, 0)            AS expired_certs,
  COALESCE(ca.suspended_certs, 0)          AS suspended_certs,
  COALESCE(ca.expiring_soon_count, 0)      AS expiring_soon_count,
  ca.last_cert_update
FROM mise_drivers d
LEFT JOIN cert_agg ca ON ca.driver_id = d.id;

COMMENT ON VIEW v_driver_compliance_status IS
  'Aggregierter Compliance-Level je Fahrer (standortunabhängig). '
  'non_compliant = Lebensmittelhygiene abgelaufen/gesperrt → Dispatch-Block. '
  'partial = anderes Zertifikat abgelaufen. '
  'expiring_soon = mind. ein Zertifikat läuft in ≤30 Tagen ab. '
  'compliant = alles aktiv. no_certs = keine Zertifikate eingetragen.';

-- ============================================================
-- 3. v_expiring_soon_certs
-- ============================================================
CREATE OR REPLACE VIEW v_expiring_soon_certs AS
SELECT
  dc.id,
  dc.driver_id,
  dc.location_id,
  dc.cert_type,
  dc.cert_number,
  dc.expires_at,
  dc.status,
  (dc.expires_at - CURRENT_DATE)::int  AS days_until_expiry,
  dc.notes
FROM driver_certifications dc
WHERE dc.expires_at IS NOT NULL
  AND dc.expires_at >= CURRENT_DATE
  AND dc.expires_at <= CURRENT_DATE + INTERVAL '30 days'
  AND dc.status = 'active'
ORDER BY dc.expires_at;

COMMENT ON VIEW v_expiring_soon_certs IS
  'Aktive Zertifikate die innerhalb der nächsten 30 Tage ablaufen. '
  'Für Cron-Alerting und Admin-Übersicht.';

-- ============================================================
-- 4. Indizes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_driver_certs_driver
  ON driver_certifications(driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_certs_location
  ON driver_certifications(location_id);

CREATE INDEX IF NOT EXISTS idx_driver_certs_expires
  ON driver_certifications(expires_at)
  WHERE expires_at IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_driver_certs_type_status
  ON driver_certifications(cert_type, status);
