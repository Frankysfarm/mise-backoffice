DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN
    CREATE ROLE authenticator LOGIN PASSWORD 'testlab-postgrest';
  END IF;
END $$;

GRANT anon, authenticated, service_role TO authenticator;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.locations, public.menu_items, public.customer_orders, public.order_items TO service_role;

INSERT INTO public.locations(id, aktiv)
VALUES ('10000000-0000-4000-8000-000000000001', true);

INSERT INTO public.menu_items(id, location_id, name, preis, verfuegbar)
VALUES ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Testlab Bowl', 12.50, true);
