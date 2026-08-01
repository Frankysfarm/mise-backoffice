-- Transactional handoff test double. Production resolves the same signature to
-- migration 282's real atomic append implementation.
CREATE OR REPLACE FUNCTION public.fn_append_order_to_route_v2(
  p_tenant_id uuid,p_writer_id uuid,p_writer_epoch bigint,p_driver_id uuid,
  p_expected_driver_version bigint,p_batch_id uuid,p_expected_route_version bigint,
  p_order_id uuid,p_expected_order_version bigint,p_pickup_stop_id uuid,
  p_dropoff_stop_id uuid,p_pickup_lat numeric,p_pickup_lng numeric,
  p_dropoff_lat numeric,p_dropoff_lng numeric,p_pickup_address text,
  p_dropoff_address text,p_pickup_deadline_at timestamptz,
  p_delivery_deadline_at timestamptz,p_route_stops jsonb,p_arrivals jsonb,
  p_explanation jsonb,p_matrix_fallback_used boolean,p_action_id uuid,
  p_correlation_id uuid
) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('ok',true,'stub_atomic',true) $$;
