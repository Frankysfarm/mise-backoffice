-- 085_pos_split_payment.rollback.sql
-- Removes only objects owned by migration 085.

begin;

drop function if exists public.fail_pos_split_provider_085(
  uuid,uuid,uuid,uuid,uuid,uuid,text
);
drop function if exists public.record_pos_split_cash_085(
  uuid,uuid,uuid,uuid,uuid,uuid,text,integer,jsonb,integer,integer,uuid
);
drop function if exists public.confirm_pos_split_payment_085(
  uuid,uuid,uuid,uuid,uuid,uuid,text
);
drop function if exists public.attach_pos_split_provider_085(
  uuid,uuid,uuid,uuid,uuid,uuid,text
);
drop function if exists public.prepare_pos_split_payment_085(
  uuid,uuid,uuid,uuid,uuid,uuid,text,text,integer,jsonb,integer,uuid
);
drop function if exists public.get_pos_split_status_085(
  uuid,uuid,uuid,uuid,uuid,uuid
);
drop function if exists public.create_pos_split_sale_085(
  uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,integer,integer,boolean,uuid
);

drop table if exists public.pos_payment_allocations;
drop table if exists public.pos_payment_attempts;
drop table if exists public.pos_split_sessions;

commit;
