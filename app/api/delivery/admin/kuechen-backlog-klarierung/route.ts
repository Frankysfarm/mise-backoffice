/**
 * GET /api/delivery/admin/kuechen-backlog-klarierung
 *   ?location_id=<uuid>
 *
 * Berechnet: Wie lange braucht die Küche, um den aktuellen Rückstand aufzuarbeiten?
 * Formel: Ø Zubereitungszeit × offene Aufträge / Kapazitätsfaktor
 *
 * Phase 546
 *
 * Response: { ok, data: BacklogData, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface BacklogData {
  openOrders: number;
  inPrepOrders: number;
  avgPrepMin: number;
  clearingTimeMin: number; // Geschätzte Klarierungszeit
  clearingLabel: string;   // "~5 Min", "~30 Min", etc.
  urgency: 'niedrig' | 'mittel' | 'hoch' | 'kritisch';
  overdueCount: number;    // Überschreitung >5 Min
  capacityFactor: number;  // Parallel-Stationen (geschätzt)
  recommendation: string;
}

export interface BacklogResponse {
  ok: boolean;
  data: BacklogData;
  generatedAt: string;
}

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const param = new URL(req.url).searchParams.get('location_id');
  if (param) return param;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return (emp as { location_id: string } | null)?.location_id ?? null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const locationId = await resolveLocationId(req);
    if (!locationId) {
      return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
    }

    const svc = createServiceClient();
    const now = new Date();
    const nowMs = now.getTime();

    // 1. Offene Bestellungen
    const { data: orders } = await svc
      .from('orders')
      .select('id, status, bestellt_am, geschaetzte_zubereitung_min')
      .eq('location_id', locationId)
      .in('status', ['neu', 'bestätigt', 'in_zubereitung']);

    const openOrders = orders?.length ?? 0;
    const inPrepOrders = orders?.filter((o: { status: string }) => o.status === 'in_zubereitung').length ?? 0;

    // 2. Ø Zubereitungszeit aus kitchen_timings oder Fallback
    const { data: timingRows } = await svc
      .from('kitchen_timings')
      .select('prep_min')
      .eq('location_id', locationId)
      .not('prep_min', 'is', null)
      .limit(50);

    const prepMins = (timingRows ?? []).map((t: { prep_min: number }) => t.prep_min).filter(Boolean);
    const avgPrepMin = prepMins.length > 0
      ? prepMins.reduce((a: number, b: number) => a + b, 0) / prepMins.length
      : (orders?.reduce((acc: number, o: { geschaetzte_zubereitung_min: number | null }) =>
          acc + (o.geschaetzte_zubereitung_min ?? 20), 0) ?? 0) / Math.max(openOrders, 1);

    // 3. Überfällige Bestellungen (>5 Min über Zielzeit)
    const overdueCount = (orders ?? []).filter((o: { bestellt_am: string | null; geschaetzte_zubereitung_min: number | null }) => {
      if (!o.bestellt_am) return false;
      const elapsed = (nowMs - new Date(o.bestellt_am).getTime()) / 60_000;
      return elapsed > (o.geschaetzte_zubereitung_min ?? 20) + 5;
    }).length;

    // 4. Kapazitätsfaktor: geschätzt 2 parallele Stationen
    const capacityFactor = 2;

    // 5. Klarierungszeit
    const clearingTimeMin = openOrders > 0
      ? Math.ceil((openOrders * avgPrepMin) / capacityFactor)
      : 0;

    let urgency: BacklogData['urgency'];
    if (clearingTimeMin === 0) urgency = 'niedrig';
    else if (clearingTimeMin <= 10) urgency = 'niedrig';
    else if (clearingTimeMin <= 20) urgency = 'mittel';
    else if (clearingTimeMin <= 40) urgency = 'hoch';
    else urgency = 'kritisch';

    const clearingLabel = clearingTimeMin === 0 ? 'Kein Rückstand' : `~${clearingTimeMin} Min`;

    const recommendation =
      urgency === 'kritisch' ? 'Sofortmaßnahme: Extra-Station aktivieren oder Bestellungen pausieren.'
      : urgency === 'hoch'   ? 'Zweite Station priorisieren und Wartezeiten kommunizieren.'
      : urgency === 'mittel' ? 'Rückstand im Blick behalten — Kapazität optimieren.'
                             : 'Rückstand unter Kontrolle. Normalbetrieb.';

    return NextResponse.json({
      ok: true,
      data: {
        openOrders,
        inPrepOrders,
        avgPrepMin: Math.round(avgPrepMin * 10) / 10,
        clearingTimeMin,
        clearingLabel,
        urgency,
        overdueCount,
        capacityFactor,
        recommendation,
      },
      generatedAt: now.toISOString(),
    } satisfies BacklogResponse);
  } catch (err) {
    console.error('[kuechen-backlog-klarierung]', err);
    return NextResponse.json({ ok: false, error: 'Interner Fehler' }, { status: 500 });
  }
}
