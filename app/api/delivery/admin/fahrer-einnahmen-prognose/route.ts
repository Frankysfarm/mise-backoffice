/**
 * GET /api/delivery/admin/fahrer-einnahmen-prognose?location_id=<uuid>
 *
 * Phase 1771 — Fahrer-Einnahmen-Prognose-API (Backend)
 * Vorhergesagte Schicht-Einnahmen je Fahrer basierend auf aktueller Auftragslage;
 * Trend vs. gestern; Multi-Tenant; Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerEinnahmenPrognose {
  fahrer_id: string;
  name: string;
  aktive_touren: number;
  bestellungen_heute: number;
  einnahmen_heute_eur: number;
  prognose_schicht_ende_eur: number;
  trend_vs_gestern: 'up' | 'down' | 'gleich';
  trend_pct: number;
}

export interface FahrerEinnahmenPrognoseAntwort {
  fahrer: FahrerEinnahmenPrognose[];
  location_id: string;
  generiert_am: string;
}

function buildMock(locationId: string): FahrerEinnahmenPrognoseAntwort {
  const fahrer: FahrerEinnahmenPrognose[] = [
    { fahrer_id: 'drv-1', name: 'Mehmet A.', aktive_touren: 3, bestellungen_heute: 18, einnahmen_heute_eur: 142.80, prognose_schicht_ende_eur: 185.40, trend_vs_gestern: 'up', trend_pct: 12 },
    { fahrer_id: 'drv-2', name: 'Lukas B.', aktive_touren: 2, bestellungen_heute: 14, einnahmen_heute_eur: 108.60, prognose_schicht_ende_eur: 152.00, trend_vs_gestern: 'up', trend_pct: 8 },
    { fahrer_id: 'drv-3', name: 'Sara K.', aktive_touren: 1, bestellungen_heute: 9, einnahmen_heute_eur: 71.20, prognose_schicht_ende_eur: 110.50, trend_vs_gestern: 'down', trend_pct: 5 },
    { fahrer_id: 'drv-4', name: 'Jonas M.', aktive_touren: 2, bestellungen_heute: 12, einnahmen_heute_eur: 95.40, prognose_schicht_ende_eur: 138.20, trend_vs_gestern: 'gleich', trend_pct: 0 },
  ];
  return { fahrer, location_id: locationId, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // Fetch active drivers for this location
    const { data: drivers, error: drvError } = await supabase
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', locationId)
      .eq('rolle', 'fahrer')
      .eq('ist_aktiv', true);

    if (drvError || !drivers || drivers.length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const fahrerPrognosen: FahrerEinnahmenPrognose[] = await Promise.all(
      drivers.map(async (drv) => {
        const name = `${drv.vorname ?? ''} ${(drv.nachname ?? '').charAt(0)}.`.trim();

        // Today's earnings
        const { data: todayData } = await supabase
          .from('delivery_tours')
          .select('id, total_earnings_eur, order_count, status')
          .eq('driver_id', drv.id)
          .eq('location_id', locationId)
          .gte('created_at', `${today}T00:00:00Z`);

        const todayTours = todayData ?? [];
        const einnahmen_heute_eur = todayTours.reduce((s: number, t: { total_earnings_eur?: number }) => s + (t.total_earnings_eur ?? 0), 0);
        const bestellungen_heute = todayTours.reduce((s: number, t: { order_count?: number }) => s + (t.order_count ?? 0), 0);
        const aktive_touren = todayTours.filter((t: { status?: string }) => t.status === 'active' || t.status === 'in_progress').length;

        // Yesterday's earnings for trend
        const { data: yData } = await supabase
          .from('delivery_tours')
          .select('total_earnings_eur')
          .eq('driver_id', drv.id)
          .eq('location_id', locationId)
          .gte('created_at', `${yesterday}T00:00:00Z`)
          .lt('created_at', `${today}T00:00:00Z`);

        const einnahmen_gestern = (yData ?? []).reduce((s: number, t: { total_earnings_eur?: number }) => s + (t.total_earnings_eur ?? 0), 0);

        // Simple prognosis: extrapolate based on current shift time (assume 8h shift)
        const now = new Date();
        const shiftStart = new Date(`${today}T10:00:00Z`);
        const shiftEnd = new Date(`${today}T20:00:00Z`);
        const shiftDurationH = (shiftEnd.getTime() - shiftStart.getTime()) / 3600000;
        const elapsedH = Math.max(0.5, (now.getTime() - shiftStart.getTime()) / 3600000);
        const rate = einnahmen_heute_eur / elapsedH;
        const prognose_schicht_ende_eur = Math.round(rate * shiftDurationH * 100) / 100;

        // Trend
        let trend_vs_gestern: 'up' | 'down' | 'gleich' = 'gleich';
        let trend_pct = 0;
        if (einnahmen_gestern > 0) {
          const diffPct = Math.round((einnahmen_heute_eur - einnahmen_gestern) / einnahmen_gestern * 100);
          trend_pct = Math.abs(diffPct);
          if (diffPct > 2) trend_vs_gestern = 'up';
          else if (diffPct < -2) trend_vs_gestern = 'down';
        }

        return {
          fahrer_id: drv.id,
          name,
          aktive_touren,
          bestellungen_heute,
          einnahmen_heute_eur: Math.round(einnahmen_heute_eur * 100) / 100,
          prognose_schicht_ende_eur: Math.max(einnahmen_heute_eur, prognose_schicht_ende_eur),
          trend_vs_gestern,
          trend_pct,
        };
      }),
    );

    return NextResponse.json({
      fahrer: fahrerPrognosen,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerEinnahmenPrognoseAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
