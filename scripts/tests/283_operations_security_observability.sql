\set ON_ERROR_STOP on
INSERT INTO tenants(id,name,slug) VALUES
('84000000-0000-0000-0000-000000000001','Ops A','ops-a'),
('84000000-0000-0000-0000-000000000002','Ops B','ops-b');
INSERT INTO locations(id,tenant_id,name) VALUES
('84000000-0000-0000-0000-000000000011','84000000-0000-0000-0000-000000000001','A Store'),
('84000000-0000-0000-0000-000000000012','84000000-0000-0000-0000-000000000002','B Store');
INSERT INTO mise_drivers(id,name,active,state,state_version,current_capacity,max_capacity)
VALUES
('84000000-0000-0000-0000-000000000021','Driver A',true,'online',0,0,4),
('84000000-0000-0000-0000-000000000022','Driver B',true,'online',0,0,4);
INSERT INTO mise_driver_tenants(driver_id,tenant_id,status) VALUES
('84000000-0000-0000-0000-000000000021','84000000-0000-0000-0000-000000000001','active'),
('84000000-0000-0000-0000-000000000022','84000000-0000-0000-0000-000000000002','active');
INSERT INTO customer_orders(id,tenant_id,location_id,bestellnummer,kunde_name,typ,status)
VALUES
('84000000-0000-0000-0000-000000000031','84000000-0000-0000-0000-000000000001',
 '84000000-0000-0000-0000-000000000011','OPS-1','fixture','lieferung','fertig'),
('84000000-0000-0000-0000-000000000032','84000000-0000-0000-0000-000000000002',
 '84000000-0000-0000-0000-000000000012','OPS-2','fixture','lieferung','fertig');
INSERT INTO ops_tenant_policy_v2(tenant_id) VALUES
('84000000-0000-0000-0000-000000000001'),
('84000000-0000-0000-0000-000000000002');
INSERT INTO ops_actor_scopes_v2(actor_id,tenant_id,location_id,role) VALUES
('84000000-0000-0000-0000-000000000041','84000000-0000-0000-0000-000000000001',
 '84000000-0000-0000-0000-000000000011','dispatcher'),
('84000000-0000-0000-0000-000000000042','84000000-0000-0000-0000-000000000001',
 '84000000-0000-0000-0000-000000000011','kitchen');

