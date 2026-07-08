import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/delivery/admin/schicht-profitabilitaet?location_id=...
 *
 * Returns real-time profitability per active driver shift:
 *   lieferlohn_eur   – gross payout to driver (distance × rate)
 *   einnahmen_eur    – delivery-fee revenue collected from customers
 *   kosten_eur       – estimated fuel/wear cost (distance × 0.14 €/km)
 *   marge_eur        – einnahmen − lieferlohn − kosten
 *   marge_pct        – marge / einnahmen × 100
 */
export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = createServiceClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Active shifts
    const { data: shifts } = await sb
      .from('driver_shifts')
      .select('id, driver_id, started_at, mise_drivers!driver_id(id, name, vehicle)')
      .eq('location_id', locationId)
      .eq('status', 'active');

    const activeShifts = shifts ?? [];
    const driverIds = activeShifts.map((s) => s.driver_id as string);

    if (driverIds.length === 0) {
      return NextResponse.json({ ok: true, locationId, shifts: [], capturedAt: now.toISOString() });
    }

    // Today's delivered batches
    const { data: batches } = await sb
      .from('mise_delivery_batches')
      .select('driver_id, distance_km, tip_amount_eur, delivery_fee_eur, completed_at')
      .in('driver_id', driverIds)
      .eq('location_id', locationId)
      .eq('state', 'delivered')
      .gte('completed_at', todayStart.toISOString());

    const completedBatches = batches ?? [];

    // Constants (configurable per location in future)
    const RATE_EUR_PER_KM = 0.35;    // gross driver payout per km
    const COST_EUR_PER_KM = 0.14;    // fuel/wear cost per km

    const result = activeShifts.map((shift) => {
      const dId = shift.driver_id as string;
      const driverRec = (shift as Record<string, unknown>).mise_drivers as Record<string, unknown> | null;

      const shiftBatches = completedBatches.filter((b) => b.driver_id === dId);
      const touren = shiftBatches.length;
      const totalKm = shiftBatches.reduce((s, b) => s + Number(b.distance_km ?? 0), 0);
      const trinkgeld = shiftBatches.reduce((s, b) => s + Number(b.tip_amount_eur ?? 0), 0);
      const deliveryFeeRev = shiftBatches.reduce((s, b) => s + Number(b.delivery_fee_eur ?? 0), 0);

      const lieferlohn = Math.round(totalKm * RATE_EUR_PER_KM * 100) / 100;
      const kosten = Math.round(totalKm * COST_EUR_PER_KM * 100) / 100;
      const einnahmen = Math.round((deliveryFeeRev + trinkgeld) * 100) / 100;
      const marge = Math.round((einnahmen - lieferlohn - kosten) * 100) / 100;
      const margePct = einnahmen > 0 ? Math.round((marge / einnahmen) * 1000) / 10 : 0;

      const startedAt = (shift as Record<string, unknown>).started_at as string | null;
      const schichtMinuten = startedAt
        ? Math.round((now.getTime() - new Date(startedAt).getTime()) / 60_000)
        : null;

      return {
        shiftId: (shift as Record<string, unknown>).id as string,
        driverId: dId,
        driverName: driverRec?.name ?? 'Unbekannt',
        vehicle: driverRec?.vehicle ?? null,
        schichtMinuten,
        touren,
        totalKm: Math.round(totalKm * 10) / 10,
        lieferlohn_eur: lieferlohn,
        einnahmen_eur: einnahmen,
        kosten_eur: kosten,
        marge_eur: marge,
        marge_pct: margePct,
      };
    });

    return NextResponse.json({
      ok: true,
      locationId,
      shifts: result,
      capturedAt: now.toISOString(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unbekannter Fehler' },
      { status: 500 },
    );
  }
}
