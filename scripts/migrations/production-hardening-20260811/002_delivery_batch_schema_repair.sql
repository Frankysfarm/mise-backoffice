BEGIN;

ALTER TABLE public.mise_delivery_batches
  ADD COLUMN IF NOT EXISTS stop_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS modification_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_modified_at timestamptz;

UPDATE public.mise_delivery_batches AS b
SET stop_count = counts.stop_count
FROM (
  SELECT batch_id, COUNT(*)::integer AS stop_count
  FROM public.mise_delivery_batch_stops
  GROUP BY batch_id
) AS counts
WHERE counts.batch_id = b.id
  AND b.stop_count IS DISTINCT FROM counts.stop_count;

COMMIT;
