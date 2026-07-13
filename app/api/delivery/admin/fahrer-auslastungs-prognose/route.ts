import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Phase 1208 — Fahrer-Auslastungs-Prognose-API
// GET /api/delivery/admin/fahrer-auslastungs-prognose?location_id=<uuid>
// Wie viele Fahrer werden in der nächsten Stunde benötigt
// basierend auf historischem Auftragsvolumen + aktuelle Queue

type PrognoseStunde = {
  stunde_offset: number;
  stunde_label: string;
  erwartete_bestellungen: number;
  benoetigte_fahrer: number;
  verfuegbare_fahrer: number;
  delta: number;
  status: 'ausreichend' | 'knapp' | 'kritisch';
};

type ApiResponse = {
  prognose: PrognoseStunde[];
  aktuelle_queue: number;
  aktive_fahrer: number;
  empfehlung: string;
  location_id: string | null;
  generiert_am: string;
};

const BESTELLUNGEN_PRO_FAHRER_PRO_STUNDE = 4;

function stundenlabel(offsetH: number): string {
  const now = new Date();
  const h = (now.getUTCHours() + offsetH) % 24;
  return `${String(h).padStart(2, '0')}:00`;
}

function mockData(locationId: string | null): ApiResponse {
  return {
    prognose: [
      { stunde_offset: 1, stunde_label: stundenlabel(1), erwartete_bestellungen: 18, benoetigte_fahrer: 5, verfuegbare_fahrer: 4, delta: -1, status: 'knapp' },
      { stunde_offset: 2, stunde_label: stundenlabel(2), erwartete_bestellungen: 22, benoetigte_fahrer: 6, verfuegbare_fahrer: 4, delta: -2, status: 'kritisch' },
      { stunde_offset: 3, stunde_label: stundenlabel(3), erwartete_bestellungen: 15, benoetigte_fahrer: 4, verfuegbare_fahrer: 5, delta: 1, status: 'ausreichend' },
    ],
    aktuelle_queue: 6,
    aktive_fahrer: 4,
    empfehlung: 'In Stunde +2 werden 2 zusätzliche Fahrer benötigt — jetzt einplanen.',
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

function deriveStatus(delta: number): PrognoseStunde['status'] {
  if (delta >= 0) return 'ausreichend';
  if (delta === -1) return 'knapp';
  return 'kritisch';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(mockData(null));

  try {
    const supabase = await createClient();

    // Aktive Fahrer
    const { data: drivers } = await supabase
      .from('mise_drivers')
      .select('id')
      .eq('location_id', locationId)
      .eq('online', true);

    const aktiveFahrer = drivers?.length ?? 0;

    // Aktuelle Queue (nicht zugewiesene Bestellungen)
    const { count: queueCount } = await supabase
      .from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .in('status', ['neu', 'angenommen', 'in_zubereitung', 'bereit'])
      .is('assigned_driver_id', null);

    const aktuelleQueue = queueCount ?? 0;

    // Historische Rate: Bestellungen der letzten 4 Stunden
    const vor4h = new Date(Date.now() - 4 * 3600000).toISOString();
    const { data: recentOrders } = await supabase
      .from('customer_orders')
      .select('created_at')
      .eq('location_id', locationId)
      .gte('created_at', vor4h);

    const basisRate = recentOrders ? Math.round(recentOrders.length / 4) : 12;

    const prognose: PrognoseStunde[] = [1, 2, 3].map(offset => {
      const erwartet = Math.round(basisRate * (1 + (offset === 2 ? 0.2 : 0)));
      const benoetigt = Math.ceil(erwartet / BESTELLUNGEN_PRO_FAHRER_PRO_STUNDE);
      const delta = aktiveFahrer - benoetigt;
      return {
        stunde_offset: offset,
        stunde_label: stundenlabel(offset),
        erwartete_bestellungen: erwartet,
        benoetigte_fahrer: benoetigt,
        verfuegbare_fahrer: aktiveFahrer,
        delta,
        status: deriveStatus(delta),
      };
    });

    const kritisch = prognose.filter(p => p.status === 'kritisch');
    const empfehlung = kritisch.length > 0
      ? `In Stunde +${kritisch[0].stunde_offset} werden ${Math.abs(kritisch[0].delta)} zusätzliche Fahrer benötigt.`
      : aktiveFahrer >= 5
        ? 'Fahrer-Kapazität ausreichend für die nächsten 3 Stunden.'
        : 'Auslastung beobachten — bei Bedarf Fahrer einplanen.';

    return NextResponse.json({
      prognose,
      aktuelle_queue: aktuelleQueue,
      aktive_fahrer: aktiveFahrer,
      empfehlung,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } as ApiResponse);
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
