\set ON_ERROR_STOP on

INSERT INTO tenants(id,name,slug) VALUES
('82000000-0000-0000-0000-000000000001','T08','t08');
INSERT INTO locations(id,tenant_id,name) VALUES
('82000000-0000-0000-0000-000000000002','82000000-0000-0000-0000-000000000001','T08 Store');
INSERT INTO customer_orders(id,tenant_id,location_id,bestellnummer,kunde_name,typ,status)
VALUES
('82000000-0000-0000-0000-000000000011','82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000002','T08-1','fixture','lieferung','fertig'),
('82000000-0000-0000-0000-000000000012','82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000002','T08-2','fixture','lieferung','fertig'),
('82000000-0000-0000-0000-000000000013','82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000002','T08-3','fixture','lieferung','fertig');
INSERT INTO dispatch_routing_hold_config_v2(tenant_id,enabled,shadow_only)
VALUES('82000000-0000-0000-0000-000000000001',true,false);

DO $$
DECLARE r jsonb; v bigint;
BEGIN
  r:=fn_persist_route_plan_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000301',0,1,
    '[{"id":"pickup"},{"id":"dropoff"}]','{"pickup":"2026-07-28T10:00:00Z"}',
    '{"reason_code":"INSERTION_FEASIBLE"}',false,
    '82000000-0000-0000-0000-000000000302','82000000-0000-0000-0000-000000000303');
  IF r->>'route_version'<>'1' THEN RAISE EXCEPTION 'route create failed %',r; END IF;
  r:=fn_persist_route_plan_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000301',0,1,
    '[{"id":"pickup"},{"id":"dropoff"}]','{"pickup":"2026-07-28T10:00:00Z"}',
    '{"reason_code":"INSERTION_FEASIBLE"}',false,
    '82000000-0000-0000-0000-000000000302','82000000-0000-0000-0000-000000000303');
  IF r->>'idempotent_replay'<>'true' THEN RAISE EXCEPTION 'route replay failed %',r; END IF;
  r:=fn_persist_route_plan_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000301',0,2,
    '[{"id":"pickup"},{"id":"dropoff"}]','{}','{}',true,
    '82000000-0000-0000-0000-000000000304','82000000-0000-0000-0000-000000000303');
  IF r->>'reason_code'<>'ROUTE_VERSION_CONFLICT' THEN RAISE EXCEPTION 'route CAS failed %',r; END IF;

  r:=fn_schedule_kitchen_hold_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000011',0,1,
    clock_timestamp()+interval '2 minutes',clock_timestamp()+interval '5 minutes',
    clock_timestamp()+interval '1 minute','WAIT_FOR_DRIVER_OR_MATCH','{"prep":15}',
    '82000000-0000-0000-0000-000000000101','82000000-0000-0000-0000-000000000201');
  IF r->>'ok'<>'true' OR r->>'state'<>'held' THEN RAISE EXCEPTION 'schedule failed %',r; END IF;
  r:=fn_schedule_kitchen_hold_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000011',0,1,
    clock_timestamp()+interval '2 minutes',clock_timestamp()+interval '5 minutes',
    clock_timestamp()+interval '1 minute','WAIT_FOR_DRIVER_OR_MATCH','{"prep":15}',
    '82000000-0000-0000-0000-000000000101','82000000-0000-0000-0000-000000000201');
  IF r->>'idempotent_replay'<>'true' THEN RAISE EXCEPTION 'schedule replay failed %',r; END IF;
  r:=fn_release_kitchen_hold_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000011',1,
    '82000000-0000-0000-0000-000000000102','82000000-0000-0000-0000-000000000201','DEADLINE_OVERRIDE');
  IF r->>'state'<>'released' THEN RAISE EXCEPTION 'release failed %',r; END IF;
  r:=fn_release_kitchen_hold_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000011',1,
    '82000000-0000-0000-0000-000000000102','82000000-0000-0000-0000-000000000201','DEADLINE_OVERRIDE');
  IF r->>'idempotent_replay'<>'true' THEN RAISE EXCEPTION 'release replay failed %',r; END IF;
  IF (SELECT count(*) FROM dispatch_kitchen_release_outbox_v2 WHERE order_id='82000000-0000-0000-0000-000000000011')<>1
    THEN RAISE EXCEPTION 'duplicate kitchen release'; END IF;

  r:=fn_schedule_kitchen_hold_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000012',0,1,
    clock_timestamp()+interval '2 minutes',clock_timestamp()+interval '5 minutes',
    clock_timestamp()+interval '1 minute','WAIT','{}',
    '82000000-0000-0000-0000-000000000103','82000000-0000-0000-0000-000000000202');
  r:=fn_cancel_kitchen_hold_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000012',1,
    '82000000-0000-0000-0000-000000000104');
  IF r->>'state'<>'cancelled' THEN RAISE EXCEPTION 'cancel failed %',r; END IF;

  r:=fn_schedule_kitchen_hold_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000013',0,1,
    clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 minute',
    clock_timestamp()-interval '1 minute','WAIT','{}',
    '82000000-0000-0000-0000-000000000105','82000000-0000-0000-0000-000000000203');
  v:=fn_watchdog_release_kitchen_holds_v2(100);
  IF v<>1 OR (SELECT state FROM dispatch_kitchen_holds_v2 WHERE order_id='82000000-0000-0000-0000-000000000013')<>'released'
    THEN RAISE EXCEPTION 'watchdog failed %',v; END IF;
  v:=fn_watchdog_release_kitchen_holds_v2(100);
  IF v<>0 THEN RAISE EXCEPTION 'watchdog restart duplicate %',v; END IF;
END $$;
