-- Token-authenticated kitchen displays call this function through a server route.
-- One row lock serializes the item transition; the final required item promotes
-- the order to the existing canonical ready status `fertig` in the same commit.

CREATE OR REPLACE FUNCTION public.fn_kitchen_advance_item_v1(
  p_station_id uuid,
  p_item_id uuid,
  p_expected_status text,
  p_target_status text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_item record;
  v_order_status text;
  v_ready boolean := false;
BEGIN
  IF (p_expected_status, p_target_status) NOT IN (
    ('offen', 'in_arbeit'),
    ('in_arbeit', 'fertig')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'INVALID_TRANSITION');
  END IF;

  SELECT i.id, i.order_id, i.station_id, i.station_status::text AS station_status
    INTO v_item
  FROM public.order_items i
  WHERE i.id = p_item_id
  FOR UPDATE;

  IF v_item.id IS NULL OR v_item.station_id IS DISTINCT FROM p_station_id THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'ITEM_NOT_FOUND');
  END IF;

  -- Lost-response retry: the requested state was already committed.
  IF v_item.station_status = p_target_status THEN
    SELECT o.status::text INTO v_order_status
    FROM public.customer_orders o WHERE o.id = v_item.order_id;
    RETURN jsonb_build_object(
      'ok', true, 'item_id', v_item.id, 'item_status', p_target_status,
      'order_status', v_order_status, 'order_ready', v_order_status = 'fertig',
      'idempotent_replay', true
    );
  END IF;

  IF v_item.station_status <> p_expected_status THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'STALE_ITEM_STATUS');
  END IF;

  -- Different station workers may finish different items concurrently. The
  -- order lock serializes their final readiness decision.
  SELECT o.status::text INTO v_order_status
  FROM public.customer_orders o
  WHERE o.id = v_item.order_id
  FOR UPDATE;

  UPDATE public.order_items
  SET station_status = p_target_status
  WHERE id = v_item.id;

  IF p_target_status = 'in_arbeit' THEN
    UPDATE public.customer_orders
    SET status = 'in_zubereitung'
    WHERE id = v_item.order_id
      AND status::text IN ('neu', 'bestätigt', 'bestaetigt');
  ELSE
    SELECT NOT EXISTS (
      SELECT 1 FROM public.order_items other
      WHERE other.order_id = v_item.order_id
        AND other.station_status::text IS DISTINCT FROM 'fertig'
    ) INTO v_ready;

    IF v_ready THEN
      UPDATE public.customer_orders
      SET status = 'fertig', fertig_am = coalesce(fertig_am, now())
      WHERE id = v_item.order_id
        AND status::text IN ('neu', 'bestätigt', 'bestaetigt', 'in_zubereitung');
    END IF;
  END IF;

  SELECT o.status::text INTO v_order_status
  FROM public.customer_orders o WHERE o.id = v_item.order_id;
  RETURN jsonb_build_object(
    'ok', true, 'item_id', v_item.id, 'item_status', p_target_status,
    'order_status', v_order_status, 'order_ready', v_order_status = 'fertig',
    'idempotent_replay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_kitchen_advance_item_v1(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_kitchen_advance_item_v1(uuid,uuid,text,text) TO service_role;

COMMENT ON FUNCTION public.fn_kitchen_advance_item_v1(uuid,uuid,text,text) IS
  'CAS kitchen item transition; atomically marks the order fertig after its final required item.';
