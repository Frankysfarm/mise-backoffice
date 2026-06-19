/**
 * GET /api/delivery/admin/stats?location_id=...&action=storno_quote
 *
 * action=storno_quote: Stornoquote heute + Verlauf für StornoquotePanel.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const action = searchParams.get('action');

  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  if (action === 'storno_quote') {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);

    const [{ data: todayOrders }, { data: yesterdayOrders }] = await Promise.all([
      sb.from('customer_orders')
        .select('id, status, storniert_am, stornogrund, gesamtbetrag, created_at, bestellnummer')
        .eq('location_id', locationId)
        .gte('created_at', todayStart.toISOString()),
      sb.from('customer_orders')
        .select('id, status, gesamtbetrag, created_at')
        .eq('location_id', locationId)
        .gte('created_at', yesterdayStart.toISOString())
        .lt('created_at', todayStart.toISOString()),
    ]);

    const today = todayOrders ?? [];
    const yesterday = yesterdayOrders ?? [];

    const todayStorniert = today.filter((o: Record<string, unknown>) => o.status === 'storniert');
    const gesternStorniert = yesterday.filter((o: Record<string, unknown>) => o.status === 'storniert');

    const storno_quote = today.length > 0 ? (todayStorniert.length / today.length) * 100 : 0;
    const prev_quote = yesterday.length > 0 ? (gesternStorniert.length / yesterday.length) * 100 : 0;
    const verlust_eur = todayStorniert.reduce((s: number, o: Record<string, unknown>) => s + (Number(o.gesamtbetrag) || 0), 0);

    // Storno-Gründe aggregieren
    const grundMap = new Map<string, number>();
    for (const o of todayStorniert) {
      const g = (o.stornogrund as string) || 'Unbekannt';
      grundMap.set(g, (grundMap.get(g) ?? 0) + 1);
    }
    const gruende = Array.from(grundMap.entries())
      .map(([grund, count]) => ({ grund, count }))
      .sort((a, b) => b.count - a.count);

    // Stündlicher Verlauf (letzte 12h)
    const verlaufMap = new Map<string, { storniert: number; gesamt: number }>();
    for (let h = 0; h < 12; h++) {
      const hour = new Date(now.getTime() - (11 - h) * 3_600_000);
      verlaufMap.set(String(hour.getHours()).padStart(2, '0') + ':00', { storniert: 0, gesamt: 0 });
    }
    for (const o of today) {
      const h = new Date(o.created_at as string).getHours();
      const key = String(h).padStart(2, '0') + ':00';
      if (verlaufMap.has(key)) {
        verlaufMap.get(key)!.gesamt++;
        if ((o.status as string) === 'storniert') verlaufMap.get(key)!.storniert++;
      }
    }
    const verlauf = Array.from(verlaufMap.entries()).map(([stunde, v]) => ({ stunde, ...v }));

    const letzte_stornos = todayStorniert
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())
      .slice(0, 10)
      .map((o: Record<string, unknown>) => ({
        bestellnummer: o.bestellnummer,
        grund: o.stornogrund,
        storniert_am: o.storniert_am ?? o.created_at,
        gesamtbetrag: Number(o.gesamtbetrag) || 0,
      }));

    return NextResponse.json({
      heut_gesamt: today.length,
      heut_storniert: todayStorniert.length,
      storno_quote,
      prev_quote,
      verlust_eur,
      gruende,
      verlauf,
      letzte_stornos,
    });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
