INSERT INTO locations(id,aktiv) VALUES
 ('91000000-0000-4000-8000-000000000001',true),('91000000-0000-4000-8000-000000000002',true);
INSERT INTO menu_items(id,location_id,name,preis,verfuegbar) VALUES
 ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','Canonical Bowl',12.50,true),
 ('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002','Foreign Bowl',0.01,true),
 ('92000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000001','Unavailable',1.00,false),
 ('92000000-0000-4000-8000-000000000004','91000000-0000-4000-8000-000000000001','Fraction A',0.005,true),
 ('92000000-0000-4000-8000-000000000005','91000000-0000-4000-8000-000000000001','Fraction B',0.005,true);

DO $$ DECLARE first_result jsonb; replay jsonb; conflict jsonb; rejected jsonb; BEGIN
 first_result:=fn_storefront_create_order_v1('93000000-0000-4000-8000-000000000001',repeat('a',64),
  '91000000-0000-4000-8000-000000000001','[{"id":"92000000-0000-4000-8000-000000000001","qty":2}]',
  'Testkunde','synthetic:phone','Laborstraße 2','lieferung','bar');
 IF first_result->>'ok'<>'true' OR first_result->>'idempotent_replay'<>'false' THEN RAISE EXCEPTION 'first create failed %',first_result; END IF;
 UPDATE menu_items SET verfuegbar=false WHERE id='92000000-0000-4000-8000-000000000001';
 replay:=fn_storefront_create_order_v1('93000000-0000-4000-8000-000000000001',repeat('a',64),
  '91000000-0000-4000-8000-000000000001','[{"id":"92000000-0000-4000-8000-000000000001","qty":2}]',
  'Testkunde','synthetic:phone','Laborstraße 2','lieferung','bar');
 IF replay->>'id'<>first_result->>'id' OR replay->>'idempotent_replay'<>'true' THEN RAISE EXCEPTION 'replay failed %',replay; END IF;
 UPDATE menu_items SET verfuegbar=true WHERE id='92000000-0000-4000-8000-000000000001';
 conflict:=fn_storefront_create_order_v1('93000000-0000-4000-8000-000000000001',repeat('b',64),
  '91000000-0000-4000-8000-000000000001','[{"id":"92000000-0000-4000-8000-000000000001","qty":1}]',
  'Other','synthetic:other','Laborstraße 3','lieferung','bar');
 IF conflict->>'reason_code'<>'IDEMPOTENCY_CONFLICT' THEN RAISE EXCEPTION 'conflict accepted %',conflict; END IF;
 rejected:=fn_storefront_create_order_v1('93000000-0000-4000-8000-000000000002',repeat('c',64),
  '91000000-0000-4000-8000-000000000001','[{"id":"92000000-0000-4000-8000-000000000002","qty":1}]',
  'Testkunde','synthetic:phone','Laborstraße 2','lieferung','bar');
 IF rejected->>'reason_code'<>'ITEM_NOT_AVAILABLE' THEN RAISE EXCEPTION 'foreign item accepted %',rejected; END IF;
 IF (SELECT count(*) FROM customer_orders)<>1 OR (SELECT count(*) FROM order_items)<>1 THEN RAISE EXCEPTION 'non-idempotent row counts'; END IF;
 IF (SELECT einzelpreis FROM order_items LIMIT 1)<>12.50 OR (SELECT gesamtpreis FROM order_items LIMIT 1)<>25.00 THEN RAISE EXCEPTION 'noncanonical price'; END IF;
END $$;

DO $$ BEGIN
 IF has_function_privilege('anon','public.fn_storefront_create_order_v1(uuid,text,uuid,jsonb,text,text,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'anon can execute storefront RPC'; END IF;
 IF has_function_privilege('authenticated','public.fn_storefront_create_order_v1(uuid,text,uuid,jsonb,text,text,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'authenticated can execute storefront RPC'; END IF;
 IF NOT has_function_privilege('service_role','public.fn_storefront_create_order_v1(uuid,text,uuid,jsonb,text,text,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'service role cannot execute storefront RPC'; END IF;
END $$;

-- Any item-write failure must roll the header and request row back together.
CREATE FUNCTION reject_order_item() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic item failure'; END $$;
CREATE TRIGGER reject_order_item BEFORE INSERT ON order_items FOR EACH ROW EXECUTE FUNCTION reject_order_item();
DO $$ BEGIN
 BEGIN
  PERFORM fn_storefront_create_order_v1('93000000-0000-4000-8000-000000000003',repeat('d',64),
   '91000000-0000-4000-8000-000000000001','[{"id":"92000000-0000-4000-8000-000000000001","qty":1}]',
   'Rollback','synthetic:rollback','Laborstraße 4','lieferung','bar');
  RAISE EXCEPTION 'expected failure absent';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='expected failure absent' THEN RAISE; END IF;
 END;
 IF EXISTS(SELECT 1 FROM storefront_order_requests_v1 WHERE idempotency_key='93000000-0000-4000-8000-000000000003') THEN RAISE EXCEPTION 'request survived rollback'; END IF;
 IF (SELECT count(*) FROM customer_orders)<>1 THEN RAISE EXCEPTION 'orphan header survived rollback'; END IF;
END $$;
DROP TRIGGER reject_order_item ON order_items;
DROP FUNCTION reject_order_item();

DO $$ DECLARE accounting jsonb; order_total numeric; line_total numeric; BEGIN
 accounting:=fn_storefront_create_order_v1('93000000-0000-4000-8000-000000000004',repeat('4',64),
  '91000000-0000-4000-8000-000000000001',
  '[{"id":"92000000-0000-4000-8000-000000000004","qty":1},{"id":"92000000-0000-4000-8000-000000000005","qty":1}]',
  'Accounting','synthetic:accounting','Laborstraße 5','lieferung','bar');
 SELECT gesamtbetrag INTO order_total FROM customer_orders WHERE id=(accounting->>'id')::uuid;
 SELECT sum(gesamtpreis) INTO line_total FROM order_items WHERE order_id=(accounting->>'id')::uuid;
 IF order_total<>0.02 OR line_total<>order_total THEN RAISE EXCEPTION 'money invariant failed header %, lines %',order_total,line_total; END IF;
 IF EXISTS(SELECT 1 FROM order_items WHERE order_id=(accounting->>'id')::uuid AND einzelpreis<>0.01) THEN RAISE EXCEPTION 'unit price scale failed'; END IF;
END $$;

SELECT 'T14 atomic storefront order: PASS' AS result;
