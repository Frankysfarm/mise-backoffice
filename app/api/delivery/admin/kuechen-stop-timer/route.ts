/**
 * Phase 1786 — Küchen-Stop-Timer-API
 * GET /api/delivery/admin/kuechen-stop-timer?location_id=<uuid>
 *
 * Aktive Bestellungen mit Laufzeit, Zielzeit und Ampel-Status.
 * Multi-Tenant; Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface BestellungTimer {
  order_id: string;
  bestellnummer: string;
  bestellzeit: string;
  minutes_seit_bestellung: number;
  ziel_lieferzeit_min: number;
  verbleibend_min: number;
  status: string;
  ampel: 'gruen' | 'gelb' | 'rot';
  artikel_anzahl: number;
}

export interface KuechenStopTimerResponse {
  bestellungen: BestellungTimer[];
  ueberfaellig: number;
  kritisch: number;
  location_id: string;
  generiert_am: string;
}

function buildMock(location_id: string): KuechenStopTimerResponse {
  const now = new Date();
  const mock: BestellungTimer[] = [
    { order_id: 'o1', bestellnummer: '#1042', bestellzeit: new Date(now.getTime() - 8 * 60000).toISOString(), minutes_seit_bestellung: 8, ziel_lieferzeit_min: 30, verbleibend_min: 22, status: 'in_preparation', ampel: 'gruen', artikel_anzahl: 2 },
    { order_id: 'o2', bestellnummer: '#1041', bestellzeit: new Date(now.getTime() - 22 * 60000).toISOString(), minutes_seit_bestellung: 22, ziel_lieferzeit_min: 30, verbleibend_min: 8, status: 'in_preparation', ampel: 'gelb', artikel_anzahl: 3 },
    { order_id: 'o3', bestellnummer: '#1039', bestellzeit: new Date(now.getTime() - 35 * 60000).toISOString(), minutes_seit_bestellung: 35, ziel_lieferzeit_min: 30, verbleibend_min: -5, status: 'pending', ampel: 'rot', artikel_anzahl: 1 },
    { order_id: 'o4', bestellnummer: '#1043', bestellzeit: new Date(now.getTime() - 5 * 60000).toISOString(), minutes_seit_bestellung: 5, ziel_lieferzeit_min: 25, verbleibend_min: 20, status: 'in_preparation', ampel: 'gruen', artikel_anzahl: 4 },
  ];
  return {
    bestellungen: mock,
    ueberfaellig: mock.filter(b => b.ampel === 'rot').length,
    kritisch: mock.filter(b => b.ampel === 'gelb').length,
    location_id,
    generiert_am: now.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');
  if (!location_id) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = await createClient();
    const now = new Date();
    const cutoff = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();

    const { data: orders } = await supabase
      .from('customer_orders')
      .select('id, order_number, created_at, status, eta_minutes, items, order_items')
      .eq('location_id', location_id)
      .in('status', ['pending', 'confirmed', 'in_preparation', 'ready'])
      .gte('created_at', cutoff)
      .order('created_at', { ascending: true });

    if (!orders || orders.length === 0) return NextResponse.json(buildMock(location_id));

    const DEFAULT_ETA = 30;
    const bestellungen: BestellungTimer[] = orders.map(o => {
      const bestellzeit = o.created_at;
      const minSeit = Math.round((now.getTime() - new Date(bestellzeit).getTime()) / 60000);
      const ziel = o.eta_minutes ?? DEFAULT_ETA;
      const verbleibend = ziel - minSeit;
      const items = (o.items ?? o.order_items ?? []) as unknown[];
      let ampel: 'gruen' | 'gelb' | 'rot' = 'gruen';
      if (verbleibend < 0) ampel = 'rot';
      else if (verbleibend < 8) ampel = 'gelb';
      return {
        order_id: o.id,
        bestellnummer: o.order_number ? `#${o.order_number}` : `#${o.id.slice(0, 4)}`,
        bestellzeit,
        minutes_seit_bestellung: minSeit,
        ziel_lieferzeit_min: ziel,
        verbleibend_min: verbleibend,
        status: o.status,
        ampel,
        artikel_anzahl: Array.isArray(items) ? items.length : 0,
      };
    });

    return NextResponse.json({
      bestellungen,
      ueberfaellig: bestellungen.filter(b => b.ampel === 'rot').length,
      kritisch: bestellungen.filter(b => b.ampel === 'gelb').length,
      location_id,
      generiert_am: now.toISOString(),
    } satisfies KuechenStopTimerResponse);
  } catch {
    return NextResponse.json(buildMock(location_id));
  }
}