DO $$
DECLARE r jsonb; pruned bigint;
BEGIN
  r:=fn_ops_manual_override_v2(
    '84000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000011',
    '84000000-0000-0000-0000-000000000041','dispatcher','VEHICLE_PROBLEM','driver',
    '84000000-0000-0000-0000-000000000021',0,'VEHICLE_FAILURE','Vehicle cannot continue safely.',
    '84000000-0000-0000-0000-000000000051','84000000-0000-0000-0000-000000000061');
  IF r->>'reason_code'<>'OPS_MUTATION_DEFAULT_OFF' THEN
    RAISE EXCEPTION 'default-off failed %',r;
  END IF;
  UPDATE ops_tenant_policy_v2 SET mutation_enabled=true,observability_enabled=true
    WHERE tenant_id='84000000-0000-0000-0000-000000000001';
  r:=fn_ops_manual_override_v2(
    '84000000-0000-0000-0000-000000000002','84000000-0000-0000-0000-000000000012',
    '84000000-0000-0000-0000-000000000041','dispatcher','VEHICLE_PROBLEM','driver',
    '84000000-0000-0000-0000-000000000022',0,'VEHICLE_FAILURE','Vehicle cannot continue safely.',
    '84000000-0000-0000-0000-000000000052','84000000-0000-0000-0000-000000000062');
  IF r->>'reason_code'<>'OPS_MUTATION_DEFAULT_OFF' THEN
    RAISE EXCEPTION 'cross tenant did not fail closed %',r;
  END IF;
  r:=fn_ops_manual_override_v2(
    '84000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000011',
    '84000000-0000-0000-0000-000000000042','kitchen','VEHICLE_PROBLEM','driver',
    '84000000-0000-0000-0000-000000000021',0,'VEHICLE_FAILURE','Vehicle cannot continue safely.',
    '84000000-0000-0000-0000-000000000053','84000000-0000-0000-0000-000000000063');
  IF r->>'reason_code'<>'INVALID_OVERRIDE_ENVELOPE' THEN
    RAISE EXCEPTION 'kitchen role escalated privilege %',r;
  END IF;
  r:=fn_ops_manual_override_v2(
    '84000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000011',
    '84000000-0000-0000-0000-000000000041','dispatcher','ORDER_CANCEL','order',
    '84000000-0000-0000-0000-000000000031',0,'CUSTOMER_CANCELLED','Customer requested cancellation.',
    '84000000-0000-0000-0000-000000000054','84000000-0000-0000-0000-000000000064');
  IF r->>'ok'<>'true' OR (SELECT status FROM customer_orders WHERE id=
      '84000000-0000-0000-0000-000000000031')<>'cancelled' THEN
    RAISE EXCEPTION 'order cancellation failed %',r;
  END IF;
  r:=fn_ops_manual_override_v2(
    '84000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000011',
    '84000000-0000-0000-0000-000000000041','dispatcher','ORDER_CANCEL','order',
    '84000000-0000-0000-0000-000000000031',0,'CUSTOMER_CANCELLED','Customer requested cancellation.',
    '84000000-0000-0000-0000-000000000054','84000000-0000-0000-0000-000000000064');
  IF r->>'idempotent_replay'<>'true' THEN RAISE EXCEPTION 'override replay failed %',r; END IF;
  r:=fn_ops_manual_override_v2(
    '84000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000011',
    '84000000-0000-0000-0000-000000000041','dispatcher','ORDER_CANCEL','order',
    '84000000-0000-0000-0000-000000000031',0,'CHANGED_REASON','Changed request fingerprint.',
    '84000000-0000-0000-0000-000000000054','84000000-0000-0000-0000-000000000064');
  IF r->>'reason_code'<>'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' THEN
    RAISE EXCEPTION 'override fingerprint failed %',r;
  END IF;
  IF (SELECT count(*) FROM ops_manual_override_requests_v2)<>1
     OR (SELECT count(*) FROM ops_events_v2)<>1 THEN
    RAISE EXCEPTION 'override audit projections invalid';
  END IF;
  r:=fn_ops_record_alert_v2('84000000-0000-0000-0000-000000000001',
    'HOLD_DEADLINE_OVERDUE','tenant', 'critical',2,1,
    '84000000-0000-0000-0000-000000000065');
  r:=fn_ops_record_alert_v2('84000000-0000-0000-0000-000000000001',
    'HOLD_DEADLINE_OVERDUE','tenant', 'critical',3,1,
    '84000000-0000-0000-0000-000000000066');
  IF (SELECT occurrence_count FROM ops_alert_episodes_v2 WHERE reason_code=
      'HOLD_DEADLINE_OVERDUE')<>2 THEN RAISE EXCEPTION 'alert dedupe failed'; END IF;
  INSERT INTO mise_driver_position_history(event_id,driver_id,tenant_id,received_at)
  VALUES
  ('84000000-0000-0000-0000-000000000081','84000000-0000-0000-0000-000000000021',
   '84000000-0000-0000-0000-000000000001',clock_timestamp()-interval '31 days'),
  ('84000000-0000-0000-0000-000000000082','84000000-0000-0000-0000-000000000021',
   '84000000-0000-0000-0000-000000000001',clock_timestamp()-interval '29 days'),
  ('84000000-0000-0000-0000-000000000083','84000000-0000-0000-0000-000000000022',
   '84000000-0000-0000-0000-000000000002',clock_timestamp()-interval '60 days');
  pruned:=fn_ops_prune_gps_v2('84000000-0000-0000-0000-000000000001',
      clock_timestamp());
  IF pruned<>1
     OR (SELECT count(*) FROM mise_driver_position_history)<>2 THEN
    RAISE EXCEPTION 'tenant-scoped GPS retention failed pruned=% remaining=%',
      pruned,(SELECT count(*) FROM mise_driver_position_history);
  END IF;
END $$;

SET ROLE authenticated;
DO $$
BEGIN
  BEGIN
    INSERT INTO ops_events_v2(tenant_id,correlation_id,event_type,severity,
      reason_code,resource_kind,actor_role)
    VALUES('84000000-0000-0000-0000-000000000001',gen_random_uuid(),'attack',
      'info','ATTACK','order','driver');
    RAISE EXCEPTION 'authenticated direct write unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE customer_orders SET status='completed'
      WHERE id='84000000-0000-0000-0000-000000000032';
    RAISE EXCEPTION 'authenticated order mutation unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
