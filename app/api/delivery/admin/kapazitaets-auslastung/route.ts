/**
 * GET /api/delivery/admin/kapazitaets-auslastung?location_id=<uuid>
 *
 * Phase 1465 — Kapazitäts-Auslastungs-API
 * Aktive Fahrer vs. Kapazität + Bestellungen in Queue + Durchsatz/h + Empfehlung.
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface KapazitaetsAuslastung {
  aktive_fahrer: number;
  max_fahrer: number;
  auslastungs_prozent: number;
  bestellungen_in_queue: number;
  durchsatz_pro_stunde: number;
  wartezeit_min: number;
  status: 'ausreichend' | 'warnung' | 'kritisch';
  empfehlung: string;
  location_id: string;
  generiert_am: string;
}

function calcStatus(auslastung: number, queue: number): 'ausreichend' | 'warnung' | 'kritisch' {
  if (auslastung >= 90 || queue >= 10) return 'kritisch';
  if (auslastung >= 70 || queue >= 6) return 'warnung';
  return 'ausreichend';
}

function calcEmpfehlung(status: string, aktiveFahrer: number, queue: number): string {
  if (status === 'kritisch') return `Kritische Auslastung — ${queue} Bestellungen warten. Zusätzlichen Fahrer einplanen.`;
  if (status === 'warnung') return `Hohe Auslastung mit ${aktiveFahrer} Fahrern. Kapazität beobachten.`;
  return `Kapazität ausreichend. ${aktiveFahrer} Fahrer aktiv, Betrieb läuft normal.`;
}

function buildMock(): KapazitaetsAuslastung {
  return {
    aktive_fahrer: 3,
    max_fahrer: 5,
    auslastungs_prozent: 60,
    bestellungen_in_queue: 4,
    durchsatz_pro_stunde: 12,
    wartezeit_min: 22,
    status: 'ausreichend',
    empfehlung: 'Kapazität ausreichend. 3 Fahrer aktiv, Betrieb läuft normal.',
    location_id: 'mock',
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const { data: drivers } = await (sb as any)
      .from('mise_drivers')
      .select('id')
      .eq('location_id', locationId)
      .eq('aktiv', true);

    const { data: allDrivers } = await (sb as any)
      .from('mise_drivers')
      .select('id')
      .eq('location_id', locationId);

    const aktiveFahrer = drivers ? (drivers as unknown[]).length : 0;
    const maxFahrer = allDrivers ? (allDrivers as unknown[]).length : 0;

    if (aktiveFahrer === 0) {
      return NextResponse.json({ ...buildMock(), location_id: locationId });
    }

    const { data: queueOrders } = await (sb as any)
      .from('customer_orders')
      .select('id, created_at')
      .eq('location_id', locationId)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready']);

    const queueCount = queueOrders ? (queueOrders as unknown[]).length : 0;

    const stundeVor = new Date(Date.now() - 3_600_000).toISOString();
    const { data: letzteStunde } = await (sb as any)
      .from('customer_orders')
      .select('id')
      .eq('location_id', locationId)
      .eq('status', 'delivered')
      .gte('updated_at', stundeVor);

    const durchsatz = letzteStunde ? (letzteStunde as unknown[]).length : 0;

    const auslastungsProzent = maxFahrer > 0
      ? Math.round((aktiveFahrer / maxFahrer) * 100)
      : 0;

    const wartezeit = aktiveFahrer > 0
      ? Math.max(0, Math.round((queueCount / aktiveFahrer) * 8))
      : queueCount * 10;

    const status = calcStatus(auslastungsProzent, queueCount);
    const empfehlung = calcEmpfehlung(status, aktiveFahrer, queueCount);

    const response: KapazitaetsAuslastung = {
      aktive_fahrer: aktiveFahrer,
      max_fahrer: maxFahrer,
      auslastungs_prozent: auslastungsProzent,
      bestellungen_in_queue: queueCount,
      durchsatz_pro_stunde: durchsatz,
      wartezeit_min: wartezeit,
      status,
      empfehlung,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ ...buildMock(), location_id: locationId });
  }
}
