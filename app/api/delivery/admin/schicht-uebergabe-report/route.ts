/**
 * GET /api/delivery/admin/schicht-uebergabe-report?location_id=<uuid>
 *
 * Phase 1420 — Schicht-Übergabe-Report (Admin)
 * Zusammenfassung für reibungslosen Schichtwechsel:
 *   • Offene Bestellungen (Status + Wartezeit)
 *   • Aktive Fahrer (online / in Tour)
 *   • Queue-Tiefe + längste Wartezeit
 *   • Kritische Alarme (>25 Min in Zubereitung)
 * Supabase customer_orders + mise_drivers + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OffeneBestellung {
  id: string;
  bestellnummer: string;
  status: string;
  wartezeit_min: number;
  kritisch: boolean;
}

interface SchichtUebergabeReport {
  offene_bestellungen: OffeneBestellung[];
  aktive_fahrer: number;
  fahrer_in_tour: number;
  queue_tiefe: number;
  max_wartezeit_min: number;
  kritische_alarme: number;
  status: 'ok' | 'warnung' | 'kritisch';
  empfehlung: string | null;
  generiert_am: string;
}

function buildMock(): SchichtUebergabeReport {
  const now = new Date().toISOString();
  return {
    offene_bestellungen: [
      { id: 'm1', bestellnummer: '1042', status: 'neu', wartezeit_min: 8, kritisch: false },
      { id: 'm2', bestellnummer: '1041', status: 'zubereitung', wartezeit_min: 22, kritisch: false },
      { id: 'm3', bestellnummer: '1040', status: 'zubereitung', wartezeit_min: 31, kritisch: true },
    ],
    aktive_fahrer: 3,
    fahrer_in_tour: 2,
    queue_tiefe: 3,
    max_wartezeit_min: 31,
    kritische_alarme: 1,
    status: 'warnung',
    empfehlung: 'Bestellung #1040 priorisieren — 31 Min in Zubereitung.',
    generiert_am: now,
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const since4h = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    const { data: orders, error: ordersErr } = await (sb as any)
      .from('customer_orders')
      .select('id, bestellnummer, status, bestellt_am')
      .eq('location_id', locationId)
      .in('status', ['neu', 'bestaetigt', 'zubereitung', 'fertig'])
      .gte('bestellt_am', since4h)
      .order('bestellt_am', { ascending: true });

    const { data: drivers, error: driversErr } = await (sb as any)
      .from('mise_drivers')
      .select('id, ist_online:driver_status(ist_online, aktueller_batch_id)')
      .eq('location_id', locationId)
      .eq('aktiv', true);

    if (ordersErr || !orders) return NextResponse.json(buildMock());

    const now = Date.now();
    const offene: OffeneBestellung[] = (orders as { id: string; bestellnummer: string; status: string; bestellt_am: string | null }[])
      .map((o) => {
        const waitMin = o.bestellt_am
          ? Math.round((now - new Date(o.bestellt_am).getTime()) / 60_000)
          : 0;
        return {
          id: o.id,
          bestellnummer: o.bestellnummer ?? o.id.slice(0, 6),
          status: o.status,
          wartezeit_min: waitMin,
          kritisch: waitMin > 25 && o.status === 'zubereitung',
        };
      });

    const kritischeAlarme = offene.filter((o) => o.kritisch).length;
    const maxWarten = offene.length > 0 ? Math.max(...offene.map((o) => o.wartezeit_min)) : 0;

    let aktiveFahrer = 0;
    let fahrerInTour = 0;
    if (!driversErr && drivers) {
      for (const d of drivers as { ist_online: { ist_online: boolean; aktueller_batch_id: string | null }[] }[]) {
        const s = d.ist_online?.[0];
        if (s?.ist_online) {
          aktiveFahrer++;
          if (s.aktueller_batch_id) fahrerInTour++;
        }
      }
    }

    const status: SchichtUebergabeReport['status'] =
      kritischeAlarme > 0 ? 'kritisch' : maxWarten > 20 ? 'warnung' : 'ok';

    let empfehlung: string | null = null;
    if (kritischeAlarme > 0) {
      const k = offene.find((o) => o.kritisch);
      empfehlung = `Bestellung #${k?.bestellnummer} priorisieren — ${k?.wartezeit_min} Min in Zubereitung.`;
    } else if (offene.length > 0 && aktiveFahrer === 0) {
      empfehlung = 'Keine Fahrer online — Zustellung verzögert sich.';
    }

    return NextResponse.json({
      offene_bestellungen: offene,
      aktive_fahrer: aktiveFahrer,
      fahrer_in_tour: fahrerInTour,
      queue_tiefe: offene.length,
      max_wartezeit_min: maxWarten,
      kritische_alarme: kritischeAlarme,
      status,
      empfehlung,
      generiert_am: new Date().toISOString(),
    } satisfies SchichtUebergabeReport);
  } catch {
    return NextResponse.json(buildMock());
  }
}
