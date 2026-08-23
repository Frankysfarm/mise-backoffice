begin;
drop trigger if exists enqueue_kitchen_payment_084 on public.customer_orders;
drop trigger if exists enqueue_kitchen_item_084 on public.order_items;
drop function if exists public.enqueue_kitchen_ticket_after_payment_084();
drop function if exists public.enqueue_kitchen_item_after_insert_084();
drop function if exists public.advance_kitchen_ticket_item_atomic(uuid,uuid,uuid,uuid,uuid,text,uuid);
drop function if exists public.enqueue_kitchen_ticket_atomic(uuid,uuid,uuid,text,uuid);
drop function if exists public.kitchen_ticket_source_084(text,text,uuid);
drop table if exists public.kitchen_ticket_events;
drop table if exists public.kitchen_ticket_items;
drop table if exists public.kitchen_tickets;
-- Compatibility columns predate 084 in production and are retained.
-- station_id/station_status and order_channel/zubereitung_start/fertig_am
-- were already consumed by the KDS/POS application before this migration.
-- ADD IF NOT EXISTS cannot prove ownership later, so rollback must not drop them.
commit;
