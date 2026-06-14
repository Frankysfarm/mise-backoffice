/**
 * GET+POST /api/delivery/admin/vouchers
 *
 * Voucher / Promo-Code Verwaltung für Admins.
 *
 * GET  → Dashboard (KPIs + Voucher-Liste mit Stats)
 * POST action=create          → neuen Gutschein erstellen
 * POST action=generate_bulk   → Bulk-Codes für Kampagne generieren
 * POST action=deactivate      → Gutschein deaktivieren
 * POST action=prune           → abgelaufene Gutscheine bereinigen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getVoucherDashboard,
  createVoucher,
  generateBulkVouchers,
  deactivateVoucher,
  pruneExpiredVouchers,
  type CreateVoucherParams,
  type RfmSegment,
  type VoucherType,
} from '@/lib/delivery/vouchers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getLocationId(req: NextRequest): Promise<string | null> {
  const url = new URL(req.url);
  const qp = url.searchParams.get('location_id');
  if (qp) return qp;

  const sb = createServiceClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  return (emp?.location_id as string) ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dashboard = await getVoucherDashboard(locationId);
  return NextResponse.json(dashboard);
}

export async function POST(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = body.action as string | undefined;

  // ── CREATE ────────────────────────────────────────────────────────────────
  if (!action || action === 'create') {
    const params: CreateVoucherParams = {
      code:                 body.code as string | undefined,
      voucher_type:         body.voucher_type as VoucherType,
      discount_value:       Number(body.discount_value ?? 0),
      min_order_eur:        Number(body.min_order_eur ?? 0),
      max_discount_eur:     body.max_discount_eur != null ? Number(body.max_discount_eur) : undefined,
      max_uses:             body.max_uses != null ? Number(body.max_uses) : undefined,
      max_uses_per_customer: body.max_uses_per_customer != null ? Number(body.max_uses_per_customer) : undefined,
      valid_from:           body.valid_from as string | undefined,
      valid_until:          body.valid_until as string | undefined,
      target_segment:       body.target_segment as RfmSegment | undefined,
      campaign_name:        body.campaign_name as string | undefined,
      description:          body.description as string | undefined,
    };

    if (!params.voucher_type) {
      return NextResponse.json({ error: 'voucher_type erforderlich' }, { status: 400 });
    }

    const voucher = await createVoucher(locationId, params);
    if (!voucher) {
      return NextResponse.json({ error: 'Gutschein konnte nicht erstellt werden.' }, { status: 500 });
    }
    return NextResponse.json({ voucher });
  }

  // ── GENERATE BULK ─────────────────────────────────────────────────────────
  if (action === 'generate_bulk') {
    const count = Math.min(Number(body.count ?? 10), 500);
    const prefix = (body.prefix as string | undefined) ?? '';
    const params: Omit<CreateVoucherParams, 'code'> = {
      voucher_type:         body.voucher_type as VoucherType,
      discount_value:       Number(body.discount_value ?? 0),
      min_order_eur:        Number(body.min_order_eur ?? 0),
      max_discount_eur:     body.max_discount_eur != null ? Number(body.max_discount_eur) : undefined,
      max_uses:             body.max_uses != null ? Number(body.max_uses) : 1,
      max_uses_per_customer: 1,
      valid_from:           body.valid_from as string | undefined,
      valid_until:          body.valid_until as string | undefined,
      target_segment:       body.target_segment as RfmSegment | undefined,
      campaign_name:        body.campaign_name as string | undefined,
      description:          body.description as string | undefined,
    };

    if (!params.voucher_type) {
      return NextResponse.json({ error: 'voucher_type erforderlich' }, { status: 400 });
    }

    const result = await generateBulkVouchers(locationId, count, params, prefix);
    return NextResponse.json(result);
  }

  // ── DEACTIVATE ────────────────────────────────────────────────────────────
  if (action === 'deactivate') {
    const id = body.id as string;
    if (!id) {
      return NextResponse.json({ error: 'id erforderlich' }, { status: 400 });
    }
    const ok = await deactivateVoucher(id, locationId);
    return NextResponse.json({ success: ok });
  }

  // ── PRUNE ─────────────────────────────────────────────────────────────────
  if (action === 'prune') {
    const pruned = await pruneExpiredVouchers(locationId);
    return NextResponse.json({ pruned });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
