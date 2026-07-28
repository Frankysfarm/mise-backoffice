-- T06 canonical GPS history/current authority. Runtime and retention are default-off.
CREATE TABLE IF NOT EXISTS public.mise_gps_transport_config (
  tenant_id uuid PRIMARY KEY,
  tracking_enabled boolean NOT NULL DEFAULT false,
  background_tracking_enabled boolean NOT NULL DEFAULT false,
  retention_enabled boolean NOT NULL DEFAULT false,
  retention_days integer NOT NULL DEFAULT 30 CHECK (retention_days BETWEEN 7 AND 365),
  max_accuracy_m double precision NOT NULL DEFAULT 200 CHECK (max_accuracy_m BETWEEN 1 AND 10000),
  max_future_skew_seconds integer NOT NULL DEFAULT 60 CHECK (max_future_skew_seconds BETWEEN 0 AND 600),
  max_history_age_seconds integer NOT NULL DEFAULT 86400 CHECK (max_history_age_seconds BETWEEN 60 AND 604800),
  max_jump_speed_mps double precision NOT NULL DEFAULT 80 CHECK (max_jump_speed_mps BETWEEN 1 AND 500),
  active_stale_seconds integer NOT NULL DEFAULT 90 CHECK (active_stale_seconds BETWEEN 10 AND 3600),
  idle_stale_seconds integer NOT NULL DEFAULT 180 CHECK (idle_stale_seconds BETWEEN 10 AND 7200),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.mise_driver_position_current (
  driver_id uuid PRIMARY KEY REFERENCES public.mise_drivers(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  installation_id uuid NOT NULL,
  session_id uuid NOT NULL,
  sequence bigint NOT NULL CHECK (sequence >= 0),
  captured_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_m double precision NOT NULL CHECK (accuracy_m BETWEEN 0 AND 10000),
  speed_mps double precision,
  heading_deg double precision,
  altitude_m double precision,
  app_version text NOT NULL,
  app_build text,
  platform text NOT NULL CHECK (platform IN ('ios','android','web')),
  app_state text NOT NULL CHECK (app_state IN ('foreground','background','locked','unknown')),
  permission_state text NOT NULL,
  network_state text NOT NULL,
  tracking_mode text NOT NULL CHECK (tracking_mode IN ('continuous','significant_change','foreground_only')),
  battery_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  capability_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_flags text[] NOT NULL DEFAULT '{}',
  operational_state text NOT NULL,
  position_version bigint NOT NULL DEFAULT 1,
  correlation_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS public.mise_driver_gps_sessions (
  driver_id uuid NOT NULL REFERENCES public.mise_drivers(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  retired_at timestamptz,
  PRIMARY KEY(driver_id,session_id)
);

ALTER TABLE public.mise_driver_locations
  ADD COLUMN IF NOT EXISTS tracking_session_id uuid,
  ADD COLUMN IF NOT EXISTS installation_id uuid,
  ADD COLUMN IF NOT EXISTS sequence bigint,
  ADD COLUMN IF NOT EXISTS captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS accuracy_m double precision,
  ADD COLUMN IF NOT EXISTS speed_mps double precision,
  ADD COLUMN IF NOT EXISTS heading_deg double precision,
  ADD COLUMN IF NOT EXISTS altitude_m double precision,
  ADD COLUMN IF NOT EXISTS app_version text,
  ADD COLUMN IF NOT EXISTS app_build text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS app_state text,
  ADD COLUMN IF NOT EXISTS permission_state text,
  ADD COLUMN IF NOT EXISTS network_state text,
  ADD COLUMN IF NOT EXISTS tracking_mode text,
  ADD COLUMN IF NOT EXISTS battery_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS capability_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS quality_flags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS correlation_id uuid,
  ADD COLUMN IF NOT EXISTS ingest_outcome text;
ALTER TABLE public.mise_driver_locations
  ADD COLUMN IF NOT EXISTS action_id uuid,
  ADD COLUMN IF NOT EXISTS event_fingerprint text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mise_driver_locations_replay
  ON public.mise_driver_locations(driver_id, tracking_session_id, sequence)
  WHERE tracking_session_id IS NOT NULL AND sequence IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mise_driver_locations_action
  ON public.mise_driver_locations(driver_id,action_id) WHERE action_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mise_driver_locations_received
  ON public.mise_driver_locations(received_at);

CREATE OR REPLACE FUNCTION public.fn_ingest_driver_gps_v2(
  p_tenant_id uuid, p_driver_id uuid, p_action_id uuid, p_session_id uuid,
  p_sequence bigint, p_captured_at timestamptz, p_latitude double precision,
  p_longitude double precision, p_accuracy_m double precision,
  p_speed_mps double precision, p_heading_deg double precision,
  p_app_version text, p_app_build text, p_platform text, p_app_state text,
  p_permission_state text, p_network_state text, p_capability_flags jsonb,
  p_expected_driver_version bigint, p_correlation_id uuid,
  p_installation_id uuid DEFAULT NULL, p_altitude_m double precision DEFAULT NULL,
  p_tracking_mode text DEFAULT NULL, p_battery_state jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_cfg public.mise_gps_transport_config%ROWTYPE;
  v_driver public.mise_drivers%ROWTYPE;
  v_current public.mise_driver_position_current%ROWTYPE;
  v_flags text[] := '{}';
  v_outcome text;
  v_distance_m double precision;
  v_elapsed_s double precision;
  v_replay record;
  v_fingerprint text;
  v_session_retired boolean := false;
  v_has_current boolean := false;
BEGIN
  SELECT * INTO v_driver FROM public.mise_drivers WHERE id=p_driver_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.mise_driver_tenants WHERE driver_id=p_driver_id AND tenant_id=p_tenant_id AND status='active') THEN RETURN jsonb_build_object('ok',false,'reason_code','DRIVER_TENANT_FORBIDDEN'); END IF;
  IF v_driver.state_version <> p_expected_driver_version THEN RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_DRIVER_VERSION_CONFLICT'); END IF;
  SELECT * INTO v_cfg FROM public.mise_gps_transport_config WHERE tenant_id=p_tenant_id;
  IF NOT FOUND OR NOT v_cfg.tracking_enabled THEN RETURN jsonb_build_object('ok',false,'reason_code','GPS_TRACKING_DEFAULT_OFF'); END IF;
  IF p_app_state IN ('background','locked') AND NOT v_cfg.background_tracking_enabled THEN
    RETURN jsonb_build_object('ok',false,'reason_code','GPS_BACKGROUND_TRACKING_DEFAULT_OFF');
  END IF;
  IF v_driver.state NOT IN ('available','assigned','at_pickup','delivering','returning') THEN
    RETURN jsonb_build_object('ok',false,'reason_code','GPS_OPERATIONAL_STATE_BLOCKED');
  END IF;
  v_fingerprint := md5(concat_ws('|','upload_gps',p_action_id,p_tenant_id,p_driver_id,
    p_expected_driver_version,coalesce(p_installation_id,p_session_id),p_session_id,p_sequence,p_captured_at,p_latitude,
    p_longitude,p_accuracy_m,p_speed_mps,p_heading_deg,p_altitude_m,p_app_version,p_app_build,
    p_platform,p_app_state,p_permission_state,p_network_state,p_tracking_mode,
    coalesce(p_battery_state,'{}'::jsonb)::text,coalesce(p_capability_flags,'{}'::jsonb)::text));
  SELECT ingest_outcome,quality_flags,received_at,event_fingerprint INTO v_replay
    FROM public.mise_driver_locations WHERE driver_id=p_driver_id
      AND (action_id=p_action_id OR (tracking_session_id=p_session_id AND sequence=p_sequence)) LIMIT 1;
  IF FOUND THEN
    IF v_replay.event_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RETURN jsonb_build_object('ok',false,'reason_code','GPS_REPLAY_PAYLOAD_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok',true,'replayed',true,'outcome',v_replay.ingest_outcome,'quality_flags',v_replay.quality_flags,'received_at',v_replay.received_at);
  END IF;
  IF p_sequence < 0 OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180
    OR p_accuracy_m NOT BETWEEN 0 AND 10000 OR p_platform NOT IN ('ios','android','web')
    OR p_app_state NOT IN ('foreground','background','locked','unknown')
    OR coalesce(p_tracking_mode,'foreground_only') NOT IN ('continuous','significant_change','foreground_only')
    OR (p_battery_state ? 'level' AND (
      jsonb_typeof(p_battery_state->'level')<>'number'
      OR (p_battery_state->>'level')::double precision NOT BETWEEN 0 AND 1))
    OR length(p_app_version) NOT BETWEEN 1 AND 64
    OR p_captured_at > v_now + make_interval(secs=>v_cfg.max_future_skew_seconds)
    OR p_captured_at < v_now - make_interval(secs=>v_cfg.max_history_age_seconds) THEN
    RETURN jsonb_build_object('ok',false,'reason_code','INVALID_GPS_EVENT');
  END IF;
  IF p_accuracy_m > v_cfg.max_accuracy_m THEN v_flags := array_append(v_flags,'inaccurate'); END IF;
  IF p_permission_state IN ('denied','restricted') THEN v_flags := array_append(v_flags,'permission_'||p_permission_state); END IF;
  IF p_network_state='offline' THEN v_flags := array_append(v_flags,'network_offline'); END IF;
  IF p_captured_at < v_now - make_interval(secs=>CASE WHEN v_driver.state IN ('assigned','at_pickup','delivering') THEN v_cfg.active_stale_seconds ELSE v_cfg.idle_stale_seconds END)
    THEN v_flags := array_append(v_flags,'delayed'); END IF;
  SELECT * INTO v_current FROM public.mise_driver_position_current WHERE driver_id=p_driver_id FOR UPDATE;
  v_has_current := FOUND;
  IF v_has_current AND p_session_id<>v_current.session_id THEN
    SELECT retired_at IS NOT NULL INTO v_session_retired FROM public.mise_driver_gps_sessions
      WHERE driver_id=p_driver_id AND session_id=p_session_id;
    v_session_retired := coalesce(v_session_retired,false);
  END IF;
  IF FOUND AND p_captured_at > v_current.captured_at THEN
    v_elapsed_s := extract(epoch FROM p_captured_at-v_current.captured_at);
    v_distance_m := 2*6371000*asin(sqrt(power(sin(radians(p_latitude-v_current.latitude)/2),2)+cos(radians(v_current.latitude))*cos(radians(p_latitude))*power(sin(radians(p_longitude-v_current.longitude)/2),2)));
    IF v_elapsed_s > 0 AND v_distance_m/v_elapsed_s > v_cfg.max_jump_speed_mps THEN v_flags := array_append(v_flags,'implausible_jump'); END IF;
  END IF;
  v_outcome := CASE WHEN NOT v_has_current OR
    (p_session_id=v_current.session_id AND p_sequence>v_current.sequence AND p_captured_at>v_current.captured_at) OR
    -- A successor session is authorized only by its first packet. This fences
    -- delayed packets from an older/replaced session from reclaiming current.
    (p_session_id<>v_current.session_id AND NOT v_session_retired
      AND p_sequence IN (0,1) AND p_captured_at>v_current.captured_at)
    THEN 'monotonic_current_advance' ELSE 'valid_history_only' END;
  INSERT INTO public.mise_driver_locations(driver_id,lat,lng,recorded_at,installation_id,tracking_session_id,sequence,captured_at,received_at,accuracy_m,speed_mps,heading_deg,altitude_m,app_version,app_build,platform,app_state,permission_state,network_state,tracking_mode,battery_state,capability_flags,quality_flags,correlation_id,ingest_outcome,action_id,event_fingerprint)
    VALUES(p_driver_id,p_latitude,p_longitude,v_now,coalesce(p_installation_id,p_session_id),p_session_id,p_sequence,p_captured_at,v_now,p_accuracy_m,p_speed_mps,p_heading_deg,p_altitude_m,p_app_version,p_app_build,p_platform,p_app_state,p_permission_state,p_network_state,coalesce(p_tracking_mode,'foreground_only'),coalesce(p_battery_state,'{}'),coalesce(p_capability_flags,'{}'),v_flags,p_correlation_id,v_outcome,p_action_id,v_fingerprint);
  IF v_outcome='monotonic_current_advance' THEN
    IF v_has_current AND p_session_id<>v_current.session_id THEN
      UPDATE public.mise_driver_gps_sessions SET retired_at=v_now
        WHERE driver_id=p_driver_id AND session_id=v_current.session_id AND retired_at IS NULL;
    END IF;
    INSERT INTO public.mise_driver_gps_sessions(driver_id,session_id,started_at)
      VALUES(p_driver_id,p_session_id,p_captured_at)
      ON CONFLICT(driver_id,session_id) DO NOTHING;
    INSERT INTO public.mise_driver_position_current(driver_id,tenant_id,installation_id,session_id,sequence,captured_at,received_at,latitude,longitude,accuracy_m,speed_mps,heading_deg,altitude_m,app_version,app_build,platform,app_state,permission_state,network_state,tracking_mode,battery_state,capability_flags,quality_flags,operational_state,position_version,correlation_id)
      VALUES(p_driver_id,p_tenant_id,coalesce(p_installation_id,p_session_id),p_session_id,p_sequence,p_captured_at,v_now,p_latitude,p_longitude,p_accuracy_m,p_speed_mps,p_heading_deg,p_altitude_m,p_app_version,p_app_build,p_platform,p_app_state,p_permission_state,p_network_state,coalesce(p_tracking_mode,'foreground_only'),coalesce(p_battery_state,'{}'),coalesce(p_capability_flags,'{}'),v_flags,v_driver.state,1,p_correlation_id)
    ON CONFLICT(driver_id) DO UPDATE SET installation_id=excluded.installation_id,session_id=excluded.session_id,sequence=excluded.sequence,captured_at=excluded.captured_at,received_at=excluded.received_at,latitude=excluded.latitude,longitude=excluded.longitude,accuracy_m=excluded.accuracy_m,speed_mps=excluded.speed_mps,heading_deg=excluded.heading_deg,altitude_m=excluded.altitude_m,app_version=excluded.app_version,app_build=excluded.app_build,platform=excluded.platform,app_state=excluded.app_state,permission_state=excluded.permission_state,network_state=excluded.network_state,tracking_mode=excluded.tracking_mode,battery_state=excluded.battery_state,capability_flags=excluded.capability_flags,quality_flags=excluded.quality_flags,operational_state=excluded.operational_state,position_version=mise_driver_position_current.position_version+1,correlation_id=excluded.correlation_id;
  END IF;
  RETURN jsonb_build_object('ok',true,'replayed',false,'outcome',v_outcome,'quality_flags',v_flags,'received_at',v_now);
END $$;

CREATE OR REPLACE FUNCTION public.fn_cleanup_driver_gps_v2(p_tenant_id uuid, p_limit integer DEFAULT 10000)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_cfg public.mise_gps_transport_config%ROWTYPE; v_count bigint;
BEGIN
  SELECT * INTO v_cfg FROM public.mise_gps_transport_config WHERE tenant_id=p_tenant_id;
  IF NOT FOUND OR NOT v_cfg.retention_enabled THEN RAISE EXCEPTION 'GPS_RETENTION_DEFAULT_OFF'; END IF;
  IF p_limit NOT BETWEEN 1 AND 50000 THEN RAISE EXCEPTION 'INVALID_CLEANUP_LIMIT'; END IF;
  DELETE FROM public.mise_driver_locations WHERE id IN (
    SELECT l.id FROM public.mise_driver_locations l JOIN public.mise_drivers d ON d.id=l.driver_id
    JOIN public.mise_driver_tenants dt ON dt.driver_id=d.id
    WHERE dt.tenant_id=p_tenant_id AND coalesce(l.received_at,l.recorded_at)<clock_timestamp()-make_interval(days=>v_cfg.retention_days)
    ORDER BY coalesce(l.received_at,l.recorded_at) LIMIT p_limit);
  GET DIAGNOSTICS v_count=ROW_COUNT; RETURN v_count;
END $$;

ALTER TABLE public.mise_driver_position_current ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mise_gps_transport_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mise_driver_gps_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mise_driver_position_current, public.mise_gps_transport_config, public.mise_driver_gps_sessions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.mise_driver_position_current, public.mise_gps_transport_config, public.mise_driver_gps_sessions TO service_role;
REVOKE ALL ON FUNCTION public.fn_ingest_driver_gps_v2(uuid,uuid,uuid,uuid,bigint,timestamptz,double precision,double precision,double precision,double precision,double precision,text,text,text,text,text,text,jsonb,bigint,uuid,uuid,double precision,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ingest_driver_gps_v2(uuid,uuid,uuid,uuid,bigint,timestamptz,double precision,double precision,double precision,double precision,double precision,text,text,text,text,text,text,jsonb,bigint,uuid,uuid,double precision,text,jsonb) TO service_role,postgres;
REVOKE ALL ON FUNCTION public.fn_cleanup_driver_gps_v2(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cleanup_driver_gps_v2(uuid,integer) TO service_role,postgres;
