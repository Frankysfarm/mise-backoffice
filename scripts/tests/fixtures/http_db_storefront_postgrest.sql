DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN
    CREATE ROLE authenticator LOGIN PASSWORD 'testlab-postgrest';
  END IF;
END $$;

GRANT anon, authenticated, service_role TO authenticator;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.locations, public.menu_items, public.customer_orders, public.order_items TO service_role;

ALTER TABLE public.menu_items ADD COLUMN category_id uuid;
ALTER TABLE public.customer_orders
  ADD COLUMN fertig_am timestamptz,
  ADD COLUMN bestellt_am timestamptz NOT NULL DEFAULT now();
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

INSERT INTO public.locations(id, aktiv)
VALUES ('10000000-0000-4000-8000-000000000001', true);

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
