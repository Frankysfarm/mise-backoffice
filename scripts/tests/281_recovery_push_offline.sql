\set ON_ERROR_STOP on
BEGIN;

INSERT INTO mise_drivers(id) VALUES('10000000-0000-0000-0000-000000000001');
INSERT INTO customer_orders(id,assignment_deadline_at)
VALUES('20000000-0000-0000-0000-000000000001',now()-interval '1 minute');
INSERT INTO mise_delivery_batches(id,driver_id,state,state_version)
VALUES('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','assigned',3);
INSERT INTO dispatch_offer_assignments(
 id,order_id,batch_id,driver_id,state,assignment_version,lease_expires_at)
VALUES('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
 '30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
 'assigned',4,now()-interval '1 minute');
INSERT INTO mise_push_outbox(id,driver_id,type,title,body)
VALUES('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
 'assign','wake','wake');
INSERT INTO mise_push_outbox(id,driver_id,type,title,body)
VALUES('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',
 'assign','wake','wake');
INSERT INTO mise_push_outbox(id,driver_id,type,title,body,expires_at)
VALUES('50000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001',
 'assign','wake','wake',now()-interval '1 second');

DO $$
DECLARE r jsonb; n integer;
BEGIN
  IF has_table_privilege('anon','driver_notification_ack_requests','INSERT')
    OR has_table_privilege('authenticated','dispatch_recovery_escalations','UPDATE')
    OR has_table_privilege('authenticated','batch_recovery_escalations','DELETE')
    OR has_table_privilege('anon','mise_push_outbox','INSERT')
    OR has_table_privilege('authenticated','mise_push_outbox','UPDATE')
    OR has_column_privilege('authenticated','mise_push_outbox','notification_state','UPDATE')
  THEN RAISE EXCEPTION 'T05 mutation privileges leaked to app roles'; END IF;
  IF NOT has_table_privilege('service_role','driver_notification_ack_requests','INSERT')
    OR NOT has_table_privilege('service_role','mise_push_outbox','UPDATE')
  THEN RAISE EXCEPTION 'service role lost T05 ledger privileges'; END IF;
  r:=fn_ack_wake_notification('10000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000002',
    '80000000-0000-0000-0000-000000000002');
  IF NOT (r->>'technical_ack')::boolean THEN RAISE EXCEPTION 'ack before provider/snapshot ordering failed'; END IF;
  IF (SELECT count(*) FROM fn_claim_wake_notifications(
    '60000000-0000-0000-0000-000000000001',10))<>1 THEN
    RAISE EXCEPTION 'claim did not return exactly once';
  END IF;
  IF (SELECT count(*) FROM fn_claim_wake_notifications(
    '60000000-0000-0000-0000-000000000002',10))<>0 THEN
    RAISE EXCEPTION 'duplicate worker claimed notification';
  END IF;
  r:=fn_finish_wake_notification('50000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001',true,'provider-ticket',null);
  IF NOT (r->>'ok')::boolean OR (SELECT notification_state FROM mise_push_outbox
    WHERE id='50000000-0000-0000-0000-000000000001')<>'provider_accepted' THEN
    RAISE EXCEPTION 'provider acceptance ledger failed';
  END IF;
  r:=fn_ack_wake_notification('10000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000001');
  IF NOT (r->>'technical_ack')::boolean OR (r->>'assignment_state_changed')::boolean THEN
    RAISE EXCEPTION 'technical ack semantics failed';
  END IF;
  r:=fn_ack_wake_notification('10000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000002');
  IF NOT (r->>'idempotent_replay')::boolean THEN RAISE EXCEPTION 'ack replay failed'; END IF;
  n:=fn_watchdog_escalate_orphan_assignments(10);
  IF n<>1 OR (SELECT state FROM dispatch_offer_assignments
    WHERE id='40000000-0000-0000-0000-000000000001')<>'assigned' THEN
    RAISE EXCEPTION 'watchdog must escalate without normal release';
  END IF;
  IF fn_watchdog_escalate_orphan_assignments(10)<>0 THEN
    RAISE EXCEPTION 'watchdog restart replay not idempotent';
  END IF;
  r:=fn_escalate_batch_recovery('30000000-0000-0000-0000-000000000001',3,
    'STALE_GPS_ACTIVE_WORK','90000000-0000-0000-0000-000000000001');
  IF NOT (r->>'ok')::boolean OR (r->>'ownership_released')::boolean
    OR (SELECT state FROM mise_delivery_batches WHERE id='30000000-0000-0000-0000-000000000001')<>'assigned'
    OR (SELECT state FROM dispatch_offer_assignments WHERE id='40000000-0000-0000-0000-000000000001')<>'assigned'
  THEN RAISE EXCEPTION 'stale GPS escalation changed active ownership'; END IF;
  r:=fn_escalate_batch_recovery('30000000-0000-0000-0000-000000000001',3,
    'STALE_GPS_ACTIVE_WORK','90000000-0000-0000-0000-000000000002');
  IF NOT (r->>'idempotent_replay')::boolean THEN
    RAISE EXCEPTION 'open recovery episode was not deduplicated';
  END IF;
  UPDATE batch_recovery_escalations SET resolved_at=now()
    WHERE batch_id='30000000-0000-0000-0000-000000000001' AND resolved_at IS NULL;
  r:=fn_escalate_batch_recovery('30000000-0000-0000-0000-000000000001',3,
    'SECOND_STALE_EPISODE','90000000-0000-0000-0000-000000000003');
  IF (r->>'idempotent_replay')::boolean OR
    (SELECT count(*) FROM batch_recovery_escalations
      WHERE batch_id='30000000-0000-0000-0000-000000000001')<>2 THEN
    RAISE EXCEPTION 'resolved recovery could not open a new episode';
  END IF;
  IF (SELECT notification_state FROM mise_push_outbox
    WHERE id='50000000-0000-0000-0000-000000000003')<>'expired' THEN
    RAISE EXCEPTION 'offline wake expiry not durable'; END IF;
END $$;

ROLLBACK;
\echo '281 recovery push offline tests passed'
