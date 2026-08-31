import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Dienstplan Vollausbau Verträge', () => {
  const migration = source('supabase/migrations/20260831130000_schedule_planning_loop.sql');
  it('schützt Vorlagen und Wochen tenant- sowie standortbezogen', () => { expect(migration).toContain('can_manage_operational_location'); expect(migration).toContain('security definer set search_path=public,pg_temp'); expect(migration).toContain('to service_role'); });
  it('wendet Personalbedarf mit einem stabilen Instanzschlüssel an', () => { expect(migration).toContain('shifts_schedule_template_instance_uidx'); expect(migration).toContain('on conflict(tenant_id,location_id,schedule_template_instance_key)'); expect(migration).toContain('1..v_slot.headcount'); });
  it('erweitert den bestehenden Assistenten und erzwingt die Frist', () => { expect(migration).toContain('generate_weekly_shift_assignment_suggestions_v1'); expect(migration).toContain('availability deadline has not passed'); expect(migration).toContain("response.state='kann_nicht'"); });
  it('veröffentlicht und protokolliert spätere Änderungen für Betroffene', () => { expect(migration).toContain('publish_schedule_week'); expect(migration).toContain('Geändert seit Veröffentlichung'); expect(migration).toContain('shifts_published_schedule_change'); });
  it('hat Manager- und Mitarbeiteroberflächen ohne technische Rohdaten', () => { expect(source('app/(admin)/schedule/planning-controls.tsx')).toContain('Dienstplan veröffentlichen'); expect(source('app/mitarbeiter/availability-loop.tsx')).toContain('Wann kannst du arbeiten?'); expect(source('app/mitarbeiter/availability-loop.tsx')).not.toContain('<pre'); });
});
