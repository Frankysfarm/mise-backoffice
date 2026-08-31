import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Dienstplan Vollausbau Verträge', () => {
  const migration = source('supabase/migrations/20260831130000_schedule_planning_loop.sql');
  it('schützt Vorlagen und Wochen tenant- sowie standortbezogen', () => { expect(migration).toContain('can_manage_operational_location'); expect(migration).toContain('security definer set search_path=public,pg_temp'); expect(migration).toContain('to service_role'); });
  it('wendet Personalbedarf mit einem stabilen Instanzschlüssel an', () => { expect(migration).toContain('shifts_schedule_template_instance_uidx'); expect(migration).toContain('on conflict(tenant_id,location_id,schedule_template_instance_key)'); expect(migration).toContain('1..v_slot.headcount'); });
  it('erweitert den bestehenden Assistenten und erzwingt die Frist', () => { expect(migration).toContain('generate_weekly_shift_assignment_suggestions_core'); expect(migration).toContain('availability deadline has not passed'); expect(migration).toContain("coalesce(response.state,'kann')<>'kann_nicht'"); expect(migration).toContain("when 'moechte' then 165"); });
  it('behält Kernfilter auch bei konkreten Rückmeldungen bei', () => { expect(migration).toContain('exists(select 1 from public.shift_availability_responses response where response.shift_id=s.id)'); expect(migration).toContain('from public.employee_availability blocked'); expect(migration).toContain('from public.weekly_shift_assignment_suggestions other_suggestion'); expect(migration).toContain('responsibility_assignment_active_at'); });
  it('veröffentlicht und protokolliert spätere Änderungen für Betroffene', () => { expect(migration).toContain('publish_schedule_week'); expect(migration).toContain('Geändert seit Veröffentlichung'); expect(migration).toContain('shifts_published_schedule_change'); });
  it('nutzt gültige Benachrichtigungstypen und prüft Zustellfehler', () => { expect(migration).not.toMatch(/values\([^\n]+,'dienstplan(?:_geaendert)?'/); const route = source('app/api/scheduling/planner/route.ts'); expect(route).toContain("typ: 'info'"); expect(route).toContain('In-App-Erinnerungen konnten nicht zugestellt werden.'); });
  it('hat Manager- und Mitarbeiteroberflächen ohne technische Rohdaten', () => { expect(source('app/(admin)/schedule/planning-controls.tsx')).toContain('Dienstplan veröffentlichen'); expect(source('app/mitarbeiter/availability-loop.tsx')).toContain('Wann kannst du arbeiten?'); expect(source('app/mitarbeiter/availability-loop.tsx')).not.toContain('<pre'); });
});
