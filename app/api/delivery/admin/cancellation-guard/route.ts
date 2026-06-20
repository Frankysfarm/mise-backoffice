/**
 * GET/POST /api/delivery/admin/cancellation-guard
 *
 * Smart Cancellation Guard — Phase 344
 *
 * GET ?action=dashboard → KPIs + Ereignis-Log
 * GET ?action=config    → Konfiguration
 * POST action=update_config → Konfiguration speichern
 * POST action=check_risk → Risiko für Kunden prüfen
 * POST action=record_event → Ereignis manuell loggen
 * POST action=offer_voucher → Voucher-Intervention
 * POST action=prune → alte Ereignisse löschen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getDashboard,
  getConfig,
  upsertConfig,
  checkCancellationRisk,
  recordCancellationEvent,
  offerVoucherIntervention,
  pruneOldEvents,
} from '@/lib/delivery/cancellation-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  const override = req.nextUrl.searchParams.get('location_id');
  return emp?.role === 'superadmin' && override
    ? override
    : (emp?.location_id as string | null);
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (action === 'config') {
    const config = await getConfig(locationId);
    return NextResponse.json(config);
  }

  const dashboard = await getDashboard(locationId);
  return NextResponse.json(dashboard);
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as Record<string, unknown>;
  const { action } = body;

  if (action === 'update_config') {
    const config = await upsertConfig(locationId, {
      isEnabled: typeof body.isEnabled === 'boolean' ? body.isEnabled : undefined,
      maxCancellationsPerHour: typeof body.maxCancellationsPerHour === 'number' ? body.maxCancellationsPerHour : undefined,
      voucherEnabled: typeof body.voucherEnabled === 'boolean' ? body.voucherEnabled : undefined,
      voucherAmountEur: typeof body.voucherAmountEur === 'number' ? body.voucherAmountEur : undefined,
      blockAfterNCancellations: typeof body.blockAfterNCancellations === 'number' ? body.blockAfterNCancellations : undefined,
      blockWindowHours: typeof body.blockWindowHours === 'number' ? body.blockWindowHours : undefined,
    });
    return NextResponse.json(config);
  }

  if (action === 'check_risk') {
    const customerId = body.customer_id as string | undefined;
    const orderId = body.order_id as string | undefined;
    if (!customerId) return NextResponse.json({ error: 'customer_id required' }, { status: 400 });
    const result = await checkCancellationRisk(locationId, customerId, orderId);
    return NextResponse.json(result);
  }

  if (action === 'record_event') {
    const { order_id, customer_id, event_type, risk_level } = body as Record<string, string>;
    if (!event_type || !risk_level) return NextResponse.json({ error: 'event_type + risk_level required' }, { status: 400 });
    await recordCancellationEvent(
      locationId,
      order_id ?? null,
      customer_id ?? null,
      event_type as Parameters<typeof recordCancellationEvent>[3],
      risk_level as Parameters<typeof recordCancellationEvent>[4],
    );
    return NextResponse.json({ ok: true });
  }

  if (action === 'offer_voucher') {
    const customerId = body.customer_id as string | undefined;
    const orderId = body.order_id as string | null ?? null;
    if (!customerId) return NextResponse.json({ error: 'customer_id required' }, { status: 400 });
    const config = await getConfig(locationId);
    const code = await offerVoucherIntervention(locationId, customerId, orderId, config.voucherAmountEur);
    return NextResponse.json({ ok: true, voucher_code: code });
  }

  if (action === 'prune') {
    const result = await pruneOldEvents(30);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
