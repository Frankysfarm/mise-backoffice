DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN
    CREATE ROLE authenticator LOGIN PASSWORD 'testlab-postgrest';
  END IF;
END $$;

GRANT anon, authenticated, service_role TO authenticator;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.locations, public.menu_items, public.customer_orders, public.order_items TO service_role;

ALTER TABLE public.menu_items ADD COLUMN category_id uuid;
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE
);
CREATE TABLE public.employees (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  auth_user_id uuid UNIQUE,
  rolle text NOT NULL,
  muss_passwort_aendern boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.employees TO authenticated, service_role;
ALTER TABLE public.locations
  ADD COLUMN tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  ADD COLUMN name text NOT NULL DEFAULT 'Testlab Location';

CREATE TABLE public.mise_drivers (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  state text NOT NULL,
  last_position_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  auth_user_id uuid,
  employee_id uuid,
  phone text,
  email text,
  vehicle text NOT NULL DEFAULT 'bike',
  max_radius_km numeric NOT NULL DEFAULT 10,
  frank_mode text NOT NULL DEFAULT 'manual',
  total_deliveries integer NOT NULL DEFAULT 0,
  total_earnings numeric NOT NULL DEFAULT 0,
  initial_code_consumed_at timestamptz,
  initial_code_expires_at timestamptz
);
CREATE TABLE public.mise_driver_tenants (
  id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  driver_id uuid NOT NULL REFERENCES public.mise_drivers(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  status text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(driver_id, tenant_id)
);
CREATE TABLE public.mise_delivery_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.mise_drivers(id),
  state text NOT NULL,
  location_id uuid REFERENCES public.locations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  picked_up_at timestamptz,
  completed_at timestamptz
);
ALTER TABLE public.customer_orders
  ADD COLUMN fertig_am timestamptz,
  ADD COLUMN bestellt_am timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN tenant_id uuid REFERENCES public.tenants(id),
  ADD COLUMN mise_batch_id uuid REFERENCES public.mise_delivery_batches(id),
  ADD COLUMN mise_driver_id uuid REFERENCES public.mise_drivers(id),
  ADD COLUMN eta_latest timestamptz,
  ADD COLUMN geliefert_am timestamptz,
  ADD COLUMN kunde_plz text,
  ADD COLUMN kunde_lat numeric,
  ADD COLUMN kunde_lng numeric,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE public.mise_delivery_batch_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.mise_delivery_batches(id),
  order_id uuid NOT NULL REFERENCES public.customer_orders(id),
  type text NOT NULL,
  sequence integer NOT NULL,
  lat numeric,
  lng numeric,
  address text
);
CREATE TABLE public.mise_driver_locations (
  id bigserial PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES public.mise_drivers(id),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy_m double precision,
  heading double precision,
  speed_kmh double precision,
  batch_id uuid,
  recorded_at timestamptz NOT NULL
);
GRANT SELECT ON public.mise_driver_locations TO service_role;
CREATE TABLE public.mise_push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.mise_drivers(id),
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  sound text,
  priority text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items
  ADD COLUMN station_id uuid,
  ADD COLUMN station_status text NOT NULL DEFAULT 'offen';

CREATE TABLE public.kitchen_stations (
  id uuid PRIMARY KEY,
  location_id uuid NOT NULL REFERENCES public.locations(id),
  display_token text NOT NULL UNIQUE,
  aktiv boolean NOT NULL DEFAULT true
);
CREATE TABLE public.station_category_routing (
  station_id uuid NOT NULL REFERENCES public.kitchen_stations(id),
  category_id uuid NOT NULL,
  PRIMARY KEY(station_id, category_id)
);

CREATE OR REPLACE FUNCTION public.testlab_route_order_item_to_station()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  SELECT routing.station_id INTO NEW.station_id
  FROM public.menu_items menu
  JOIN public.station_category_routing routing ON routing.category_id=menu.category_id
  JOIN public.kitchen_stations station ON station.id=routing.station_id AND station.aktiv=true
  WHERE menu.id=NEW.menu_item_id AND station.location_id=NEW.location_id;
  IF NEW.station_id IS NULL THEN RAISE EXCEPTION 'no kitchen station route'; END IF;
  NEW.station_status := 'offen';
  RETURN NEW;
END;
$$;
CREATE TRIGGER testlab_route_order_item_to_station
BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.testlab_route_order_item_to_station();

GRANT SELECT ON public.kitchen_stations TO service_role;

INSERT INTO public.tenants(id, name, slug)
VALUES ('80000000-0000-4000-8000-000000000001', 'Testlab Tenant', 'testlab-tenant');
INSERT INTO public.tenants(id, name, slug)
VALUES ('80000000-0000-4000-8000-000000000002', 'Foreign Testlab Tenant', 'foreign-testlab-tenant');
INSERT INTO public.employees(id, tenant_id, rolle)
VALUES ('81000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', 'admin');
INSERT INTO public.locations(id, tenant_id, name, aktiv)
VALUES ('10000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', 'Testlab Kitchen', true);

INSERT INTO public.mise_drivers(id, name, active, state, last_position_at)
VALUES ('90000000-0000-4000-8000-000000000001', 'Testfahrer', true, 'idle', now());
INSERT INTO public.mise_drivers(id, name, active, state, last_position_at)
VALUES ('90000000-0000-4000-8000-000000000002', 'Fremder Testfahrer', true, 'idle', now());
INSERT INTO public.mise_driver_tenants(driver_id, tenant_id, status)
VALUES ('90000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', 'active');
INSERT INTO public.mise_driver_tenants(driver_id, tenant_id, status)
VALUES ('90000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000002', 'active');

INSERT INTO public.kitchen_stations(id, location_id, display_token)
VALUES ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'testlab-kitchen-token');
INSERT INTO public.kitchen_stations(id, location_id, display_token)
VALUES ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'testlab-other-kitchen-token');
INSERT INTO public.station_category_routing(station_id, category_id)
VALUES ('40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001');
INSERT INTO public.menu_items(id, location_id, category_id, name, preis, verfuegbar)
VALUES ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'Testlab Bowl', 12.50, true);
INSERT INTO public.menu_items(id, location_id, category_id, name, preis, verfuegbar)
VALUES ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'Testlab Side', 4.50, true);
