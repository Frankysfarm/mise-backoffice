-- Listen-Konsolidierung (Owner-Auftrag 04.09.): Checklisten/Kontrollen
-- (checkup_templates) und Reinigung (cleaning_zones/cleaning_tasks) werden in
-- den Listen-Builder überführt. Live-Daten zeigen 0 Sessions/0 Erledigungen —
-- migriert werden nur die Vorlagen, nichts wird gelöscht. Die neuen Listen
-- starten INAKTIV, damit die Leitung Zuweisung + Zeitplan bewusst setzt.
-- `migrated_from` macht die Migration idempotent und nachvollziehbar.

alter table public.shift_guides
  add column if not exists migrated_from text;

create unique index if not exists shift_guides_migrated_from_idx
  on public.shift_guides(migrated_from) where migrated_from is not null;

-- ---------------------------------------------------------------------------
-- 1. Checkup-Vorlagen → Listen (Typ Kontrolle)
--    `fragen` ist bereits procedure-kompatibel (der Checkup-Editor nutzt
--    dieselbe Normalisierung); Objekt mit categories wird übernommen,
--    ein reines Array wird als ein Abschnitt eingebettet.
-- ---------------------------------------------------------------------------
insert into public.shift_guides
  (tenant_id, location_id, department_id, titel, phase, ablauf_typ, position_typ,
   aktiv, inhalt, assignment_kind, migrated_from)
select
  t.tenant_id, t.location_id, t.department_id, t.titel,
  case when t.phase::text in ('opening','closing','midday') then t.phase::text else 'midday' end::shift_guide_phase,
  'control', t.position_typ,
  false,
  case
    when jsonb_typeof(t.fragen) = 'object' and t.fragen ? 'categories' then t.fragen
    -- Alt-Format des Checkup-Editors: { tasks: [...] }
    when jsonb_typeof(t.fragen) = 'object' and jsonb_typeof(t.fragen->'tasks') = 'array' then jsonb_build_object(
      'schemaVersion', 1,
      'categories', jsonb_build_array(jsonb_build_object(
        'id', 'main', 'title', 'Prüfpunkte', 'steps', t.fragen->'tasks')))
    when jsonb_typeof(t.fragen) = 'array' then jsonb_build_object(
      'schemaVersion', 1,
      'categories', jsonb_build_array(jsonb_build_object(
        'id', 'main', 'title', 'Prüfpunkte', 'steps', t.fragen)))
    else jsonb_build_object('schemaVersion', 1, 'categories', jsonb_build_array(
      jsonb_build_object('id', 'main', 'title', 'Prüfpunkte', 'steps', '[]'::jsonb)))
  end,
  'schicht',
  'checkup:' || t.id
from public.checkup_templates t
where t.aktiv and t.tenant_id is not null and t.location_id is not null
  and not exists (
    select 1 from public.shift_guides g where g.migrated_from = 'checkup:' || t.id
  );

-- ---------------------------------------------------------------------------
-- 2. Reinigungszonen → je eine Liste (Typ Reinigung) mit den aktiven Aufgaben
--    der Zone als Schritte (Foto-Pflicht bleibt Foto-Nachweis).
--    Tenant kommt über die Location (cleaning-Tabellen haben keinen Tenant).
-- ---------------------------------------------------------------------------
insert into public.shift_guides
  (tenant_id, location_id, titel, phase, ablauf_typ, aktiv, inhalt,
   assignment_kind, migrated_from)
select
  l.tenant_id, z.location_id, 'Reinigung: ' || z.name, 'midday'::shift_guide_phase, 'cleaning',
  false,
  jsonb_build_object(
    'schemaVersion', 1,
    'categories', jsonb_build_array(jsonb_build_object(
      'id', 'zone', 'title', z.name,
      'steps', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', 'task-' || ct.id,
          'title', ct.titel,
          'description', coalesce(ct.beschreibung, ''),
          'required', true,
          'evidence', case when ct.requires_photo then 'photo' else 'none' end
        ) order by ct.sort_order, ct.titel), '[]'::jsonb)
        from public.cleaning_tasks ct
        where ct.zone_id = z.id and ct.aktiv
      )))),
  'schicht',
  'cleaning_zone:' || z.id
from public.cleaning_zones z
join public.locations l on l.id = z.location_id
where z.aktiv and l.tenant_id is not null
  and exists (select 1 from public.cleaning_tasks ct where ct.zone_id = z.id and ct.aktiv)
  and not exists (
    select 1 from public.shift_guides g where g.migrated_from = 'cleaning_zone:' || z.id
  );
