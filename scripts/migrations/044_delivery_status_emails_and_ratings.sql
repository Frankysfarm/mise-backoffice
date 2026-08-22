-- 044_delivery_status_emails_and_ratings.sql
-- Kunden-Status-Benachrichtigungen (E-Mail) + Bewertung nach Lieferung.
-- Aktiviert das bereits vorhandene (verwaiste) Rating-System (satisfaction.ts, /rate, /api/delivery/orders/[id]/rate)
-- und verschickt Status-Mails über die bestehende email_outbox + process-outbox (Tenant-Resend).
-- Idempotent. Direkt auf PROD angewandt am 2026-06-25.

-- 1) Bewertungs-Token auf der Bestellung (Link /rate/<token>)
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS rating_token text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_orders_rating_token
  ON customer_orders(rating_token) WHERE rating_token IS NOT NULL;

-- 2) Tabelle für Kundenbewertungen (eine pro Bestellung)
CREATE TABLE IF NOT EXISTS customer_delivery_ratings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL UNIQUE REFERENCES customer_orders(id) ON DELETE CASCADE,
  batch_id      uuid,
  driver_id     uuid,
  location_id   uuid NOT NULL,
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       text,
  rating_token  text,
  token_used_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cdr_location ON customer_delivery_ratings(location_id);
ALTER TABLE customer_delivery_ratings ENABLE ROW LEVEL SECURITY;

-- 3) Trigger: Status-Mail in email_outbox einreihen bei unterwegs/geliefert/abgeholt
CREATE OR REPLACE FUNCTION public.enqueue_delivery_status_email()
RETURNS trigger LANGUAGE plpgsql AS $function$
declare
  v_tenant_id uuid; v_tenant_name text; v_template text; v_subject text; v_token text;
begin
  if not (TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status) then return NEW; end if;
  if NEW.kunde_email is null then return NEW; end if;

  if    NEW.status = 'unterwegs' and NEW.typ = 'lieferung' then
    v_template := 'delivery_unterwegs'; v_subject := concat('Unterwegs zu dir 🛵 · ', NEW.bestellnummer);
  elsif NEW.status = 'geliefert' then
    v_template := 'delivery_delivered'; v_subject := concat('Geliefert ✅ Wie war''s? · ', NEW.bestellnummer);
  elsif NEW.status = 'abgeholt' then
    v_template := 'delivery_delivered'; v_subject := concat('Danke! Wie war''s? · ', NEW.bestellnummer);
  else return NEW; end if;

  select l.tenant_id, t.name into v_tenant_id, v_tenant_name
    from locations l join tenants t on t.id = l.tenant_id where l.id = NEW.location_id;
  if v_tenant_id is null then return NEW; end if;

  if exists (select 1 from email_outbox where order_id = NEW.id and template = v_template) then return NEW; end if;

  if v_template = 'delivery_delivered' then
    if NEW.rating_token is null then
      v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
      update customer_orders set rating_token = v_token where id = NEW.id;
    else v_token := NEW.rating_token; end if;
  end if;

  insert into email_outbox (tenant_id, to_email, subject, html, template, template_data, order_id)
  values (v_tenant_id, NEW.kunde_email, v_subject, '', v_template,
    jsonb_build_object('bestellnummer', NEW.bestellnummer, 'kunde_name', NEW.kunde_name, 'typ', NEW.typ, 'rating_token', v_token),
    NEW.id);
  return NEW;
end $function$;

DROP TRIGGER IF EXISTS trg_delivery_status_email ON customer_orders;
CREATE TRIGGER trg_delivery_status_email
  AFTER UPDATE OF status ON customer_orders
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_delivery_status_email();

-- 4) RPC: Fahrer-Durchschnittsbewertung neu berechnen (nach jeder Kundenbewertung)
CREATE OR REPLACE FUNCTION public.recompute_driver_rating(p_driver_id uuid)
RETURNS void LANGUAGE sql AS $function$
  UPDATE mise_drivers d SET rating = sub.avg_rating
    FROM (SELECT round(avg(rating)::numeric, 2) AS avg_rating
            FROM customer_delivery_ratings WHERE driver_id = p_driver_id) sub
   WHERE d.id = p_driver_id AND sub.avg_rating IS NOT NULL;
$function$;
