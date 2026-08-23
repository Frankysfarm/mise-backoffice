begin;

drop function if exists public.create_table_order_atomic(
  uuid, uuid, uuid, text, numeric, jsonb, uuid
);

drop index if exists public.customer_orders_table_order_idempotency_uidx;

alter table public.customer_orders
  drop column if exists table_order_idempotency_key;

alter table public.tenants
  drop constraint if exists tenants_qr_theme_primary_check,
  drop constraint if exists tenants_qr_theme_accent_check,
  drop constraint if exists tenants_qr_welcome_text_check,
  drop constraint if exists tenants_qr_cta_label_check,
  drop column if exists qr_theme_primary,
  drop column if exists qr_theme_accent,
  drop column if exists qr_welcome_text,
  drop column if exists qr_cta_label;

commit;
