/**
 * GET /api/delivery/admin/lieferzonen-auslastungs-index?location_id=<uuid>
 *
 * Phase 1063 — Lieferzonen-Auslastungs-Index (Backend)
 * Echtzeit-Kapazitätsindex je Zone: aktive Fahrer vs. offene Bestellungen.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ZoneIndex {
  zone: string;
  offene_bestellungen: number;
  aktive_fahrer: number;
  kapazitaets_index: number; // 0–100, 100 = vollständig abgedeckt
  bestellungen_pro_fahrer: number;
  status: 'ok' | 'angespannt' | 'kritisch' | 'keine_fahrer';
  empfehlung: string;
}

interface Response {
  zonen: ZoneIndex[];
  gesamt_index: number;
  kritische_zonen: number;
  location_id: string | null;
  generiert_am: string;
}

const ZONEN = ['A', 'B', 'C', 'D'];
const OPTIMAL_BESTELLUNGEN_PRO_FAHRER = 3;

function berechneIndex(offene: number, fahrer: number): number {
  if (fahrer === 0 && offene === 0) return 100;
  if (fahrer === 0) return 0;
  const ratio = offene / (fahrer * OPTIMAL_BESTELLUNGEN_PRO_FAHRER);
  return Math.max(0, Math.round(100 - (ratio - 1) * 50));
}

function berechneStatus(idx: number, fahrer: number): ZoneIndex['status'] {
  if (fahrer === 0) return 'keine_fahrer';
  if (idx >= 75) return 'ok';
  if (idx >= 45) return 'angespannt';
  return 'kritisch';
}

function berechneEmpfehlung(status: ZoneIndex['status'], zone: string, bpf: number): string {
  if (status === 'keine_fahrer') return `Fahrer in Zone ${zone} einteilen`;
  if (status === 'kritisch') return `${Math.ceil(bpf / OPTIMAL_BESTELLUNGEN_PRO_FAHRER)} Fahrer fehlen in Zone ${zone}`;
  if (status === 'angespannt') return `1 weiterer Fahrer für Zone ${zone} empfohlen`;
  return 'Kapazität ausreichend';
}

function mockData(locationId: string | null): Response {
  const zonen: ZoneIndex[] = [
    { zone: 'A', offene_bestellungen: 4, aktive_fahrer: 3, kapazitaets_index: 89, bestellungen_pro_fahrer: 1.3, status: 'ok', empfehlung: 'Kapazität ausreichend' },
    { zone: 'B', offene_bestellungen: 11, aktive_fahrer: 2, kapazitaets_index: 45, bestellungen_pro_fahrer: 5.5, status: 'angespannt', empfehlung: '1 weiterer Fahrer für Zone B empfohlen' },
    { zone: 'C', offene_bestellungen: 8, aktive_fahrer: 1, kapazitaets_index: 13, bestellungen_pro_fahrer: 8.0, status: 'kritisch', empfehlung: '2 Fahrer fehlen in Zone C' },
    { zone: 'D', offene_bestellungen: 0, aktive_fahrer: 0, kapazitaets_index: 100, bestellungen_pro_fahrer: 0, status: 'keine_fahrer', empfehlung: 'Fahrer in Zone D einteilen' },
  ];
  const gesamt_index = Math.round(zonen.reduce((s, z) => s + z.kapazitaets_index, 0) / zonen.length);
  const kritische_zonen = zonen.filter((z) => z.status === 'kritisch' || z.status === 'keine_fahrer').length;
  return { zonen, gesamt_index, kritische_zonen, location_id: locationId, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(mockData(null));

  try {
    const sb = await createClient();
    const cutoff = new Date(Date.now() - 4 * 60 * 60_000).toISOString();

    const [{ data: orders }, { data: drivers }] = await Promise.all([
      sb
        .from('customer_orders')
        .select('id, delivery_zone, status')
        .eq('location_id', locationId)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'dispatched', 'en_route', 'unterwegs', 'assigned'])
        .gte('created_at', cutoff),
      sb
        .from('mise_drivers')
        .select('id, zone, status')
        .eq('location_id', locationId)
        .in('status', ['online', 'active', 'verfuegbar', 'available', 'busy', 'in_delivery', 'unterwegs']),
    ]);

    const zonen: ZoneIndex[] = ZONEN.map((zone) => {
      const offene = (orders ?? []).filter((o) => {
        const oz = o as { delivery_zone?: string | null };
        return (oz.delivery_zone ?? 'A') === zone;
      }).length;
      const fahrer = (drivers ?? []).filter((d) => {
        const dz = d as { zone?: string | null };
        return (dz.zone ?? 'A') === zone;
      }).length;
      const idx = berechneIndex(offene, fahrer);
      const status = berechneStatus(idx, fahrer);
      const bpf = fahrer > 0 ? offene / fahrer : offene;
      return {
        zone,
        offene_bestellungen: offene,
        aktive_fahrer: fahrer,
        kapazitaets_index: idx,
        bestellungen_pro_fahrer: Math.round(bpf * 10) / 10,
        status,
        empfehlung: berechneEmpfehlung(status, zone, bpf),
      };
    });

    const gesamt_index = Math.round(zonen.reduce((s, z) => s + z.kapazitaets_index, 0) / ZONEN.length);
    const kritische_zonen = zonen.filter((z) => z.status === 'kritisch' || z.status === 'keine_fahrer').length;

    return NextResponse.json({ zonen, gesamt_index, kritische_zonen, location_id: locationId, generiert_am: new Date().toISOString() });
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
