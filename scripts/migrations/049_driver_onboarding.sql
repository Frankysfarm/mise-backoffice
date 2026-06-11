-- Migration 049: Fahrer-Bewerbung & Onboarding-Tracking
--
-- Zweck:
--   1. driver_applications     — Bewerbungen neuer Fahrer
--   2. driver_onboarding_steps — Onboarding-Checkliste je Bewerbung
--   3. v_application_overview  — Bewerbungen mit Step-Fortschritt
--   4. v_onboarding_funnel     — Trichter-Statistiken je Standort

-- ============================================================
-- 1. driver_applications
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_applications (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  first_name      text        NOT NULL,
  last_name       text        NOT NULL,
  email           text        NOT NULL,
  phone           text        NOT NULL,
  has_vehicle     boolean     NOT NULL DEFAULT false,
  vehicle_type    text        CHECK (vehicle_type IN ('bicycle', 'moped', 'car', 'scooter', 'ebike')),
  license_class   text,
  availability    text        CHECK (availability IN ('fulltime', 'parttime', 'weekends', 'evenings', 'flexible')),
  cover_letter    text,
  referral_code   text,
  status          text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected', 'withdrawn')),
  admin_notes     text,
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  driver_id       uuid        REFERENCES mise_drivers(id) ON DELETE SET NULL,
  applied_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE driver_applications IS
  'Bewerbungen neuer Fahrer. '
  'status=pending → neu eingetroffen, '
  'reviewing → Admin prüft, '
  'approved → angenommen und driver_id verknüpft, '
  'rejected → abgelehnt, '
  'withdrawn → Bewerber hat zurückgezogen.';

-- ============================================================
-- 2. driver_onboarding_steps
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_onboarding_steps (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  uuid        NOT NULL REFERENCES driver_applications(id) ON DELETE CASCADE,
  location_id     uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  step_key        text        NOT NULL,
  step_name       text        NOT NULL,
  step_order      int         NOT NULL DEFAULT 0,
  required        boolean     NOT NULL DEFAULT true,
  status          text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'failed')),
  completed_at    timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, step_key)
);

COMMENT ON TABLE driver_onboarding_steps IS
  'Onboarding-Checkliste je Bewerbung. '
  'Jede Step hat einen step_key (z.B. id_check, food_hygiene_cert, app_install). '
  'required=true → muss abgehakt sein bevor approve möglich. '
  'Wird beim Review-Start via createDefaultOnboardingSteps() erzeugt.';

-- ============================================================
-- 3. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_driver_applications_loc_status
  ON driver_applications(location_id, status);

CREATE INDEX IF NOT EXISTS idx_driver_applications_email
  ON driver_applications(email);

CREATE INDEX IF NOT EXISTS idx_driver_applications_expires
  ON driver_applications(expires_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_driver_onboarding_app
  ON driver_onboarding_steps(application_id);

-- ============================================================
-- 4. v_application_overview
-- ============================================================
CREATE OR REPLACE VIEW v_application_overview AS
SELECT
  a.id,
  a.location_id,
  a.first_name,
  a.last_name,
  a.email,
  a.phone,
  a.has_vehicle,
  a.vehicle_type,
  a.license_class,
  a.availability,
  a.cover_letter,
  a.referral_code,
  a.status,
  a.admin_notes,
  a.reviewed_by,
  a.reviewed_at,
  a.driver_id,
  a.applied_at,
  a.expires_at,
  a.created_at,
  a.updated_at,
  COUNT(s.id)                                                   AS steps_total,
  COUNT(s.id) FILTER (WHERE s.status = 'completed')            AS steps_completed,
  COUNT(s.id) FILTER (WHERE s.required
    AND s.status NOT IN ('completed', 'skipped'))               AS steps_blocking
FROM driver_applications a
LEFT JOIN driver_onboarding_steps s ON s.application_id = a.id
GROUP BY a.id;

-- ============================================================
-- 5. v_onboarding_funnel
-- ============================================================
CREATE OR REPLACE VIEW v_onboarding_funnel AS
SELECT
  location_id,
  COUNT(*)                                                         AS total_applications,
  COUNT(*) FILTER (WHERE status = 'pending')                       AS pending,
  COUNT(*) FILTER (WHERE status = 'reviewing')                     AS reviewing,
  COUNT(*) FILTER (WHERE status = 'approved')                      AS approved,
  COUNT(*) FILTER (WHERE status = 'rejected')                      AS rejected,
  COUNT(*) FILTER (WHERE status = 'withdrawn')                     AS withdrawn,
  COUNT(*) FILTER (WHERE status = 'pending' AND expires_at < now()) AS expired_pending,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'approved')
    / NULLIF(COUNT(*), 0),
    1
  )                                                                AS approval_rate_pct
FROM driver_applications
GROUP BY location_id;
