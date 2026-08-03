import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, context: { params: Promise<{ token: string; itemId: string }> }) {
  const { token, itemId } = await context.params;
  if (!token || token.length > 160 || !uuid.test(itemId)) {
    return NextResponse.json({ ok: false, reason_code: 'INVALID_REQUEST' }, { status: 400 });
  }
  let body: { expected_status?: unknown; target_status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason_code: 'INVALID_REQUEST' }, { status: 400 });
  }
  const expected = body.expected_status;
  const target = body.target_status;
  if (!((expected === 'offen' && target === 'in_arbeit') || (expected === 'in_arbeit' && target === 'fertig'))) {
    return NextResponse.json({ ok: false, reason_code: 'INVALID_TRANSITION' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: station, error: stationError } = await service.from('kitchen_stations')
    .select('id').eq('display_token', token).eq('aktiv', true).maybeSingle();
  if (stationError) return NextResponse.json({ ok: false, reason_code: 'KITCHEN_UNAVAILABLE' }, { status: 503 });
  if (!station?.id) return NextResponse.json({ ok: false, reason_code: 'STATION_NOT_FOUND' }, { status: 404 });

  const { data, error } = await service.rpc('fn_kitchen_advance_item_v1', {
    p_station_id: station.id,
    p_item_id: itemId,
    p_expected_status: expected,
    p_target_status: target,
  });
  if (error) {
    const correlationId = crypto.randomUUID();
    console.error('kitchen-item-transition-failed', { correlationId, message: error.message });
    return NextResponse.json({ ok: false, reason_code: 'KITCHEN_UNAVAILABLE', correlation_id: correlationId }, { status: 503 });
  }
  const result = data as { ok?: boolean; reason_code?: string } | null;
  if (!result?.ok) {
    return NextResponse.json(result ?? { ok: false, reason_code: 'KITCHEN_REJECTED' }, { status: 409 });
  }
  return NextResponse.json(result);
}
