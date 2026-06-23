-- Migration 219: Fahrer-Pünktlichkeits-Coach (Phase 466)
-- Automatische Coaching-Hinweise wenn Pünktlichkeit < 80% (basierend auf schicht_abschluss_berichte)

create table if not exists public.fahrer_coaching_hinweise (
  id              uuid primary key default gen_random_uuid(),
  location_id     uuid not null references public.locations(id) on delete cascade,
  driver_id       uuid not null references public.employees(id) on delete cascade,
  schicht_datum   date not null,
  puenktlichkeit_pct  numeric(5,2) not null,  -- Ist-Wert der Pünktlichkeit
  ziel_pct            numeric(5,2) not null default 80.0,
  hinweise        jsonb not null default '[]'::jsonb,  -- Array von Tipp-Strings
  kategorie       text not null check (kategorie in ('kritisch','warnung','info')),
  gesehen_am      timestamptz,
  generiert_am    timestamptz not null default now(),
  unique(driver_id, schicht_datum)
);

create index if not exists idx_fahrer_coaching_location_datum
  on public.fahrer_coaching_hinweise(location_id, schicht_datum desc);

create index if not exists idx_fahrer_coaching_driver
  on public.fahrer_coaching_hinweise(driver_id, schicht_datum desc);

-- RLS
alter table public.fahrer_coaching_hinweise enable row level security;

create policy "service role full access"
  on public.fahrer_coaching_hinweise
  for all to service_role using (true) with check (true);

create policy "authenticated read own location"
  on public.fahrer_coaching_hinweise
  for select to authenticated
  using (location_id in (
    select location_id from public.employees
    where user_id = auth.uid()
  ));

create policy "driver read own hints"
  on public.fahrer_coaching_hinweise
  for select to authenticated
  using (driver_id in (
    select id from public.employees
    where user_id = auth.uid()
  ));

-- Cleanup RPC
create or replace function public.prune_fahrer_coaching_hinweise(days_old integer default 60)
returns integer language plpgsql security definer as $$
declare deleted integer;
begin
  delete from public.fahrer_coaching_hinweise
  where schicht_datum < current_date - days_old;
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;
