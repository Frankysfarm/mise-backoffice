CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE postgres;
CREATE TABLE public.tenants(id uuid PRIMARY KEY);
CREATE TABLE public.mise_drivers(
  id uuid PRIMARY KEY, state text NOT NULL, state_version bigint NOT NULL DEFAULT 0
);
CREATE TABLE public.mise_driver_tenants(
  driver_id uuid NOT NULL, tenant_id uuid NOT NULL, status text NOT NULL
);
CREATE TABLE public.mise_driver_locations(
  id bigserial PRIMARY KEY, driver_id uuid NOT NULL, lat double precision NOT NULL,
  lng double precision NOT NULL, accuracy_m double precision, heading double precision,
  speed_kmh double precision, batch_id uuid, recorded_at timestamptz NOT NULL
);
