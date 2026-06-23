-- Migration 218: Fahrer-Selbst-Bewertungen (Phase 464)
-- Fahrer bewertet eigene Schicht (1–5 Sterne + optionaler Kommentar)

create table if not exists public.fahrer_selbst_bewertungen (
  id                uuid primary key default gen_random_uuid(),
  location_id       uuid not null references public.locations(id) on delete cascade,
  driver_id         uuid not null,
  schicht_datum     date not null,
  sterne            integer not null check (sterne between 1 and 5),
  kommentar         text,
  stimmung          text check (stimmung in ('super', 'gut', 'okay', 'muede', 'schwer')),
  erstellt_am       timestamptz not null default now(),
  unique(driver_id, schicht_datum)
);

create index if not exists idx_fahrer_selbst_bewertungen_location_datum
  on public.fahrer_selbst_bewertungen(location_id, schicht_datum desc);

create index if not exists idx_fahrer_selbst_bewertungen_driver
  on public.fahrer_selbst_bewertungen(driver_id, schicht_datum desc);

-- RLS
alter table public.fahrer_selbst_bewertungen enable row level security;

create policy "service role full access"
  on public.fahrer_selbst_bewertungen
  for all to service_role using (true) with check (true);

create policy "authenticated read own location"
  on public.fahrer_selbst_bewertungen
  for select to authenticated
  using (location_id in (
    select location_id from public.employees
    where user_id = auth.uid()
  ));

create policy "driver read and write own bewertungen"
  on public.fahrer_selbst_bewertungen
  for all to authenticated
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

-- Cleanup RPC
create or replace function public.prune_fahrer_selbst_bewertungen(days_old integer default 90)
returns integer language plpgsql security definer as $$
declare deleted integer;
begin
  delete from public.fahrer_selbst_bewertungen
  where schicht_datum < current_date - days_old;
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;
