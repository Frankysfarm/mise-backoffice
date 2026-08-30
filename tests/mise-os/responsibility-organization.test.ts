import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement, type ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MyOperations } from '@/app/mitarbeiter/my-operations';
import { berlinScheduleMoment, isResponsibilityScheduleActive } from '@/lib/operations/responsibility-scope';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const baseSchedule = {
  valid_from: '2026-01-01',
  valid_until: null,
  weekday_scope: [1, 2, 3, 4, 5, 6, 7],
  shift_start: null,
  shift_end: null,
};

describe('responsibility organization', () => {
  it('evaluates scoped responsibility in Berlin business time', () => {
    const moment = berlinScheduleMoment(new Date('2026-08-31T08:15:00Z'));
    expect(moment).toMatchObject({ date: '2026-08-31', weekday: 1, time: '10:15' });
    expect(isResponsibilityScheduleActive({
      ...baseSchedule, weekday_scope: [1], shift_start: '09:00', shift_end: '17:00',
    }, moment)).toBe(true);
    expect(isResponsibilityScheduleActive({
      ...baseSchedule, weekday_scope: [2], shift_start: '09:00', shift_end: '17:00',
    }, moment)).toBe(false);
  });

  it('keeps an overnight Friday responsibility active on early Saturday', () => {
    const moment = berlinScheduleMoment(new Date('2026-08-29T02:30:00Z'));
    expect(moment).toMatchObject({ date: '2026-08-29', weekday: 6, time: '04:30', previousDate: '2026-08-28' });
    expect(isResponsibilityScheduleActive({
      ...baseSchedule,
      valid_from: '2026-08-28',
      valid_until: '2026-08-28',
      weekday_scope: [5],
      shift_start: '22:00',
      shift_end: '06:00',
    }, moment)).toBe(true);
  });

  it('renders a responsive management tree and separates unassigned people', () => {
    const client = source('app/(neo)/neo/app/mitarbeiter/responsibility-client.tsx');
    const styles = source('app/(neo)/neo/app/mitarbeiter/responsibility.module.css');
    const page = source('app/(neo)/neo/app/mitarbeiter/page.tsx');
    expect(client).toContain('Verantwortungslinie');
    expect(client).toContain('noch nicht zugeordnet');
    expect(client).toContain('Position & Führung speichern');
    expect(styles).toContain('@media(max-width:700px)');
    expect(styles).toContain('.orgChildren{width:calc(100% - 10px)');
    expect(styles).toContain('.dragHandle,.orgExpand{width:44px;height:44px}');
    expect(page).toContain('key={locationId}');
  });

  it('sends employees only their personal chain, team and responsibility coverage', () => {
    const page = source('app/mitarbeiter/page.tsx');
    const operations = source('app/mitarbeiter/my-operations.tsx');
    expect(page).toContain('organization={{ self: selfInTeam, leaders: leadershipChain, directReports }}');
    expect(page).toContain('responsibilityCoverage={responsibilityCoverage}');
    expect(operations).toContain('Mein Platz im Team');
    expect(operations).toContain("counterpart?.employee_name ?? 'noch nicht besetzt'");
    expect(operations).toContain('id="meine-aufgaben"');
  });

  it('renders the personal reporting path in the employee app', () => {
    const sharedPerson = { rolle: 'manager', position_title: null, reports_to_employee_id: null };
    const props: ComponentProps<typeof MyOperations> = {
      actorId: '11111111-1111-4111-8111-111111111111',
      locationId: '22222222-2222-4222-8222-222222222222',
      responsibilities: [], tasks: [], handovers: [], responsibilityCoverage: [],
      organization: {
        leaders: [{ id: '33333333-3333-4333-8333-333333333333', vorname: 'Mara', nachname: 'Leitung', ...sharedPerson }],
        self: { id: '11111111-1111-4111-8111-111111111111', vorname: 'Eli', nachname: 'Service', rolle: 'server', position_title: 'Service', reports_to_employee_id: '33333333-3333-4333-8333-333333333333' },
        directReports: [{ id: '44444444-4444-4444-8444-444444444444', vorname: 'Noa', nachname: 'Team', rolle: 'mitarbeiter', position_title: null, reports_to_employee_id: '11111111-1111-4111-8111-111111111111' }],
      },
    };
    render(createElement(MyOperations, props));
    expect(screen.getByText('Mein Platz im Team')).toBeInTheDocument();
    expect(screen.getAllByText('Mara Leitung')).toHaveLength(2);
    expect(screen.getByText('Eli Service · Ich')).toBeInTheDocument();
    expect(screen.getByText('Noa Team')).toBeInTheDocument();
  });

  it('restricts non-company-wide actors to their assigned location', () => {
    const route = source('app/api/operations/responsibility/route.ts');
    const evidenceRoute = source('app/api/operations/responsibility/evidence/route.ts');
    expect(route).toContain("if (!['backoffice', 'admin'].includes(actor.rolle)) return actor.location_id === locationId;");
    expect(route).toContain('isResponsibilityScheduleActive');
    expect(route).toContain('departmentInScope');
    expect(route).toContain("service.rpc('move_employee_in_organization'");
    expect(route).toContain('visited.has(cursor)');
    expect(evidenceRoute).toContain("task.location_id !== actor.location_id");
  });

  it('ships database-level coverage, scope, cycle and organization audit guards', () => {
    const migration = source('supabase/migrations/20260829204500_responsibility_scope_and_organization_audit.sql');
    const sqlTest = source('scripts/tests/075_responsibility_organization_hardening.sql');
    expect(migration).toContain("p_at at time zone 'Europe/Berlin'");
    expect(migration).toContain("raise exception 'department is outside location'");
    expect(migration).toContain('employees_reporting_line_validate');
    expect(migration).toContain('employees_organization_audit');
    expect(migration).toContain('move_employee_in_organization');
    expect(sqlTest).toContain('Friday overnight responsibility is not active early Saturday');
    expect(sqlTest).toContain('cross-location department unexpectedly accepted');
    expect(sqlTest).toContain('organization audit row is missing actor or change');
    expect(sqlTest).toContain('reporting cycle unexpectedly accepted');
  });

  it('connects recurring workflows to shifts without exposing a second task model', () => {
    const migration = source('supabase/migrations/20260830113000_shift_linked_operational_tasks.sql');
    const sqlTest = source('scripts/tests/076_shift_linked_operational_tasks.sql');
    const route = source('app/api/operations/responsibility/route.ts');
    const managerPage = source('app/(neo)/neo/app/mitarbeiter/page.tsx');
    const client = source('app/(neo)/neo/app/mitarbeiter/responsibility-client.tsx');
    const employeePage = source('app/mitarbeiter/page.tsx');
    const employeeClient = source('app/mitarbeiter/my-operations.tsx');
    expect(migration).toContain('materialize_shift_operational_tasks');
    expect(migration).toContain("source_type='shift_template'");
    expect(migration).toContain("operational_tasks.status in ('offen','angenommen','storniert')");
    expect(migration).toContain('can_manage_operational_location');
    expect(migration).toContain('update_operational_task_as_actor');
    expect(migration).toContain("coalesce(v_shift.typ::text,'')='probe'");
    expect(migration).toContain('revoke all on function public.materialize_shift_operational_tasks');
    expect(sqlTest).toContain('progressed task was silently reassigned');
    expect(sqlTest).toContain('canceled shift did not cancel its open task');
    expect(sqlTest).toContain('revived task retained stale acceptance');
    expect(sqlTest).toContain('unassigned shift left an active task');
    expect(sqlTest).toContain('trial shift received operational tasks');
    expect(sqlTest).toContain('manager can read foreign-location template');
    expect(sqlTest).toContain('task audit did not record acting employee');
    expect(route).toContain("action: z.literal('save_task_template')");
    expect(route).toContain('departmentInScope');
    expect(managerPage).toContain("shift:shifts(start_zeit,end_zeit,position)");
    expect(client).toContain('Schichtabläufe');
    expect(client).toContain('<Pencil size={15} />');
    expect(employeePage).toContain("shift:shifts(start_zeit,end_zeit,position)");
    expect(employeeClient).toContain('Gehört zu deiner Schicht');
  });
});
