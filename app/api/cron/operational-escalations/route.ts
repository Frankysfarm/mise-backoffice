import { NextRequest, NextResponse } from 'next/server';
import { internalCronUnauthorized, isInternalCronRequest } from '@/lib/internal-cron-auth';
import { createServiceClient } from '@/lib/supabase/server';

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
  const { data: recurringScopes, error: scopeError } = await service.rpc('active_recurring_operational_scopes');
  const scopes = recurringScopes ?? [];
  const recurringRuns = scopeError ? [] : await Promise.all(scopes.map((scope: { tenant_id: string; location_id: string }) => service.rpc('materialize_recurring_operational_tasks', { p_tenant_id: scope.tenant_id, p_location_id: scope.location_id, p_until: new Date(Date.now() + 14 * 86_400_000).toISOString() })));
  // Pflichtkette: erst Schicht-Checklisten materialisieren, dann Überfälliges zur Filialleiter-Kontrolle eskalieren
  const { data: guideTasks, error: guideError } = await service.rpc('materialize_shift_guide_tasks', { p_now: new Date().toISOString() });
  const { data: guideControls, error: guideControlError } = await service.rpc('escalate_overdue_shift_guides', { p_now: new Date().toISOString() });
  // Filialleitung informiert immer: überfällige Pflichtschulungen → Kontrolle; Fehlbestände → Bestellentwurf (+ Fehlliste per Trigger)
  const { data: trainingControls, error: trainingControlError } = await service.rpc('escalate_overdue_trainings', { p_now: new Date().toISOString() });
  const { data: reorderDrafts, error: reorderError } = await service.rpc('auto_reorder_drafts', { p_now: new Date().toISOString() });
  const [
    { data: tasks, error: taskError },
    { data: briefings, error: briefingError },
    { data: serviceRequests, error: serviceError },
    { data: overdueTrainings, error: trainingError },
  ] = await Promise.all([
    service.rpc('process_operational_escalations', {
      p_now: new Date().toISOString(),
      p_interval: `${escalationIntervalHours()} hours`,
    }),
    service.rpc('materialize_operational_daily_briefings'),
    service.rpc('process_table_service_escalations'),
    service.rpc('process_overdue_trainings', { p_now: new Date().toISOString() }),
  ]);
  const recurringError = scopeError ?? recurringRuns.find((run) => run.error)?.error;
  if (taskError || briefingError || serviceError || trainingError || recurringError || guideError || guideControlError || trainingControlError || reorderError) {
    return NextResponse.json({
      ok: false,
      error: taskError?.message ?? briefingError?.message ?? serviceError?.message ?? trainingError?.message ?? recurringError?.message ?? guideError?.message ?? guideControlError?.message ?? trainingControlError?.message ?? reorderError?.message ?? 'Tagesklarheitslauf fehlgeschlagen',
    }, { status: 500 });
  }
  // E-Mails: jede Eskalations-Benachrichtigung wird per DB-Trigger (notifications → email_outbox) im Betriebs-Branding versendet.
  return NextResponse.json({
    ok: true,
    tasks_escalated: tasks ?? 0,
    briefings_materialized: briefings ?? 0,
    service_requests_escalated: serviceRequests ?? 0,
    overdue_trainings: overdueTrainings ?? 0,
    recurring_tasks_materialized: recurringRuns.reduce((sum, run) => sum + Number(run.data ?? 0), 0),
    shift_guide_tasks_materialized: guideTasks ?? 0,
    shift_guide_controls_created: guideControls ?? 0,
    training_overdue_controls_created: trainingControls ?? 0,
    reorder_drafts_created: reorderDrafts ?? 0,
  });
}
