/**
 * GET /api/delivery/admin/schicht-uebergabe?location_id=<uuid>
 *
 * Phase 1319 — Schicht-Übergabe-Protokoll-API (Backend)
 * Offene Bestellungen + laufende Touren + aktive Fahrer beim Schichtwechsel.
 * Supabase + Mock-Fallback. Multi-Tenant.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface OffeneBestellung {
  id: string;
  bestellnummer: string;
  status: string;
  erstellt_um: string;
  zone: string | null;
}

export interface LaufendeTour {
  batch_id: string;
  fahrer_name: string;
  stopps_gesamt: number;
  stopps_abgeschlossen: number;
  gestartet_um: string;
}

export interface AktiveFahrer {
  id: string;
  name: string;
  ist_online: boolean;
  aktuelle_stopps: number;
}

export interface SchichtUebergabe {
  offene_bestellungen: OffeneBestellung[];
  laufende_touren: LaufendeTour[];
  aktive_fahrer: AktiveFahrer[];
  gesamt_offen: number;
  gesamt_touren: number;
  gesamt_fahrer: number;
  location_id: string;
  generiert_am: string;
}

function buildMock(locationId: string): SchichtUebergabe {
  return {
    offene_bestellungen: [
      { id: 'ord-1', bestellnummer: '#1042', status: 'preparing', erstellt_um: new Date(Date.now() - 18 * 60_000).toISOString(), zone: 'A' },
      { id: 'ord-2', bestellnummer: '#1043', status: 'waiting',   erstellt_um: new Date(Date.now() -  7 * 60_000).toISOString(), zone: 'B' },
      { id: 'ord-3', bestellnummer: '#1044', status: 'ready',     erstellt_um: new Date(Date.now() - 25 * 60_000).toISOString(), zone: 'A' },
    ],
    laufende_touren: [
      { batch_id: 'bat-1', fahrer_name: 'Max M.', stopps_gesamt: 4, stopps_abgeschlossen: 2, gestartet_um: new Date(Date.now() - 32 * 60_000).toISOString() },
      { batch_id: 'bat-2', fahrer_name: 'Lisa K.', stopps_gesamt: 3, stopps_abgeschlossen: 1, gestartet_um: new Date(Date.now() - 15 * 60_000).toISOString() },
    ],
    aktive_fahrer: [
      { id: 'drv-1', name: 'Max M.',  ist_online: true,  aktuelle_stopps: 2 },
      { id: 'drv-2', name: 'Lisa K.', ist_online: true,  aktuelle_stopps: 1 },
      { id: 'drv-3', name: 'Tom R.',  ist_online: false, aktuelle_stopps: 0 },
    ],
    gesamt_offen: 3,
    gesamt_touren: 2,
    gesamt_fahrer: 3,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();

    const [ordersRes, batchesRes, driversRes] = await Promise.all([
      (sb as any)
        .from('customer_orders')
        .select('id, bestellnummer, status, created_at, delivery_zone')
        .eq('location_id', locationId)
        .in('status', ['waiting', 'preparing', 'ready', 'dispatched'])
        .order('created_at', { ascending: false })
        .limit(20),
      (sb as any)
        .from('mise_delivery_batches')
        .select('id, started_at, mise_delivery_stops(id, status, customer_orders(id))')
        .eq('location_id', locationId)
        .eq('status', 'in_progress')
        .limit(10),
      (sb as any)
        .from('mise_drivers')
        .select('id, ist_online, employee:employees(vorname, nachname)')
        .eq('location_id', locationId)
        .limit(20),
    ]);

    if (ordersRes.error && batchesRes.error && driversRes.error) {
      return NextResponse.json(buildMock(locationId));
    }

    const orders: OffeneBestellung[] = ((ordersRes.data ?? []) as {
      id: string; bestellnummer: string; status: string; created_at: string; delivery_zone: string | null;
    }[]).map((o) => ({
      id: o.id,
      bestellnummer: o.bestellnummer ?? o.id.slice(0, 6),
      status: o.status,
      erstellt_um: o.created_at,
      zone: o.delivery_zone,
    }));

    const touren: LaufendeTour[] = ((batchesRes.data ?? []) as {
      id: string; started_at: string;
      mise_delivery_stops: { id: string; status: string }[];
    }[]).map((b, i) => {
      const stops = b.mise_delivery_stops ?? [];
      return {
        batch_id: b.id,
        fahrer_name: `Fahrer ${i + 1}`,
        stopps_gesamt: stops.length,
        stopps_abgeschlossen: stops.filter((s) => s.status === 'delivered').length,
        gestartet_um: b.started_at,
      };
    });

    const fahrer: AktiveFahrer[] = ((driversRes.data ?? []) as {
      id: string; ist_online: boolean;
      employee: { vorname: string; nachname: string } | null;
    }[]).map((d) => ({
      id: d.id,
      name: d.employee ? `${d.employee.vorname} ${d.employee.nachname.charAt(0)}.` : d.id.slice(0, 8),
      ist_online: d.ist_online ?? false,
      aktuelle_stopps: 0,
    }));

    const result: SchichtUebergabe = {
      offene_bestellungen: orders,
      laufende_touren: touren,
      aktive_fahrer: fahrer,
      gesamt_offen: orders.length,
      gesamt_touren: touren.length,
      gesamt_fahrer: fahrer.length,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
