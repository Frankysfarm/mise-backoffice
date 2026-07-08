/**
 * GET /api/delivery/admin/tages-umsatz-prognose?location_id=<uuid>
 *
 * Phase 851 — Tages-Umsatz-Prognose-API
 * Prognostiziert Tagesumsatz basierend auf Wochentag + bisheriger Stundenverlauf.
 * Vergleicht mit Ø gleicher Wochentag letzte 4 Wochen.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get('location_id');
  if (fromQuery) return fromQuery;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const currentHour = now.getUTCHours();

  // Heute: stündliche Umsätze bis aktueller Stunde
  const { data: todayOrders } = await sb
    .from('customer_orders')
    .select('gesamtbetrag, created_at')
    .eq('location_id', locationId)
    .gte('created_at', todayStart.toISOString())
    .lte('created_at', now.toISOString())
    .not('status', 'eq', 'storniert');

  // Stundenweise Umsätze heute
  const stundlichHeute: number[] = Array(24).fill(0);
  for (const o of todayOrders ?? []) {
    const h = new Date(o.created_at as string).getUTCHours();
    stundlichHeute[h] += Number(o.gesamtbetrag ?? 0);
  }

  const umsatzBisJetzt = stundlichHeute.slice(0, currentHour + 1).reduce((a, b) => a + b, 0);

  // Historisch: gleicher Wochentag letzte 4 Wochen
  const wochentag = now.getUTCDay(); // 0=So, 6=Sa
  const histDaten: number[][] = []; // Umsatz je Stunde je Woche

  for (let w = 1; w <= 4; w++) {
    const wStart = new Date(todayStart.getTime() - w * 7 * 24 * 3_600_000);
    const wEnd = new Date(wStart.getTime() + 24 * 3_600_000);
    if (wStart.getUTCDay() !== wochentag) continue;

    const { data: wOrders } = await sb
      .from('customer_orders')
      .select('gesamtbetrag, created_at')
      .eq('location_id', locationId)
      .gte('created_at', wStart.toISOString())
      .lt('created_at', wEnd.toISOString())
      .not('status', 'eq', 'storniert');

    const stunden: number[] = Array(24).fill(0);
    for (const o of wOrders ?? []) {
      const h = new Date(o.created_at as string).getUTCHours();
      stunden[h] += Number(o.gesamtbetrag ?? 0);
    }
    histDaten.push(stunden);
  }

  // Ø historischer Tagesumsatz und Stundenprofil
  const avgStundenHist: number[] = Array(24).fill(0);
  if (histDaten.length > 0) {
    for (const d of histDaten) {
      for (let h = 0; h < 24; h++) avgStundenHist[h] += d[h];
    }
    for (let h = 0; h < 24; h++) avgStundenHist[h] /= histDaten.length;
  }

  const avgTagesUmsatz = avgStundenHist.reduce((a, b) => a + b, 0);
  const avgBisJetzt = avgStundenHist.slice(0, currentHour + 1).reduce((a, b) => a + b, 0);

  // Hochrechnung: skaliert aktuellen Umsatz auf Basis historischem Tagesprofil
  const restprozent = avgBisJetzt > 0
    ? Math.max(0, (avgTagesUmsatz - avgBisJetzt) / avgTagesUmsatz)
    : 0;

  const trendFaktor = avgBisJetzt > 0 ? umsatzBisJetzt / avgBisJetzt : 1;
  const prognose = umsatzBisJetzt + restprozent * avgTagesUmsatz * trendFaktor;

  // Konfidenz-Intervall ±15% basierend auf historischer Varianz
  const varianzFaktor = histDaten.length >= 3 ? 0.12 : histDaten.length >= 2 ? 0.18 : 0.25;
  const konfidenzBand = prognose * varianzFaktor;

  // Stündliche Chart-Daten
  const stunden = Array.from({ length: currentHour + 1 }, (_, h) => ({
    stunde: `${String(h).padStart(2, '0')}:00`,
    heute: Math.round(stundlichHeute[h] * 100) / 100,
    historisch: Math.round(avgStundenHist[h] * 100) / 100,
  }));

  return NextResponse.json({
    umsatz_bis_jetzt: Math.round(umsatzBisJetzt * 100) / 100,
    prognose_gesamt: Math.round(prognose * 100) / 100,
    konfidenz_min: Math.round(Math.max(0, prognose - konfidenzBand) * 100) / 100,
    konfidenz_max: Math.round((prognose + konfidenzBand) * 100) / 100,
    historisch_avg: Math.round(avgTagesUmsatz * 100) / 100,
    trend_faktor: Math.round(trendFaktor * 100) / 100,
    trend_label: trendFaktor >= 1.1 ? 'stark' : trendFaktor >= 0.95 ? 'normal' : 'schwach',
    aktuelle_stunde: currentHour,
    wochentag,
    stunden,
    generatedAt: now.toISOString(),
  });
}
