-- Migration 209: Schicht-Abschluss-Berichte (Phase 430)
-- Post-shift performance summaries for drivers

create table if not exists public.schicht_abschluss_berichte (
  id                          uuid primary key default gen_random_uuid(),
  location_id                 uuid not null references public.locations(id) on delete cascade,
  driver_id                   uuid not null,
  schicht_datum               date not null,
  schicht_beginn              timestamptz,
  schicht_ende                timestamptz,
  touren_anzahl               integer not null default 0,
  lieferungen_gesamt          integer not null default 0,
  puenktlichkeits_pct         numeric(5,2),
  avg_delivery_min            numeric(5,2),
  stornorate_pct              numeric(5,2),
  composite_score             numeric(5,2),
  score_grade                 text check (score_grade in ('A+','A','B','C','D')),
  eigener_schnitt_30d         numeric(5,2),
  delta_eigener_schnitt       numeric(6,2),    -- positiv = besser als eigener Schnitt
  team_schnitt_heute          numeric(5,2),
  delta_team_schnitt          numeric(6,2),    -- positiv = besser als Team
  top_zone                    text,
  verdienst_eur               numeric(8,2),
  highlights                  jsonb default '[]'::jsonb,
  tipps                       jsonb default '[]'::jsonb,
  generiert_am                timestamptz not null default now(),
  unique(driver_id, schicht_datum)
);

create index if not exists idx_schicht_abschluss_location_datum
  on public.schicht_abschluss_berichte(location_id, schicht_datum desc);

create index if not exists idx_schicht_abschluss_driver_datum
  on public.schicht_abschluss_berichte(driver_id, schicht_datum desc);

-- RLS
alter table public.schicht_abschluss_berichte enable row level security;

create policy "service role full access"
  on public.schicht_abschluss_berichte
  for all to service_role using (true) with check (true);

create policy "authenticated read own location"
  on public.schicht_abschluss_berichte
  for select to authenticated
  using (location_id in (
    select location_id from public.employees
    where user_id = auth.uid()
  ));

create policy "driver read own berichte"
  on public.schicht_abschluss_berichte
  for select to authenticated
  using (driver_id = auth.uid());

-- Cleanup RPC
create or replace function public.prune_schicht_abschluss_berichte(days_old integer default 60)
returns integer language plpgsql security definer as $$
declare deleted integer;
begin
  delete from public.schicht_abschluss_berichte
  where generiert_am < now() - (days_old || ' days')::interval;
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;
