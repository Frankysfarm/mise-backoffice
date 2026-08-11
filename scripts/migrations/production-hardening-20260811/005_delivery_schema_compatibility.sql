BEGIN;

-- The legacy schema calls the location flag `aktiv`; newer delivery modules
-- query `active` or `is_active`. Generated aliases keep one source of truth and
-- cannot drift apart.
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS active boolean
    GENERATED ALWAYS AS (aktiv) STORED,
  ADD COLUMN IF NOT EXISTS is_active boolean
    GENERATED ALWAYS AS (aktiv) STORED;

-- Keep all legacy delivery-zone columns and add the English delivery-engine
-- contract alongside them.
ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS min_km numeric(6,2),
  ADD COLUMN IF NOT EXISTS max_km numeric(6,2),
  ADD COLUMN IF NOT EXISTS surcharge_eur numeric(7,2),
  ADD COLUMN IF NOT EXISTS min_order_eur numeric(7,2),
  ADD COLUMN IF NOT EXISTS free_delivery_above_eur numeric(7,2),
  ADD COLUMN IF NOT EXISTS eta_base_min integer,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS active boolean,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY location_id
      ORDER BY radius_km_bis NULLS LAST, sort_order, id
    ) AS zone_no,
    lag(radius_km_bis, 1, 0::numeric) OVER (
      PARTITION BY location_id
      ORDER BY radius_km_bis NULLS LAST, sort_order, id
    ) AS previous_radius
  FROM public.delivery_zones
)
UPDATE public.delivery_zones AS dz
SET
  name = COALESCE(dz.name, CASE LEAST(r.zone_no, 4)
    WHEN 1 THEN 'A' WHEN 2 THEN 'B' WHEN 3 THEN 'C' ELSE 'D' END),
  label = COALESCE(dz.label, CASE LEAST(r.zone_no, 4)
    WHEN 1 THEN 'Express' WHEN 2 THEN 'Standard' WHEN 3 THEN 'Weit' ELSE 'Außerhalb' END),
  min_km = COALESCE(dz.min_km, r.previous_radius, 0),
  max_km = COALESCE(dz.max_km, dz.radius_km_bis, 999),
  surcharge_eur = COALESCE(dz.surcharge_eur, dz.liefergebuehr, 0),
  min_order_eur = COALESCE(dz.min_order_eur, dz.mindestbestellwert, 0),
  free_delivery_above_eur = COALESCE(dz.free_delivery_above_eur, NULLIF(dz.free_ab, 0)),
  eta_base_min = COALESCE(dz.eta_base_min, 20 + (LEAST(r.zone_no, 4) - 1) * 10),
  color = COALESCE(dz.color, CASE LEAST(r.zone_no, 4)
    WHEN 1 THEN '#22c55e' WHEN 2 THEN '#3b82f6' WHEN 3 THEN '#f59e0b' ELSE '#ef4444' END),
  active = COALESCE(dz.active, dz.aktiv, true),
  created_at = COALESCE(dz.created_at, dz.erstellt_am, now()),
  updated_at = COALESCE(dz.updated_at, dz.geaendert_am, now())
FROM ranked AS r
WHERE r.id = dz.id;

CREATE OR REPLACE FUNCTION public.sync_delivery_zone_contract()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.max_km := COALESCE(NEW.max_km, NEW.radius_km_bis, 999);
    NEW.radius_km_bis := COALESCE(NEW.radius_km_bis, NEW.max_km);
    NEW.surcharge_eur := COALESCE(NEW.surcharge_eur, NEW.liefergebuehr, 0);
    NEW.liefergebuehr := COALESCE(NEW.liefergebuehr, NEW.surcharge_eur, 0);
    NEW.min_order_eur := COALESCE(NEW.min_order_eur, NEW.mindestbestellwert, 0);
    NEW.mindestbestellwert := COALESCE(NEW.mindestbestellwert, NEW.min_order_eur, 0);
    NEW.free_delivery_above_eur := COALESCE(NEW.free_delivery_above_eur, NULLIF(NEW.free_ab, 0));
    NEW.free_ab := COALESCE(NEW.free_ab, NEW.free_delivery_above_eur, 0);
    NEW.active := COALESCE(NEW.active, NEW.aktiv, true);
    NEW.aktiv := COALESCE(NEW.aktiv, NEW.active, true);
    NEW.name := COALESCE(NEW.name, CASE
      WHEN NEW.max_km <= 4 THEN 'A'
      WHEN NEW.max_km <= 7 THEN 'B'
      WHEN NEW.max_km <= 10 THEN 'C'
      ELSE 'D' END);
  ELSE
    IF NEW.max_km IS DISTINCT FROM OLD.max_km THEN NEW.radius_km_bis := NEW.max_km;
    ELSIF NEW.radius_km_bis IS DISTINCT FROM OLD.radius_km_bis THEN NEW.max_km := NEW.radius_km_bis;
    END IF;
    IF NEW.surcharge_eur IS DISTINCT FROM OLD.surcharge_eur THEN NEW.liefergebuehr := NEW.surcharge_eur;
    ELSIF NEW.liefergebuehr IS DISTINCT FROM OLD.liefergebuehr THEN NEW.surcharge_eur := NEW.liefergebuehr;
    END IF;
    IF NEW.min_order_eur IS DISTINCT FROM OLD.min_order_eur THEN NEW.mindestbestellwert := NEW.min_order_eur;
    ELSIF NEW.mindestbestellwert IS DISTINCT FROM OLD.mindestbestellwert THEN NEW.min_order_eur := NEW.mindestbestellwert;
    END IF;
    IF NEW.free_delivery_above_eur IS DISTINCT FROM OLD.free_delivery_above_eur THEN
      NEW.free_ab := COALESCE(NEW.free_delivery_above_eur, 0);
    ELSIF NEW.free_ab IS DISTINCT FROM OLD.free_ab THEN
      NEW.free_delivery_above_eur := NULLIF(NEW.free_ab, 0);
    END IF;
    IF NEW.active IS DISTINCT FROM OLD.active THEN NEW.aktiv := NEW.active;
    ELSIF NEW.aktiv IS DISTINCT FROM OLD.aktiv THEN NEW.active := NEW.aktiv;
    END IF;
  END IF;

  NEW.min_km := COALESCE(NEW.min_km, 0);
  NEW.label := COALESCE(NEW.label, 'Zone ' || NEW.name);
  NEW.eta_base_min := COALESCE(NEW.eta_base_min, 30);
  NEW.color := COALESCE(NEW.color, '#3b82f6');
  NEW.created_at := COALESCE(NEW.created_at, NEW.erstellt_am, now());
  NEW.updated_at := now();
  NEW.geaendert_am := NEW.updated_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_delivery_zone_contract ON public.delivery_zones;
CREATE TRIGGER trg_sync_delivery_zone_contract
BEFORE INSERT OR UPDATE ON public.delivery_zones
FOR EACH ROW EXECUTE FUNCTION public.sync_delivery_zone_contract();

CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_zones_location_name
  ON public.delivery_zones(location_id, name)
  WHERE location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_zones_location_active
  ON public.delivery_zones(location_id, min_km)
  WHERE active = true;

COMMIT;
