import { NextRequest, NextResponse } from 'next/server';
import { internalCronUnauthorized, isInternalCronRequest } from '@/lib/internal-cron-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function escalationIntervalHours() {
  const configured = Number(process.env.OPERATIONAL_ESCALATION_INTERVAL_HOURS ?? '4');
  return Number.isFinite(configured) && configured >= 0.25 && configured <= 168 ? configured : 4;
}
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!); }

export async function GET(request: NextRequest) {
  if (!isInternalCronRequest(request)) return internalCronUnauthorized();
  const service = createServiceClient();
  const { data: recurringScopes, error: scopeError } = await service.from('operational_task_templates').select('tenant_id,location_id').eq('trigger_type', 'manual').eq('aktiv', true).is('paused_at', null).is('deleted_at', null);
  const scopes = [...new Map((recurringScopes ?? []).map((scope) => [`${scope.tenant_id}:${scope.location_id}`, scope])).values()];
  const recurringRuns = scopeError ? [] : await Promise.all(scopes.map((scope) => service.rpc('materialize_recurring_operational_tasks', { p_tenant_id: scope.tenant_id, p_location_id: scope.location_id, p_until: new Date(Date.now() + 14 * 86_400_000).toISOString() })));
  const [
    { data: tasks, error: taskError },
    { data: briefings, error: briefingError },
    { data: serviceRequests, error: serviceError },
  ] = await Promise.all([
    service.rpc('process_operational_escalations', {
      p_now: new Date().toISOString(),
      p_interval: `${escalationIntervalHours()} hours`,
    }),
    service.rpc('materialize_operational_daily_briefings'),
    service.rpc('process_table_service_escalations'),
  ]);
  const recurringError = scopeError ?? recurringRuns.find((run) => run.error)?.error;
  if (taskError || briefingError || serviceError || recurringError) {
    return NextResponse.json({
      ok: false,
      error: taskError?.message ?? briefingError?.message ?? serviceError?.message ?? recurringError?.message ?? 'Tagesklarheitslauf fehlgeschlagen',
    }, { status: 500 });
  }
  const since = new Date(Date.now() - 3 * 60_000).toISOString();
  const { data: escalated } = await service.from('operational_tasks')
    .select('id,title,due_at,tenant_id,location_id,department_id,assigned_to,assignee:employees!operational_tasks_assigned_to_fkey(id,email,vorname)')
    .gte('last_escalated_at', since).not('status', 'in', '(erledigt,storniert)');
  const departmentIds = [...new Set((escalated ?? []).map((task) => task.department_id).filter(Boolean))] as string[];
  const { data: deputies } = departmentIds.length ? await service.from('department_responsibility_assignments').select('tenant_id,location_id,department_id,employee:employees!department_responsibility_assignments_employee_id_fkey(id,email,vorname)').in('department_id', departmentIds).eq('responsibility_role', 'stellvertretung').eq('aktiv', true) : { data: [] };
  const deliveries = (escalated ?? []).flatMap((task) => {
    const matchedDeputies = (deputies ?? []).filter((entry) => entry.tenant_id === task.tenant_id && entry.location_id === task.location_id && entry.department_id === task.department_id).flatMap((entry) => Array.isArray(entry.employee) ? entry.employee : entry.employee ? [entry.employee] : []);
    const people = [...new Map([task.assignee].flatMap((person) => Array.isArray(person) ? person : person ? [person] : []).concat(matchedDeputies).map((person) => [person.id, person])).values()];
    const safeTitle = escapeHtml(task.title); const safeUrl = `${(process.env.NEXT_PUBLIC_APP_URL ?? 'https://mise-gastro.de').replace(/\/$/, '')}/mitarbeiter#meine-aufgaben`;
    return people.filter((person) => person.email).map((person) => sendEmail({
      to: person.email!, subject: `Überfällige Aufgabe: ${task.title}`,
      text: `Hallo ${person.vorname ?? ''}, die Aufgabe „${task.title}“ ist überfällig. Bitte öffne deine Mitarbeiter-App.`,
      html: `<p>Hallo ${escapeHtml(person.vorname ?? '')},</p><p>die Aufgabe <strong>${safeTitle}</strong> ist überfällig.</p><p><a href="${safeUrl}">Aufgabe öffnen</a></p>`,
    }));
  });
  const mailResults = await Promise.all(deliveries);
  return NextResponse.json({
    ok: true,
    tasks_escalated: tasks ?? 0,
    briefings_materialized: briefings ?? 0,
    service_requests_escalated: serviceRequests ?? 0,
    recurring_tasks_materialized: recurringRuns.reduce((sum, run) => sum + Number(run.data ?? 0), 0),
    escalation_emails_sent: mailResults.filter((result) => result.sent).length,
    escalation_emails_skipped: mailResults.filter((result) => !result.sent).length,
  });
}
