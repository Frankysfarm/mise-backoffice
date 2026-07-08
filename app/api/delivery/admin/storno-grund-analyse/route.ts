/**
 * GET /api/delivery/admin/storno-grund-analyse?location_id=<uuid>
 *
 * Phase 829 — Storno-Grund-Analyse-API
 * Top-Stornogründe je Zone + Wochentag, letzte 14 Tage, Trend steigend/fallend.
 *
 * Inferred cancellation reasons from time-of-day and zone patterns.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function inferGrund(hour: number, zone: string | null): string {
  if (hour >= 11 && hour <= 13) return 'Mittagspeak — zu lange Wartezeit';
  if (hour >= 18 && hour <= 21) return 'Abendpeak — Küche überlastet';
  if (hour >= 22 || hour <= 5)  return 'Nachtbestellung — kein Fahrer verfügbar';
  if ((zone ?? '').toLowerCase().includes('d'))  return 'Zone D — zu weit entfernt';
  if ((zone ?? '').toLowerCase().includes('c'))  return 'Zone C — hohe Liefergebühr';
  return 'Wartezeit überschritten';
}

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
  const seit14d = new Date(now.getTime() - 14 * 24 * 3_600_000).toISOString();
  const seit7d  = new Date(now.getTime() -  7 * 24 * 3_600_000).toISOString();

  const { data: orders14d } = await sb
    .from('customer_orders')
    .select('id, status, created_at, delivery_zone')
    .eq('location_id', locationId)
    .gte('created_at', seit14d);

  const all = orders14d ?? [];
  const stornos = all.filter(o => (o.status as string) === 'storniert');

  // --- Top-Gründe aggregieren --------------------------------------------------
  const grundMap = new Map<string, { count7d: number; count14d: number }>();
  for (const o of stornos) {
    const h = new Date(o.created_at as string).getUTCHours();
    const grund = inferGrund(h, o.delivery_zone as string | null);
    const entry = grundMap.get(grund) ?? { count7d: 0, count14d: 0 };
    entry.count14d++;
    if (new Date(o.created_at as string) >= new Date(seit7d)) entry.count7d++;
    grundMap.set(grund, entry);
  }

  const topGruende = Array.from(grundMap.entries())
    .map(([grund, { count7d, count14d }]) => {
      const prev7d = count14d - count7d;
      const trend: 'steigend' | 'fallend' | 'stabil' =
        count7d > prev7d + 1 ? 'steigend' :
        count7d < prev7d - 1 ? 'fallend' : 'stabil';
      return { grund, count14d, count7d, trend };
    })
    .sort((a, b) => b.count14d - a.count14d)
    .slice(0, 6);

  // --- Je Zone ----------------------------------------------------------------
  const zoneMap = new Map<string, { storno14d: number; total14d: number; storno7d: number; total7d: number }>();
  for (const o of all) {
    const zone = (o.delivery_zone as string) ?? 'Unbekannt';
    const entry = zoneMap.get(zone) ?? { storno14d: 0, total14d: 0, storno7d: 0, total7d: 0 };
    const isStorno = (o.status as string) === 'storniert';
    const isRecent = new Date(o.created_at as string) >= new Date(seit7d);
    entry.total14d++;
    if (isStorno) entry.storno14d++;
    if (isRecent) {
      entry.total7d++;
      if (isStorno) entry.storno7d++;
    }
    zoneMap.set(zone, entry);
  }

  const jeZone = Array.from(zoneMap.entries())
    .filter(([, v]) => v.total14d >= 5)
    .map(([zone, v]) => {
      const rate14d = v.total14d > 0 ? Math.round((v.storno14d / v.total14d) * 1000) / 10 : 0;
      const rate7d  = v.total7d  > 0 ? Math.round((v.storno7d  / v.total7d)  * 1000) / 10 : 0;
      const prev7d  = v.total14d - v.total7d > 0
        ? Math.round(((v.storno14d - v.storno7d) / (v.total14d - v.total7d)) * 1000) / 10
        : rate14d;
      const trend: 'steigend' | 'fallend' | 'stabil' =
        rate7d > prev7d + 1 ? 'steigend' :
        rate7d < prev7d - 1 ? 'fallend' : 'stabil';
      return { zone, rate14d, rate7d, trend, storno14d: v.storno14d, total14d: v.total14d };
    })
    .sort((a, b) => b.rate14d - a.rate14d);

  // --- Je Wochentag -----------------------------------------------------------
  const wdStorno = new Array<number>(7).fill(0);
  const wdTotal  = new Array<number>(7).fill(0);
  const wdStorno7 = new Array<number>(7).fill(0);
  const wdTotal7  = new Array<number>(7).fill(0);
  for (const o of all) {
    const wd = new Date(o.created_at as string).getUTCDay();
    const isStorno = (o.status as string) === 'storniert';
    const isRecent = new Date(o.created_at as string) >= new Date(seit7d);
    wdTotal[wd]++;
    if (isStorno) wdStorno[wd]++;
    if (isRecent) {
      wdTotal7[wd]++;
      if (isStorno) wdStorno7[wd]++;
    }
  }

  const jeWochentag = Array.from({ length: 7 }, (_, wd) => {
    const rate14d = wdTotal[wd]  > 0 ? Math.round((wdStorno[wd]  / wdTotal[wd])  * 1000) / 10 : 0;
    const rate7d  = wdTotal7[wd] > 0 ? Math.round((wdStorno7[wd] / wdTotal7[wd]) * 1000) / 10 : 0;
    const prev7d  = wdTotal[wd] - wdTotal7[wd] > 0
      ? Math.round(((wdStorno[wd] - wdStorno7[wd]) / (wdTotal[wd] - wdTotal7[wd])) * 1000) / 10
      : rate14d;
    const trend: 'steigend' | 'fallend' | 'stabil' =
      rate7d > prev7d + 1 ? 'steigend' :
      rate7d < prev7d - 1 ? 'fallend' : 'stabil';
    return { tag: WOCHENTAGE[wd], wd, rate14d, rate7d, trend };
  });

  const gesamtRate = all.length > 0
    ? Math.round((stornos.length / all.length) * 1000) / 10
    : 0;

  return NextResponse.json({
    gesamtRate,
    stornos14d: stornos.length,
    bestellungen14d: all.length,
    topGruende,
    jeZone,
    jeWochentag,
    aktualisiert: now.toISOString(),
  });
}
