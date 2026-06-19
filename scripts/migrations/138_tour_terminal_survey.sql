-- Migration 138: Tour Terminal Survey
-- Anonyme Post-Tour-Kurzumfrage (3 Fragen, Stern-Rating 1–5).
-- Admin sieht aggregierte Antworten ohne Fahrernamen.

-- ── 1. Umfrage-Antworten ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tour_terminal_surveys (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id           uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  -- Fahrer-Referenz für De-Duplizierung, NICHT für Admin sichtbar
  driver_id             uuid NOT NULL,
  tour_id               uuid,
  batch_id              uuid,
  -- Frage 1: Wie reibungslos lief die Tour?
  q1_tour_smoothness    smallint NOT NULL CHECK (q1_tour_smoothness BETWEEN 1 AND 5),
  -- Frage 2: War die Küche pünktlich vorbereitet?
  q2_kitchen_readiness  smallint NOT NULL CHECK (q2_kitchen_readiness BETWEEN 1 AND 5),
  -- Frage 3: Wie war der Kundenkontakt?
  q3_customer_contact   smallint NOT NULL CHECK (q3_customer_contact BETWEEN 1 AND 5),
  -- Optionaler anonymer Freitext (max 280 Zeichen)
  note                  text CHECK (char_length(note) <= 280),
  submitted_at          timestamptz NOT NULL DEFAULT now(),
  -- De-Duplizierung: ein Fahrer pro Tour
  UNIQUE (driver_id, tour_id)
);

CREATE INDEX IF NOT EXISTS idx_tour_surveys_location ON tour_terminal_surveys (location_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_tour_surveys_batch    ON tour_terminal_surveys (batch_id) WHERE batch_id IS NOT NULL;

ALTER TABLE tour_terminal_surveys ENABLE ROW LEVEL SECURITY;
-- Fahrer: nur eigene Einträge sehen/schreiben (service role umgeht dies)
CREATE POLICY "driver own surveys" ON tour_terminal_surveys
  USING (driver_id = auth.uid());

-- ── 2. Tages-Aggregat-View (anonym) ─────────────────────────────────────────
CREATE OR REPLACE VIEW v_tour_survey_daily AS
SELECT
  location_id,
  (submitted_at AT TIME ZONE 'UTC')::date                   AS survey_date,
  count(*)                                                   AS response_count,
  round(avg(q1_tour_smoothness)::numeric, 2)                AS avg_q1,
  round(avg(q2_kitchen_readiness)::numeric, 2)              AS avg_q2,
  round(avg(q3_customer_contact)::numeric, 2)               AS avg_q3,
  round(avg((q1_tour_smoothness + q2_kitchen_readiness + q3_customer_contact)::numeric / 3), 2)
                                                             AS avg_overall,
  count(*) FILTER (WHERE q1_tour_smoothness <= 2)           AS q1_low_count,
  count(*) FILTER (WHERE q2_kitchen_readiness <= 2)         AS q2_low_count,
  count(*) FILTER (WHERE q3_customer_contact <= 2)          AS q3_low_count,
  count(*) FILTER (WHERE note IS NOT NULL AND note <> '')   AS notes_count
FROM tour_terminal_surveys
GROUP BY location_id, survey_date;

-- ── 3. 7-Tage-Übersicht-View ────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_tour_survey_overview AS
SELECT
  location_id,
  count(*)                                                                AS total_responses_7d,
  round(avg(q1_tour_smoothness)::numeric, 2)                             AS avg_q1_7d,
  round(avg(q2_kitchen_readiness)::numeric, 2)                           AS avg_q2_7d,
  round(avg(q3_customer_contact)::numeric, 2)                            AS avg_q3_7d,
  round(avg((q1_tour_smoothness + q2_kitchen_readiness + q3_customer_contact)::numeric / 3), 2)
                                                                          AS avg_overall_7d,
  count(*) FILTER (WHERE q2_kitchen_readiness <= 2)                      AS kitchen_issues_7d,
  count(*) FILTER (WHERE q1_tour_smoothness <= 2)                        AS tour_issues_7d,
  count(*) FILTER (WHERE q3_customer_contact <= 2)                       AS customer_issues_7d
FROM tour_terminal_surveys
WHERE submitted_at >= now() - interval '7 days'
GROUP BY location_id;

-- ── 4. RPC: Cleanup ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_tour_surveys(p_days integer DEFAULT 90)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pruned integer;
BEGIN
  DELETE FROM tour_terminal_surveys
  WHERE submitted_at < now() - (p_days || ' days')::interval;
  GET DIAGNOSTICS v_pruned = ROW_COUNT;
  RETURN jsonb_build_object('pruned', v_pruned);
END;
$$;
