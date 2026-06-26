-- 045_pickup_ready_email.sql
-- Abhol-Kunden bekommen eine "Bereit zur Abholung"-Mail bei Status fertig (typ=abholung).
-- Erweitert enqueue_delivery_status_email (siehe 044) um einen Zweig. Idempotent.

CREATE OR REPLACE FUNCTION public.enqueue_delivery_status_email()
RETURNS trigger LANGUAGE plpgsql AS $function$
declare
  v_tenant_id uuid; v_tenant_name text; v_template text; v_subject text; v_token text;
begin
  if not (TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status) then return NEW; end if;
  if NEW.kunde_email is null then return NEW; end if;

  if    NEW.status = 'unterwegs' and NEW.typ = 'lieferung' then
    v_template := 'delivery_unterwegs'; v_subject := concat('Unterwegs zu dir 🛵 · ', NEW.bestellnummer);
  elsif NEW.status = 'fertig' and NEW.typ = 'abholung' then
    v_template := 'delivery_abholbereit'; v_subject := concat('Abholbereit 🛍️ · ', NEW.bestellnummer);
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
