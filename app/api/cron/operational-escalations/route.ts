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
  if (taskError || briefingError || serviceError) {
    return NextResponse.json({
      ok: false,
      error: taskError?.message ?? briefingError?.message ?? serviceError?.message ?? 'Tagesklarheitslauf fehlgeschlagen',
    }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    tasks_escalated: tasks ?? 0,
    briefings_materialized: briefings ?? 0,
    service_requests_escalated: serviceRequests ?? 0,
  });
}
