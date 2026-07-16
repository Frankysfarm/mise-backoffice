-- Phase 2025–2029: Fahrer-Pausenzeit-Analyse
-- Ergänzt driver_breaks um location_id falls noch nicht vorhanden

alter table if exists driver_breaks
  add column if not exists location_id uuid references locations(id) on delete cascade;

create index if not exists idx_driver_breaks_location_started
  on driver_breaks (location_id, started_at);

create index if not exists idx_driver_breaks_driver_location
  on driver_breaks (driver_id, location_id);
