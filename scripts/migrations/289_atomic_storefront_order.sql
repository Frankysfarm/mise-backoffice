-- Atomic, idempotent public Storefront order creation.
-- The API may execute this function only through service_role.

CREATE TABLE IF NOT EXISTS public.storefront_order_requests_v1 (
  idempotency_key uuid PRIMARY KEY,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  location_id uuid NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.storefront_order_requests_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.storefront_order_requests_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.storefront_order_requests_v1 TO service_role;

CREATE OR REPLACE FUNCTION public.fn_storefront_create_order_v1(
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_location_id uuid,
  p_items jsonb,
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_type text,
  p_payment_method text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  old_request public.storefront_order_requests_v1%ROWTYPE;
  created_order record;
  result jsonb;
  item_count integer;
  catalog_count integer;
  subtotal numeric(14,2);
BEGIN
  IF p_idempotency_key IS NULL OR p_request_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid idempotency identity' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 289));
  SELECT * INTO old_request FROM public.storefront_order_requests_v1 WHERE idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF old_request.request_fingerprint <> p_request_fingerprint THEN
      RETURN jsonb_build_object('ok',false,'reason_code','IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN old_request.result || jsonb_build_object('idempotent_replay',true);
  END IF;

  IF p_location_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.locations WHERE id=p_location_id AND aktiv=true) THEN
    RETURN jsonb_build_object('ok',false,'reason_code','LOCATION_NOT_ORDERABLE');
  END IF;
  IF p_type NOT IN ('lieferung','abholung') OR p_payment_method NOT IN ('bar','karte') THEN
    RETURN jsonb_build_object('ok',false,'reason_code','INVALID_ORDER_MODE');
  END IF;
  IF length(btrim(coalesce(p_customer_name,''))) NOT BETWEEN 1 AND 120
     OR length(btrim(coalesce(p_customer_phone,''))) NOT BETWEEN 1 AND 64
     OR (p_type='lieferung' AND length(btrim(coalesce(p_customer_address,''))) NOT BETWEEN 1 AND 500) THEN
    RETURN jsonb_build_object('ok',false,'reason_code','INVALID_CUSTOMER');
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 THEN
    RETURN jsonb_build_object('ok',false,'reason_code','INVALID_ITEMS');
  END IF;

  SELECT count(*), count(DISTINCT x.id)
    INTO item_count, catalog_count
  FROM jsonb_to_recordset(p_items) AS x(id uuid, qty integer)
  WHERE x.id IS NOT NULL AND x.qty BETWEEN 1 AND 99;
  IF item_count <> jsonb_array_length(p_items) OR catalog_count <> item_count THEN
    RETURN jsonb_build_object('ok',false,'reason_code','INVALID_ITEMS');
  END IF;

  -- Locks make catalog validation and writes one coherent transaction snapshot.
  PERFORM 1 FROM public.menu_items m
  JOIN jsonb_to_recordset(p_items) AS x(id uuid, qty integer) ON x.id=m.id
  WHERE m.location_id=p_location_id AND m.verfuegbar=true
  FOR SHARE OF m;

  SELECT count(*), round(sum(m.preis*x.qty)::numeric,2)
    INTO catalog_count, subtotal
  FROM jsonb_to_recordset(p_items) AS x(id uuid, qty integer)
  JOIN public.menu_items m ON m.id=x.id
  WHERE m.location_id=p_location_id AND m.verfuegbar=true
    AND m.preis IS NOT NULL AND m.preis>=0 AND m.preis<=100000;
  IF catalog_count <> item_count OR subtotal IS NULL THEN
    RETURN jsonb_build_object('ok',false,'reason_code','ITEM_NOT_AVAILABLE');
  END IF;

  INSERT INTO public.customer_orders(
    id,location_id,typ,status,kunde_name,kunde_telefon,kunde_adresse,
    zwischensumme,gesamtbetrag,zahlungsart,bezahlt,quelle
  ) VALUES (
    gen_random_uuid(),p_location_id,p_type,'neu',btrim(p_customer_name),btrim(p_customer_phone),
    nullif(btrim(coalesce(p_customer_address,'')),''),subtotal,subtotal,p_payment_method,false,'storefront'
  ) RETURNING id,bestellnummer,status INTO created_order;

  INSERT INTO public.order_items(order_id,location_id,menu_item_id,name,menge,einzelpreis,gesamtpreis,position)
  SELECT created_order.id,p_location_id,m.id,m.name,x.qty,m.preis,round((m.preis*x.qty)::numeric,2),x.position::integer
  FROM ROWS FROM (jsonb_to_recordset(p_items) AS (id uuid,qty integer)) WITH ORDINALITY AS x(id,qty,position)
  JOIN public.menu_items m ON m.id=x.id
  ORDER BY x.position;

  result := jsonb_build_object('ok',true,'id',created_order.id,'bestellnummer',created_order.bestellnummer,
    'status',created_order.status,'idempotent_replay',false);
  INSERT INTO public.storefront_order_requests_v1(idempotency_key,request_fingerprint,location_id,result)
  VALUES(p_idempotency_key,p_request_fingerprint,p_location_id,result);
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_storefront_create_order_v1(uuid,text,uuid,jsonb,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_storefront_create_order_v1(uuid,text,uuid,jsonb,text,text,text,text,text) TO service_role;

COMMENT ON FUNCTION public.fn_storefront_create_order_v1(uuid,text,uuid,jsonb,text,text,text,text,text) IS
  'Atomically validates canonical menu rows and creates exactly one Storefront order per idempotency key.';
