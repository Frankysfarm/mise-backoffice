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

export async function GET(request: NextRequest) {
  if (!isInternalCronRequest(request)) return internalCronUnauthorized();
  const service = createServiceClient();
  const [
    { data: tasks, error: taskError },
    { data: briefings, error: briefingError },
    { data: serviceRequests, error: serviceError },
    { data: recurring, error: recurringError },
  ] = await Promise.all([
    service.rpc('process_operational_escalations', {
      p_now: new Date().toISOString(),
      p_interval: `${escalationIntervalHours()} hours`,
    }),
    service.rpc('materialize_operational_daily_briefings'),
    service.rpc('process_table_service_escalations'),
    service.rpc('materialize_recurring_operational_tasks', { p_until: new Date(Date.now() + 14 * 86_400_000).toISOString() }),
  ]);
  if (taskError || briefingError || serviceError || recurringError) {
    return NextResponse.json({
      ok: false,
      error: taskError?.message ?? briefingError?.message ?? serviceError?.message ?? recurringError?.message ?? 'Tagesklarheitslauf fehlgeschlagen',
    }, { status: 500 });
  }
  const since = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: escalated } = await service.from('operational_tasks')
    .select('id,title,due_at,assigned_to,delegated_from_employee_id,assignee:employees!operational_tasks_assigned_to_fkey(email,vorname),deputy:employees!operational_tasks_delegated_from_employee_id_fkey(email,vorname)')
    .gte('last_escalated_at', since).not('status', 'in', '(erledigt,storniert)');
  const deliveries = (escalated ?? []).flatMap((task) => {
    const people = [task.assignee, task.deputy].flatMap((person) => Array.isArray(person) ? person : person ? [person] : []);
    return people.filter((person) => person.email).map((person) => sendEmail({
      to: person.email!, subject: `Überfällige Aufgabe: ${task.title}`,
      text: `Hallo ${person.vorname ?? ''}, die Aufgabe „${task.title}“ ist überfällig. Bitte öffne deine Mitarbeiter-App.`,
      html: `<p>Hallo ${person.vorname ?? ''},</p><p>die Aufgabe <strong>${task.title}</strong> ist überfällig.</p><p><a href="/mitarbeiter#meine-aufgaben">Aufgabe öffnen</a></p>`,
    }));
  });
  const mailResults = await Promise.all(deliveries);
  return NextResponse.json({
    ok: true,
    tasks_escalated: tasks ?? 0,
    briefings_materialized: briefings ?? 0,
    service_requests_escalated: serviceRequests ?? 0,
    recurring_tasks_materialized: recurring ?? 0,
    escalation_emails_sent: mailResults.filter((result) => result.sent).length,
    escalation_emails_skipped: mailResults.filter((result) => !result.sent).length,
  });
}
