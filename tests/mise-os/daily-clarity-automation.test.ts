import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('daily clarity automation contracts', () => {
  const migration = source('supabase/migrations/20260830154500_daily_clarity_automation.sql');
  const sqlTest = source('scripts/tests/077_daily_clarity_automation.sql');

  it('runs escalation through the protected Vercel cron with a configurable interval', () => {
    const cron = source('app/api/cron/operational-escalations/route.ts');
    const vercel = source('vercel.json');
    expect(vercel).toContain('/api/cron/operational-escalations');
    expect(cron).toContain('isInternalCronRequest(request)');
    expect(cron).toContain('OPERATIONAL_ESCALATION_INTERVAL_HOURS');
    expect(cron).toContain("service.rpc('process_operational_escalations'");
    expect(migration).toContain("p_interval interval default interval '4 hours'");
    expect(migration).toContain('least(v_task.escalation_level+1,3)');
    expect(migration).toContain('operational_task_escalated');
    expect(sqlTest).toContain('escalation ignored its configured interval');
    expect(sqlTest).toContain('level two escalation did not record controller');
  });

  it('materializes one scoped, privacy-safe briefing per location and Berlin day', () => {
    const page = source('app/(neo)/neo/app/mitarbeiter/page.tsx');
    const client = source('app/(neo)/neo/app/mitarbeiter/responsibility-client.tsx');
    expect(migration).toContain('unique(tenant_id,location_id,briefing_date)');
    expect(migration).toContain("p_generated_at at time zone 'Europe/Berlin'");
    expect(migration).toContain('operational_daily_briefing_manager_read');
    expect(migration).not.toContain("'grund',x.grund");
    expect(sqlTest).toContain('briefing exposed private absence reason');
    expect(sqlTest).toContain('manager can read foreign-location briefing');
    expect(page).toContain("from('operational_daily_briefings')");
    expect(client).toContain('Morgenbriefing');
  });

  it('builds explainable weekly suggestions without assigning shifts silently', () => {
    const route = source('app/api/operations/schedule-suggestions/route.ts');
    const assistant = source('app/(admin)/schedule/schedule-assistant.tsx');
    expect(migration).toContain('generate_weekly_shift_assignment_suggestions');
    expect(migration).toContain('tstzrange(other.start_zeit,other.end_zeit');
    expect(migration).toContain('assigned_hours*2');
    expect(migration).toContain('Bereichsqualifikation passt');
    expect(migration).toContain("v_shift.employee_id is not null");
    expect(route).toContain('getCurrentEmployee');
    expect(route).toContain("action: z.literal('confirm')");
    expect(assistant).toContain('Jede Schicht wird erst nach deiner Bestätigung zugewiesen.');
    expect(assistant).toContain('Schicht bestätigen');
    expect(sqlTest).toContain('assistant double-booked the early employee');
    expect(sqlTest).toContain('confirmed shift was silently overwritten');
    expect(sqlTest).toContain('confirmed suggestion did not close the shift-task loop');
  });

  it('keeps privileged automation RPCs away from authenticated browser sessions', () => {
    expect(migration).toContain('revoke all on function public.process_operational_escalations');
    expect(migration).toContain('revoke all on function public.materialize_operational_daily_briefings');
    expect(migration).toContain('revoke all on function public.generate_weekly_shift_assignment_suggestions');
    expect(migration).toContain('revoke all on function public.confirm_weekly_shift_assignment_suggestion');
    expect(sqlTest).toContain('authenticated can execute escalation sweep');
    expect(sqlTest).toContain('authenticated can materialize daily briefings');
    expect(sqlTest).toContain('authenticated can execute schedule assistant RPC');
  });
});
