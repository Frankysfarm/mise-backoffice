BEGIN;

-- Do not retroactively issue customer compensation for historical orders that
-- predate activation of the delay engine. New production orders remain fully
-- monitored.
CREATE OR REPLACE VIEW public.v_delayed_orders AS
SELECT
  co.id,
  co.bestellnummer,
  co.location_id,
  co.status,
  co.eta_latest,
  co.mise_batch_id,
  co.mise_driver_id,
  ROUND(EXTRACT(EPOCH FROM (now() - co.eta_latest)) / 60) AS delay_minutes,
  EXISTS (
    SELECT 1 FROM public.delivery_delay_alerts dda
    WHERE dda.order_id = co.id AND dda.alert_type = 'first_notice'
  ) AS first_notice_sent,
  EXISTS (
    SELECT 1 FROM public.delivery_delay_alerts dda
    WHERE dda.order_id = co.id AND dda.alert_type = 'critical_notice'
  ) AS critical_notice_sent,
  EXISTS (
    SELECT 1 FROM public.delivery_delay_alerts dda
    WHERE dda.order_id = co.id AND dda.alert_type = 'compensation'
  ) AS compensation_flagged,
  EXISTS (
    SELECT 1 FROM public.delay_compensation_vouchers dcv
    WHERE dcv.order_id = co.id
  ) AS voucher_created
FROM public.customer_orders co
WHERE co.status NOT IN ('geliefert', 'abgeschlossen', 'storniert', 'cancelled', 'abgeholt')
  AND co.typ = 'lieferung'
  AND co.created_at >= timestamptz '2026-08-10 17:02:00+00'
  AND co.eta_latest IS NOT NULL
  AND co.eta_latest < now();

-- Remove only the rows created by the activation check at 17:01 UTC. The two
-- real customer orders themselves are deliberately not modified.
DELETE FROM public.delivery_delay_alerts
WHERE order_id IN (
  '7244f9bd-9bfa-48f9-9a2a-9254143dc284'::uuid,
  'e453aa11-47b7-4e9f-bd4b-3daf6e439439'::uuid
)
AND notified_at >= timestamptz '2026-08-10 17:01:30+00';

DELETE FROM public.delay_compensation_vouchers
WHERE order_id IN (
  '7244f9bd-9bfa-48f9-9a2a-9254143dc284'::uuid,
  'e453aa11-47b7-4e9f-bd4b-3daf6e439439'::uuid
)
AND created_at >= timestamptz '2026-08-10 17:01:30+00';

COMMIT;
