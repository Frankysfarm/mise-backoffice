CREATE TABLE public.mise_driver_position_history (
  event_id uuid PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES public.mise_drivers(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  received_at timestamptz NOT NULL,
  latitude numeric NOT NULL DEFAULT 0,
  longitude numeric NOT NULL DEFAULT 0
);
