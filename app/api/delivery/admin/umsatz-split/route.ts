/**
 * GET /api/delivery/admin/umsatz-split?location_id=<uuid>&tage=<7|30|90>
 *
 * Phase 923 — Lieferdienst-Umsatz-Split-API
 * Umsatz aufgeteilt nach Lieferung / Abholung / Vor-Ort je Filiale + Trend.
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

interface SplitSegment {
  typ: 'lieferung' | 'abholung' | 'vor_ort';
  label: string;
  umsatz_eur: number;
  bestellungen: number;
  anteil_pct: number;
  trend_pct: number | null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tage = Math.min(90, Math.max(1, parseInt(url.searchParams.get('tage') ?? '30', 10)));
  const sb = await createClient();

  const jetzt = new Date();
  const cutoff = new Date(jetzt);
  cutoff.setDate(cutoff.getDate() - tage);

  const cutoffVorherig = new Date(cutoff);
  cutoffVorherig.setDate(cutoffVorherig.getDate() - tage);

  const { data: orders } = await sb
    .from('customer_orders')
    .select('id, order_type, total_amount, created_at')
    .eq('location_id', locationId)
    .not('status', 'in', '("storniert","cancelled")')
    .gte('created_at', cutoffVorherig.toISOString())
    .order('created_at', { ascending: true });

  if (!orders || orders.length === 0) {
    return NextResponse.json({
      segmente: [],
      gesamt_umsatz_eur: 0,
      gesamt_bestellungen: 0,
      zeitraum_tage: tage,
      generatedAt: jetzt.toISOString(),
    });
  }

  const aktuell = orders.filter((o) => new Date(o.created_at) >= cutoff);
  const vorherig = orders.filter((o) => new Date(o.created_at) < cutoff);

  type Typ = 'lieferung' | 'abholung' | 'vor_ort';

  function klassifiziere(ot: string | null): Typ {
    const t = (ot ?? '').toLowerCase();
    if (t.includes('lieferung') || t === 'delivery') return 'lieferung';
    if (t.includes('abholung') || t === 'pickup') return 'abholung';
    return 'vor_ort';
  }

  function aggregiere(list: NonNullable<typeof orders>) {
    const map: Record<Typ, { umsatz: number; count: number }> = {
      lieferung: { umsatz: 0, count: 0 },
      abholung: { umsatz: 0, count: 0 },
      vor_ort: { umsatz: 0, count: 0 },
    };
    for (const o of list) {
      const k = klassifiziere(o.order_type);
      map[k].umsatz += Number(o.total_amount ?? 0);
      map[k].count += 1;
    }
    return map;
  }

  const akMap = aggregiere(aktuell);
  const voMap = aggregiere(vorherig);

  const gesamt = aktuell.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
  const gesamtBestellungen = aktuell.length;

  const LABELS: Record<Typ, string> = {
    lieferung: 'Lieferung',
    abholung: 'Abholung',
    vor_ort: 'Vor-Ort',
  };

  const segmente: SplitSegment[] = (['lieferung', 'abholung', 'vor_ort'] as Typ[]).map((typ) => {
    const ak = akMap[typ];
    const vo = voMap[typ];
    const anteil = gesamt > 0 ? (ak.umsatz / gesamt) * 100 : 0;
    const trend = vo.umsatz > 0 ? ((ak.umsatz - vo.umsatz) / vo.umsatz) * 100 : null;

    return {
      typ,
      label: LABELS[typ],
      umsatz_eur: Math.round(ak.umsatz * 100) / 100,
      bestellungen: ak.count,
      anteil_pct: Math.round(anteil * 10) / 10,
      trend_pct: trend !== null ? Math.round(trend * 10) / 10 : null,
    };
  });

  return NextResponse.json({
    segmente,
    gesamt_umsatz_eur: Math.round(gesamt * 100) / 100,
    gesamt_bestellungen: gesamtBestellungen,
    zeitraum_tage: tage,
    generatedAt: jetzt.toISOString(),
  });
}
