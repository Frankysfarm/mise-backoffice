import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/voice-orders/calls
 *
 * Liste der Anrufe des aktuellen Tenants, neueste zuerst.
 * ?limit=50 (default), ?status=completed|in_progress|failed|escalated
 */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: userRes } = await sb.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const { data: emp } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('id', userRes.user.id)
    .maybeSingle();
  if (!emp?.tenant_id) return NextResponse.json({ error: 'no tenant' }, { status: 403 });

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
  const status = url.searchParams.get('status');

  const svc = createServiceClient();
  let q = svc
    .from('voice_calls')
    .select(
      'id, conversation_id, status, started_at, ended_at, duration_sec, caller_phone, order_id, recording_url',
    )
    .eq('tenant_id', emp.tenant_id)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ calls: data ?? [] });
}
