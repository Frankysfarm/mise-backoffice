begin;

drop function if exists public.create_pos_sale_atomic(
  uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb,
  numeric, numeric, numeric, numeric, boolean, uuid, jsonb
);

drop index if exists public.ux_pos_transactions_tenant_idempotency;
alter table if exists public.pos_transactions
  drop column if exists pos_sale_idempotency_key;

commit;
