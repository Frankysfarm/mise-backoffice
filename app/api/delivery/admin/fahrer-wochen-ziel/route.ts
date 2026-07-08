/**
 * GET /api/delivery/admin/fahrer-wochen-ziel?location_id=<uuid>&driver_id=<uuid>
 *
 * Phase 682 (Backend) — Fahrer-Wochenziel-API
 * Liefert Fortschritt gegenüber wöchentlichem Lieferziel (Touren + Einnahmen).
 *
 * Response: { ok, woche: WochenFortschritt, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ZIEL_TOUREN_PRO_WOCHE = 50;
const ZIEL_EINNAHMEN_PRO_WOCHE = 500;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id');

  if (!locationId || !driverId) {
    return NextResponse.json({ ok: false, error: 'location_id and driver_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // Montag dieser Woche (00:00 UTC)
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=So, 1=Mo, …
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - daysFromMonday);
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekStartIso = weekStart.toISOString();

    const { data: batches } = await supabase
      .from('mise_delivery_batches')
      .select('stop_count, revenue_eur, total_tip_eur, distance_km, delivered_at')
      .eq('location_id', locationId)
      .eq('driver_id', driverId)
      .eq('status', 'delivered')
      .gte('delivered_at', weekStartIso);

    const touren = (batches ?? []).length;
    const stopps = (batches ?? []).reduce((s, b) => s + ((b.stop_count as number | null) ?? 1), 0);
    const einnahmen = (batches ?? []).reduce(
      (s, b) => s + ((b.revenue_eur as number | null) ?? 0) + ((b.total_tip_eur as number | null) ?? 0),
      0,
    );
    const kmWoche = (batches ?? []).reduce((s, b) => s + ((b.distance_km as number | null) ?? 0), 0);

    // Tage seit Montag (1 = erster Tag der Woche)
    const tagInWoche = Math.max(1, daysFromMonday + 1);
    const wochentageBisher = tagInWoche;
    const hochrechnungTouren = wochentageBisher > 0 ? Math.round((touren / wochentageBisher) * 7) : touren;
    const hochrechnungEinnahmen = wochentageBisher > 0 ? (einnahmen / wochentageBisher) * 7 : einnahmen;

    const tourenPct = Math.min(100, Math.round((touren / ZIEL_TOUREN_PRO_WOCHE) * 100));
    const einnahmenPct = Math.min(100, Math.round((einnahmen / ZIEL_EINNAHMEN_PRO_WOCHE) * 100));

    return NextResponse.json({
      ok: true,
      woche: {
        touren,
        stopps,
        einnahmen: Math.round(einnahmen * 100) / 100,
        kmWoche: Math.round(kmWoche * 10) / 10,
        zielTouren: ZIEL_TOUREN_PRO_WOCHE,
        zielEinnahmen: ZIEL_EINNAHMEN_PRO_WOCHE,
        tourenPct,
        einnahmenPct,
        hochrechnungTouren,
        hochrechnungEinnahmen: Math.round(hochrechnungEinnahmen * 100) / 100,
        tagInWoche,
        wochenstart: weekStartIso,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('fahrer-wochen-ziel error:', err);
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 });
  }
}
