/**
 * GET  /api/delivery/admin/cash-reconciliation
 *      ?action=dashboard|driver_history|float_balance
 *      &driver_id=<uuid>   (nur für driver_history)
 *
 * POST /api/delivery/admin/cash-reconciliation
 *      { action: 'settle',            settlementId, actualCashEur, notes? }
 *      { action: 'dispute',           settlementId, notes }
 *      { action: 'add_float',         type, amountEur, description? }
 *      { action: 'reconcile_today' }
 *      { action: 'reconcile_driver',  driverId }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getCashDashboard,
  getDriverCashHistory,
  getFloatBalance,
  settlePayment,
  disputeSettlement,
  addFloatTransaction,
  reconcileAllDriversToday,
  reconcileDriverToday,
} from '@/lib/delivery/cash-reconciliation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveAuth(req: NextRequest): Promise<{ locationId: string; employeeId: string } | null> {
  const urlLoc = req.nextUrl.searchParams.get('location_id');
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('id, location_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!emp) return null;
  const locationId = (urlLoc ?? (emp as Record<string, string>).location_id) as string | null;
  if (!locationId) return null;
  return { locationId, employeeId: (emp as Record<string, string>).id };
}

export async function GET(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (!auth) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  const action   = req.nextUrl.searchParams.get('action') ?? 'dashboard';
  const driverId = req.nextUrl.searchParams.get('driver_id');

  try {
    if (action === 'driver_history') {
      if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
      const days = Number(req.nextUrl.searchParams.get('days') ?? 30);
      const history = await getDriverCashHistory(driverId, auth.locationId, Math.min(days, 90));
      return NextResponse.json({ history });
    }

    if (action === 'float_balance') {
      const balance = await getFloatBalance(auth.locationId);
      return NextResponse.json({ float_balance_eur: balance });
    }

    // default: dashboard
    const dashboard = await getCashDashboard(auth.locationId);
    return NextResponse.json(dashboard);
  } catch (err) {
    console.error('[cash-reconciliation GET]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (!auth) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  try {
    const body = await req.json() as Record<string, unknown>;
    const action = body.action as string;

    if (action === 'settle') {
      const settlementId  = body.settlementId as string;
      const actualCashEur = Number(body.actualCashEur);
      const notes         = (body.notes as string | undefined) ?? undefined;
      if (!settlementId || isNaN(actualCashEur)) {
        return NextResponse.json({ error: 'settlementId und actualCashEur erforderlich' }, { status: 400 });
      }
      const result = await settlePayment(settlementId, actualCashEur, auth.employeeId, notes);
      if (!result) return NextResponse.json({ error: 'Abrechnung nicht gefunden oder bereits abgeschlossen' }, { status: 404 });
      return NextResponse.json({ settlement: result });
    }

    if (action === 'dispute') {
      const settlementId = body.settlementId as string;
      const notes        = (body.notes as string) ?? '';
      if (!settlementId) return NextResponse.json({ error: 'settlementId erforderlich' }, { status: 400 });
      const ok = await disputeSettlement(settlementId, notes);
      return NextResponse.json({ ok });
    }

    if (action === 'add_float') {
      const type         = body.type as 'deposit' | 'withdrawal' | 'initial' | 'adjustment';
      const amountEur    = Number(body.amountEur);
      const description  = (body.description as string | undefined) ?? undefined;
      if (!type || isNaN(amountEur) || amountEur <= 0) {
        return NextResponse.json({ error: 'type und amountEur (> 0) erforderlich' }, { status: 400 });
      }
      const tx = await addFloatTransaction(auth.locationId, type, amountEur, auth.employeeId, description);
      return NextResponse.json({ transaction: tx });
    }

    if (action === 'reconcile_today') {
      const result = await reconcileAllDriversToday(auth.locationId);
      return NextResponse.json(result);
    }

    if (action === 'reconcile_driver') {
      const driverId = body.driverId as string;
      if (!driverId) return NextResponse.json({ error: 'driverId erforderlich' }, { status: 400 });
      const settlement = await reconcileDriverToday(driverId, auth.locationId);
      return NextResponse.json({ settlement });
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (err) {
    console.error('[cash-reconciliation POST]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
