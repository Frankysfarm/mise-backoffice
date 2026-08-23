\set ON_ERROR_STOP on

-- Isolated PostgreSQL integration only. Creates dblink and a disposable helper.
-- Never run against production.
create extension if not exists dblink;
select (to_regclass('public.kitchen_stations') is null)::integer as stations_missing,
  (to_regclass('public.station_category_routing') is null)::integer as routing_missing,
  (not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'menu_items'
      and column_name = 'category_id'))::integer as category_column_missing
\gset schema_
alter table public.menu_items add column if not exists category_id uuid;
create table if not exists public.kitchen_stations (
  id uuid primary key,
  tenant_id uuid not null,
  location_id uuid not null,
  name text not null,
  aktiv boolean not null default true,
  sort_order integer not null default 0
);
create table if not exists public.station_category_routing (
  station_id uuid not null,
  category_id uuid not null
);


select s.tenant_id, s.location_id, s.register_id, s.id as shift_id, s.employee_id,
  t.id as table_id, i.id as item_id, i.name as item_name, round(i.preis * 100)::integer as price_cents,
  coalesce(i.category_id::text, '') as original_category_id
from public.pos_shifts s
join public.pos_registers r on r.id = s.register_id and r.aktiv
join public.restaurant_tables t on t.tenant_id = s.tenant_id and t.location_id = s.location_id and t.aktiv
join public.menu_items i on i.tenant_id = s.tenant_id and i.location_id = s.location_id and i.verfuegbar
where s.status = 'offen' and round(i.preis * 100)::integer > 0
order by s.start_at desc, t.id, i.id limit 1
\gset fixture_
select gen_random_uuid() as category_id, gen_random_uuid() as station_id
\gset kitchen_
insert into public.kitchen_stations (id, tenant_id, location_id, name, aktiv, sort_order)
values (:'kitchen_station_id', :'fixture_tenant_id', :'fixture_location_id', 'Split Race Küche', true, 1);
update public.menu_items set category_id = :'kitchen_category_id' where id = :'fixture_item_id';
insert into public.station_category_routing (station_id, category_id)
values (:'kitchen_station_id', :'kitchen_category_id');


select * from public.create_pos_split_sale_085(
  :'fixture_tenant_id', :'fixture_location_id', :'fixture_register_id',
  :'fixture_shift_id', :'fixture_employee_id', :'fixture_table_id', 'table',
  jsonb_build_array(
    jsonb_build_object('id', :'fixture_item_id', 'name', :'fixture_item_name' || ' Race A',
      'quantity', 1, 'unitPriceCents', :'fixture_price_cents'::integer, 'taxRate', 19,
      'note', '', 'selections', '{}'::jsonb, 'seat', 1),
    jsonb_build_object('id', :'fixture_item_id', 'name', :'fixture_item_name' || ' Race B',
      'quantity', 1, 'unitPriceCents', :'fixture_price_cents'::integer, 'taxRate', 19,
      'note', '', 'selections', '{}'::jsonb, 'seat', 2)
  ),
  :'fixture_price_cents'::integer * 2, 0, true, gen_random_uuid()
)
\gset split_

create or replace function public.qa_try_split_cash_085(
  p_tenant uuid, p_location uuid, p_register uuid, p_shift uuid, p_employee uuid,
  p_session uuid, p_amount integer, p_key uuid
)
returns text language plpgsql as $$
declare v_result record;
begin
  select * into v_result from public.record_pos_split_cash_085(
    p_tenant, p_location, p_register, p_shift, p_employee, p_session,
    'amount', p_amount, '[]'::jsonb, null, p_amount, p_key
  );
  return 'ok:' || v_result.completed::text || ':' || v_result.was_confirmed::text;
exception when others then
  return 'error:' || sqlerrm;
end;
$$;

select gen_random_uuid() as double_tap_key, gen_random_uuid() as race_key_a, gen_random_uuid() as race_key_b
\gset keys_

select dblink_connect('split_a', format(
  'host=%s port=%s dbname=%I user=%I',
  current_setting('unix_socket_directories'), current_setting('port'), current_database(), current_user
));
select dblink_connect('split_b', format(
  'host=%s port=%s dbname=%I user=%I',
  current_setting('unix_socket_directories'), current_setting('port'), current_database(), current_user
));

