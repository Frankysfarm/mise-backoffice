\set ON_ERROR_STOP on
\i scripts/tests/fixtures/280_gps_schema.sql
\i scripts/migrations/280_gps_monotonic_transport.sql

INSERT INTO tenants VALUES ('10000000-0000-4000-8000-000000000001');
INSERT INTO mise_drivers VALUES ('20000000-0000-4000-8000-000000000001','delivering',7);
INSERT INTO mise_driver_tenants VALUES ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','active');
INSERT INTO mise_gps_transport_config(tenant_id,tracking_enabled,background_tracking_enabled)
VALUES ('10000000-0000-4000-8000-000000000001',true,true);
CREATE TABLE t06_gps_test_clock(base timestamptz NOT NULL);
INSERT INTO t06_gps_test_clock VALUES (clock_timestamp()-interval '10 minutes');

CREATE TEMP TABLE outcomes(outcome jsonb);
INSERT INTO outcomes SELECT fn_ingest_driver_gps_v2(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
 1,(SELECT base FROM t06_gps_test_clock),52.5,13.4,10,NULL,NULL,'1.2.3','42','ios','foreground','always','online','{}',7,'50000000-0000-4000-8000-000000000001');
INSERT INTO outcomes SELECT fn_ingest_driver_gps_v2(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001',
 2,(SELECT base+interval '5 seconds' FROM t06_gps_test_clock),52.5001,13.4001,10,NULL,NULL,'1.2.3','42','ios','background','always','offline','{}',7,'50000000-0000-4000-8000-000000000002');
INSERT INTO outcomes SELECT fn_ingest_driver_gps_v2(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001',
 0,(SELECT base+interval '2 seconds' FROM t06_gps_test_clock),52.4999,13.3999,500,NULL,NULL,'1.2.3','42','ios','locked','always','online','{}',7,'50000000-0000-4000-8000-000000000003');

DO $$
BEGIN
 IF (SELECT count(*) FROM mise_driver_locations) <> 3 THEN RAISE EXCEPTION 'history count'; END IF;
 IF (SELECT sequence FROM mise_driver_position_current) <> 2 THEN RAISE EXCEPTION 'older overwrote current'; END IF;
 IF (SELECT outcome->>'outcome' FROM outcomes OFFSET 2 LIMIT 1) <> 'valid_history_only' THEN RAISE EXCEPTION 'older not history-only'; END IF;
 IF (SELECT array_position(quality_flags,'inaccurate') FROM mise_driver_locations WHERE sequence=0) IS NULL THEN RAISE EXCEPTION 'accuracy flag missing'; END IF;
END $$;

-- A physically impossible jump is retained and explicitly untrusted.
SELECT fn_ingest_driver_gps_v2(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000001',
 3,(SELECT base+interval '6 seconds' FROM t06_gps_test_clock),60.0,20.0,10,NULL,NULL,'1.2.3','42','ios','foreground','always','online','{}',7,'50000000-0000-4000-8000-000000000004');
DO $$ BEGIN
 IF (SELECT array_position(quality_flags,'implausible_jump') FROM mise_driver_locations WHERE action_id='30000000-0000-4000-8000-000000000004') IS NULL THEN RAISE EXCEPTION 'jump flag missing'; END IF;
END $$;

-- Exact replay does not create history.
SELECT fn_ingest_driver_gps_v2(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001',
 2,(SELECT base+interval '5 seconds' FROM t06_gps_test_clock),52.5001,13.4001,10,NULL,NULL,'1.2.3','42','ios','background','always','offline','{}',7,'50000000-0000-4000-8000-000000000002');
DO $$ BEGIN IF (SELECT count(*) FROM mise_driver_locations) <> 4 THEN RAISE EXCEPTION 'replay duplicated'; END IF; END $$;

-- Same action/sequence with changed payload is rejected, not silently replayed.
DO $$ DECLARE r jsonb; BEGIN
 SELECT fn_ingest_driver_gps_v2(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001',
 2,(SELECT base+interval '5 seconds' FROM t06_gps_test_clock),53.0,13.4001,10,NULL,NULL,'1.2.3','42','ios','background','always','offline','{}',7,'50000000-0000-4000-8000-000000000002') INTO r;
 IF r->>'reason_code'<>'GPS_REPLAY_PAYLOAD_CONFLICT' THEN RAISE EXCEPTION 'changed replay accepted: %',r; END IF;
