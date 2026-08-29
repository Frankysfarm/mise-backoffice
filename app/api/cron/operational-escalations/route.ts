import { NextRequest, NextResponse } from 'next/server';
import { internalCronUnauthorized, isInternalCronRequest } from '@/lib/internal-cron-auth';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  if (!isInternalCronRequest(request)) return internalCronUnauthorized();
  const service = createServiceClient();
  const [{ data: tasks, error: taskError }, { data: serviceRequests, error: serviceError }] = await Promise.all([
    service.rpc('process_operational_escalations'),
    service.rpc('process_table_service_escalations'),
  ]);
  if (taskError || serviceError) {
    return NextResponse.json({
      ok: false,
      error: taskError?.message ?? serviceError?.message ?? 'Eskalationslauf fehlgeschlagen',
    }, { status: 500 });
  }
  return NextResponse.json({ ok: true, tasks_escalated: tasks ?? 0, service_requests_escalated: serviceRequests ?? 0 });
}
