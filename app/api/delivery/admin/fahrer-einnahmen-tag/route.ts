/**
 * GET /api/delivery/admin/fahrer-einnahmen-tag?location_id=<uuid>&driver_id=<uuid>
 *
 * Phase 667 (Backend) — Fahrer Tages-Einnahmen-API
 * Heutige Einnahmen + Hochrechnung auf Schichtende für einen Fahrer.
 *
 * Response: { ok, einnahmen_bisher, trinkgeld_bisher, schicht_start, schicht_dauer_min, touren_bisher }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id');

  if (!locationId || !driverId) {
    return NextResponse.json({ ok: false, error: 'location_id and driver_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Aktive Schicht des Fahrers
    const { data: shift } = await supabase
      .from('driver_shifts')
      .select('id, started_at, status')
      .eq('location_id', locationId)
      .eq('driver_id', driverId)
      .in('status', ['active', 'on_break'])
      .gte('started_at', todayStart.toISOString())
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Heutige abgeschlossene Touren des Fahrers
    const { data: batches } = await supabase
      .from('mise_delivery_batches')
      .select('id, revenue_eur, total_tip_eur, delivered_at')
      .eq('location_id', locationId)
      .eq('driver_id', driverId)
      .eq('status', 'delivered')
      .gte('delivered_at', todayStart.toISOString());

    const now = Date.now();
    const schichtStart = (shift?.started_at as string | null) ?? null;
    const schichtDauerMin = schichtStart
      ? Math.round((now - new Date(schichtStart).getTime()) / 60_000)
      : 0;

    const einnahmenBisher = (batches ?? []).reduce((s, b) => s + ((b.revenue_eur as number | null) ?? 0), 0);
    const trinkgeldBisher = (batches ?? []).reduce((s, b) => s + ((b.total_tip_eur as number | null) ?? 0), 0);
    const tourenBisher = (batches ?? []).length;

    return NextResponse.json({
      ok: true,
      einnahmen_bisher: Math.round(einnahmenBisher * 100) / 100,
      trinkgeld_bisher: Math.round(trinkgeldBisher * 100) / 100,
      schicht_start: schichtStart,
      schicht_dauer_min: schichtDauerMin,
      touren_bisher: tourenBisher,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('fahrer-einnahmen-tag error:', err);
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 });
  }
}