select dblink_send_query('split_a', format(
  'select public.qa_try_split_cash_085(%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L::uuid,%s,%L::uuid)',
  :'fixture_tenant_id', :'fixture_location_id', :'fixture_register_id', :'fixture_shift_id',
  :'fixture_employee_id', :'split_split_session_id', :'fixture_price_cents', :'keys_double_tap_key'
));
select dblink_send_query('split_b', format(
  'select public.qa_try_split_cash_085(%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L::uuid,%s,%L::uuid)',
  :'fixture_tenant_id', :'fixture_location_id', :'fixture_register_id', :'fixture_shift_id',
  :'fixture_employee_id', :'split_split_session_id', :'fixture_price_cents', :'keys_double_tap_key'
));
select * from dblink_get_result('split_a') as t(result text);
select * from dblink_get_result('split_b') as t(result text);
select dblink_disconnect('split_a');
select dblink_disconnect('split_b');

select 1 / case when (select count(*) from public.pos_payment_attempts
  where split_session_id = :'split_split_session_id' and status = 'confirmed') = 1 then 1 else 0 end;
select 1 / case when (select paid_cents from public.pos_split_sessions
  where id = :'split_split_session_id') = :'fixture_price_cents'::integer then 1 else 0 end;
select 1 / case when not exists (
  select 1 from public.kitchen_tickets where order_id = :'split_order_id'
) then 1 else 0 end;

select dblink_connect('split_a', format(
  'host=%s port=%s dbname=%I user=%I',
  current_setting('unix_socket_directories'), current_setting('port'), current_database(), current_user
));
select dblink_connect('split_b', format(
  'host=%s port=%s dbname=%I user=%I',
  current_setting('unix_socket_directories'), current_setting('port'), current_database(), current_user
));

select dblink_send_query('split_a', format(
  'select public.qa_try_split_cash_085(%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L::uuid,%s,%L::uuid)',
  :'fixture_tenant_id', :'fixture_location_id', :'fixture_register_id', :'fixture_shift_id',
  :'fixture_employee_id', :'split_split_session_id', :'fixture_price_cents', :'keys_race_key_a'
));
select dblink_send_query('split_b', format(
  'select public.qa_try_split_cash_085(%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L::uuid,%s,%L::uuid)',
  :'fixture_tenant_id', :'fixture_location_id', :'fixture_register_id', :'fixture_shift_id',
  :'fixture_employee_id', :'split_split_session_id', :'fixture_price_cents', :'keys_race_key_b'
));
select * from dblink_get_result('split_a') as t(result text);
select * from dblink_get_result('split_b') as t(result text);
select dblink_disconnect('split_a');
select dblink_disconnect('split_b');

select 1 / case when (select count(*) from public.pos_payment_attempts
  where split_session_id = :'split_split_session_id' and status = 'confirmed') = 2 then 1 else 0 end;
select 1 / case when (select paid_cents from public.pos_split_sessions
  where id = :'split_split_session_id') = :'fixture_price_cents'::integer * 2 then 1 else 0 end;
select 1 / case when (select count(*) from public.kitchen_tickets
  where order_id = :'split_order_id') = 1 then 1 else 0 end;
select 1 / case when (select count(*) from public.kitchen_ticket_events e
  join public.kitchen_tickets kt on kt.id = e.ticket_id
  where kt.order_id = :'split_order_id' and e.event_type = 'enqueued') = 1 then 1 else 0 end;

drop function public.qa_try_split_cash_085(uuid,uuid,uuid,uuid,uuid,uuid,integer,uuid);
delete from public.kitchen_ticket_events where ticket_id in (
  select id from public.kitchen_tickets where order_id = :'split_order_id'
);
delete from public.kitchen_ticket_items where ticket_id in (
  select id from public.kitchen_tickets where order_id = :'split_order_id'
);
delete from public.kitchen_tickets where order_id = :'split_order_id';
delete from public.pos_payment_allocations where split_session_id = :'split_split_session_id';
delete from public.station_category_routing where station_id = :'kitchen_station_id';
delete from public.kitchen_stations where id = :'kitchen_station_id';
update public.menu_items set category_id = nullif(:'fixture_original_category_id', '')::uuid where id = :'fixture_item_id';
delete from public.pos_payment_attempts where split_session_id = :'split_split_session_id';
delete from public.pos_split_sessions where id = :'split_split_session_id';
delete from public.pos_transaction_items where transaction_id = :'split_transaction_id';
delete from public.pos_transactions where id = :'split_transaction_id';
delete from public.order_items where order_id = :'split_order_id';
delete from public.customer_orders where id = :'split_order_id';
\if :schema_routing_missing
drop table public.station_category_routing;
\endif
\if :schema_stations_missing
drop table public.kitchen_stations;
\endif
\if :schema_category_column_missing
alter table public.menu_items drop column category_id;
\endif