END $$;

DO $$ DECLARE r jsonb; BEGIN
 SELECT fn_ingest_driver_gps_v2(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001',
 2,(SELECT base+interval '5 seconds' FROM t06_gps_test_clock),52.5001,13.4001,10,NULL,NULL,'1.2.3','42','ios','background','always','offline','{}',6,'50000000-0000-4000-8000-000000000002') INTO r;
 IF r->>'reason_code'<>'EXPECTED_DRIVER_VERSION_CONFLICT' THEN RAISE EXCEPTION 'changed expected version replay accepted: %',r; END IF;
END $$;

DO $$ DECLARE r jsonb; BEGIN
 SELECT fn_ingest_driver_gps_v2(
 '10000000-0000-4000-8000-000000000099','20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001',
 2,(SELECT base+interval '5 seconds' FROM t06_gps_test_clock),52.5001,13.4001,10,NULL,NULL,'1.2.3','42','ios','background','always','offline','{}',7,'50000000-0000-4000-8000-000000000002') INTO r;
 IF r->>'reason_code'<>'DRIVER_TENANT_FORBIDDEN' THEN RAISE EXCEPTION 'cross tenant replay accepted: %',r; END IF;
END $$;

DO $$ DECLARE r jsonb; BEGIN
 SELECT fn_ingest_driver_gps_v2(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000099',
 1,(SELECT base+interval '7 seconds' FROM t06_gps_test_clock),52.5,13.4,10,NULL,NULL,'1.2.3','42','ios','foreground','always','online','{}',7,'50000000-0000-4000-8000-000000000002') INTO r;
 IF r->>'reason_code'<>'GPS_REPLAY_PAYLOAD_CONFLICT' THEN RAISE EXCEPTION 'cross-session action reuse accepted: %',r; END IF;
END $$;

-- A first packet authorizes a successor session and permanently retires the
-- old session; a later old-session packet cannot alternate current back.
SELECT fn_ingest_driver_gps_v2(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000010','40000000-0000-4000-8000-000000000002',
 1,(SELECT base+interval '1 minute' FROM t06_gps_test_clock),52.51,13.41,10,NULL,NULL,'1.2.3','42','ios','foreground','always','online','{}',7,'50000000-0000-4000-8000-000000000010');
SELECT fn_ingest_driver_gps_v2(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000011','40000000-0000-4000-8000-000000000001',
 4,(SELECT base+interval '2 minutes' FROM t06_gps_test_clock),52.52,13.42,10,NULL,NULL,'1.2.3','42','ios','foreground','always','online','{}',7,'50000000-0000-4000-8000-000000000011');
DO $$ BEGIN
 IF (SELECT session_id FROM mise_driver_position_current)<>'40000000-0000-4000-8000-000000000002' THEN RAISE EXCEPTION 'retired session reclaimed current'; END IF;
 IF (SELECT ingest_outcome FROM mise_driver_locations WHERE action_id='30000000-0000-4000-8000-000000000011') IS DISTINCT FROM 'valid_history_only' THEN RAISE EXCEPTION 'retired session not history-only'; END IF;
END $$;

CREATE OR REPLACE FUNCTION test_gps_race(p_action uuid,p_session uuid,p_time timestamptz)
RETURNS jsonb LANGUAGE sql AS $$
 SELECT fn_ingest_driver_gps_v2(
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 p_action,p_session,1,p_time,52.53,13.43,10,NULL,NULL,'1.2.3','42','ios','foreground',
 'always','online','{}',7,'50000000-0000-4000-8000-000000000020')
$$;

-- Retention is independently default-off.
DO $$ BEGIN
 BEGIN PERFORM fn_cleanup_driver_gps_v2('10000000-0000-4000-8000-000000000001',100); RAISE EXCEPTION 'cleanup unexpectedly enabled';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'GPS_RETENTION_DEFAULT_OFF' THEN RAISE; END IF; END;
END $$;
