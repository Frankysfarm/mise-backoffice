-- Migration 217: Schicht-Leistungs-Benchmarks (Phase 463)
-- Vergleich heutiger Schicht vs. Durchschnitt der letzten 4 Wochen

create table if not exists public.schicht_benchmarks (
  id                uuid primary key default gen_random_uuid(),
  location_id       uuid not null references public.locations(id) on delete cascade,
  schicht_datum     date not null,
  benchmark_typ     text not null check (benchmark_typ in (
                      'bestellungen', 'umsatz_eur', 'puenktlichkeit_pct',
                      'composite_score', 'avg_delivery_min'
                    )),
  ist_wert          numeric(10,4),
  benchmark_wert    numeric(10,4),   -- 4-Wochen-Ø gleicher Wochentag
  abweichung_pct    numeric(6,2),    -- (ist - benchmark) / benchmark × 100
  wochen_referenz   integer not null default 4,
  berechnet_am      timestamptz not null default now(),
  unique(location_id, schicht_datum, benchmark_typ)
);

create index if not exists idx_schicht_benchmarks_location_datum
  on public.schicht_benchmarks(location_id, schicht_datum desc);

-- RLS
alter table public.schicht_benchmarks enable row level security;

create policy "service role full access"
  on public.schicht_benchmarks
  for all to service_role using (true) with check (true);

create policy "authenticated read own location"
  on public.schicht_benchmarks
  for select to authenticated
  using (location_id in (
    select location_id from public.employees
    where user_id = auth.uid()
  ));

-- Cleanup RPC
create or replace function public.prune_schicht_benchmarks(days_old integer default 60)
returns integer language plpgsql security definer as $$
declare deleted integer;
begin
  delete from public.schicht_benchmarks
  where schicht_datum < current_date - days_old;
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;
