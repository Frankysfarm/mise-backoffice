begin;
drop trigger if exists enqueue_kitchen_item_084 on public.order_items;
drop function if exists public.enqueue_kitchen_item_after_insert_084();
drop function if exists public.advance_kitchen_ticket_item_atomic(uuid,uuid,uuid,uuid,uuid,text,uuid);
drop function if exists public.enqueue_kitchen_ticket_atomic(uuid,uuid,uuid,text,uuid);
drop table if exists public.kitchen_ticket_events;
drop table if exists public.kitchen_ticket_items;
drop table if exists public.kitchen_tickets;
-- Compatibility columns predate 084 in production and are retained.
commit;
