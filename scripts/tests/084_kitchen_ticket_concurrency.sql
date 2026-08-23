\set ON_ERROR_STOP on

-- Isolated PostgreSQL integration test only. This creates dblink and disposable
-- fixtures to exercise true concurrent sessions; never run it in production.
create extension if not exists dblink;

select s.tenant_id, s.location_id, i.id as item_id, i.name as item_name, i.preis as item_price
from public.pos_shifts s join public.menu_items i on i.tenant_id = s.tenant_id and i.location_id = s.location_id
where s.status = 'offen' and i.verfuegbar
order by s.start_at desc, i.id limit 1
\gset fixture_

select gen_random_uuid() as order_a, gen_random_uuid() as order_b, gen_random_uuid() as order_c, gen_random_uuid() as collision_key
\gset case_

insert into public.customer_orders (id, tenant_id, location_id, typ, status, kunde_name, zahlungsart, bezahlt, bestellt_am, order_channel)
values (:'case_order_a', :'fixture_tenant_id', :'fixture_location_id', 'vor_ort', 'neu', 'Concurrent Multi QA', 'bar', true, now(), 'pos');

select dblink_connect('kitchen_a', format('host=%s port=%s dbname=%I user=%I', current_setting('unix_socket_directories'), current_setting('port'), current_database(), current_user));
select dblink_connect('kitchen_b', format('host=%s port=%s dbname=%I user=%I', current_setting('unix_socket_directories'), current_setting('port'), current_database(), current_user));

select dblink_send_query('kitchen_a', format($sql$insert into public.order_items (order_id, menu_item_id, name, menge, einzelpreis, gesamtpreis) values (%L::uuid, %L::uuid, %L, 1, %L::numeric, %L::numeric) returning id::text$sql$, :'case_order_a', :'fixture_item_id', :'fixture_item_name', :'fixture_item_price', :'fixture_item_price'));
select dblink_send_query('kitchen_b', format($sql$insert into public.order_items (order_id, menu_item_id, name, menge, einzelpreis, gesamtpreis) values (%L::uuid, %L::uuid, %L, 1, %L::numeric, %L::numeric) returning id::text$sql$, :'case_order_a', :'fixture_item_id', :'fixture_item_name' || ' 2', :'fixture_item_price', :'fixture_item_price'));

select * from dblink_get_result('kitchen_a') as t(id text);
select * from dblink_get_result('kitchen_b') as t(id text);

select ((select count(*) from public.kitchen_tickets where order_id = :'case_order_a') = 1 and (select count(*) from public.kitchen_ticket_items i join public.kitchen_tickets t on t.id = i.ticket_id where t.order_id = :'case_order_a') = 2 and (select count(*) from public.kitchen_ticket_events e join public.kitchen_tickets t on t.id = e.ticket_id where t.order_id = :'case_order_a' and e.event_type = 'enqueued') = 1) as multi_item_ok
\gset concurrent_
\if :concurrent_multi_item_ok
\else
  \echo 'concurrent multi-item enqueue failed'
  select 1 / 0;
\endif

select dblink_disconnect('kitchen_a');
select dblink_disconnect('kitchen_b');
select dblink_connect('kitchen_a', format('host=%s port=%s dbname=%I user=%I', current_setting('unix_socket_directories'), current_setting('port'), current_database(), current_user));
select dblink_connect('kitchen_b', format('host=%s port=%s dbname=%I user=%I', current_setting('unix_socket_directories'), current_setting('port'), current_database(), current_user));

insert into public.customer_orders (id, tenant_id, location_id, typ, status, kunde_name, zahlungsart, bezahlt, bestellt_am, order_channel)
values (:'case_order_b', :'fixture_tenant_id', :'fixture_location_id', 'vor_ort', 'neu', 'Collision A QA', 'bar', true, now(), 'pos'),
       (:'case_order_c', :'fixture_tenant_id', :'fixture_location_id', 'vor_ort', 'neu', 'Collision B QA', 'bar', true, now(), 'pos');

insert into public.order_items (order_id, menu_item_id, name, menge, einzelpreis, gesamtpreis)
values (:'case_order_b', :'fixture_item_id', :'fixture_item_name', 1, :'fixture_item_price', :'fixture_item_price'),
       (:'case_order_c', :'fixture_item_id', :'fixture_item_name', 1, :'fixture_item_price', :'fixture_item_price');

select dblink_send_query('kitchen_a', format($sql$select ticket_id::text, was_created, item_count from public.enqueue_kitchen_ticket_atomic(%L::uuid,%L::uuid,%L::uuid,'pos',%L::uuid)$sql$, :'fixture_tenant_id', :'fixture_location_id', :'case_order_b', :'case_collision_key'));
select dblink_send_query('kitchen_b', format($sql$select ticket_id::text, was_created, item_count from public.enqueue_kitchen_ticket_atomic(%L::uuid,%L::uuid,%L::uuid,'pos',%L::uuid)$sql$, :'fixture_tenant_id', :'fixture_location_id', :'case_order_c', :'case_collision_key'));

select * from dblink_get_result('kitchen_a', false) as t(ticket_id text, was_created boolean, item_count integer);
select * from dblink_get_result('kitchen_b', false) as t(ticket_id text, was_created boolean, item_count integer);

select (select count(*) from public.kitchen_ticket_events where tenant_id = :'fixture_tenant_id' and idempotency_key = :'case_collision_key') = 1 as collision_ok
\gset concurrent_
\if :concurrent_collision_ok
\else
  \echo 'concurrent idempotency-key collision was not contained'
  select 1 / 0;
\endif

select dblink_disconnect('kitchen_a');
select dblink_disconnect('kitchen_b');

delete from public.kitchen_ticket_events where ticket_id in (select id from public.kitchen_tickets where order_id in (:'case_order_a', :'case_order_b', :'case_order_c'));
delete from public.kitchen_ticket_items where ticket_id in (select id from public.kitchen_tickets where order_id in (:'case_order_a', :'case_order_b', :'case_order_c'));
delete from public.kitchen_tickets where order_id in (:'case_order_a', :'case_order_b', :'case_order_c');
delete from public.order_items where order_id in (:'case_order_a', :'case_order_b', :'case_order_c');
delete from public.customer_orders where id in (:'case_order_a', :'case_order_b', :'case_order_c');
