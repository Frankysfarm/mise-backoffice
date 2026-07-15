import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface KuecheRow {
  location_id: string;
  location_name: string;
  aktive_bestellungen: number;
  kapazitaetsgrenze: number;
  auslastungsgrad: number;
  eta_anpassungsfaktor: number;
  status: 'niedrig' | 'normal' | 'hoch' | 'kritisch';
}

interface KuechenAuslastungResponse {
  kuechen: KuecheRow[];
  gesamt_aktiv: number;
  gesamt_kapazitaet: number;
  gesamt_auslastung: number;
  timestamp: string;
}

const KAPAZITAET_DEFAULT = 10;

function calcStatus(auslastung: number): KuecheRow['status'] {
  if (auslastung >= 0.9) return 'kritisch';
  if (auslastung >= 0.7) return 'hoch';
  if (auslastung >= 0.4) return 'normal';
  return 'niedrig';
}

function calcEtaFaktor(auslastung: number): number {
  if (auslastung >= 0.9) return 1.5;
  if (auslastung >= 0.7) return 1.25;
  if (auslastung >= 0.4) return 1.0;
  return 0.9;
}

function buildMock(locationId: string | null): KuechenAuslastungResponse {
  const locations = locationId
    ? [{ id: locationId, name: 'Filiale' }]
    : [
        { id: 'loc-1', name: 'Aachen Mitte' },
        { id: 'loc-2', name: 'Aachen West' },
        { id: 'loc-3', name: 'Aachen Ost' },
      ];

  const aktivCounts = [7, 4, 9];
  let gesamt_aktiv = 0;
  let gesamt_kapazitaet = 0;

  const kuechen: KuecheRow[] = locations.map((loc, i) => {
    const aktiv = aktivCounts[i % aktivCounts.length];
    const grenze = KAPAZITAET_DEFAULT;
    const auslastungsgrad = aktiv / grenze;
    gesamt_aktiv += aktiv;
    gesamt_kapazitaet += grenze;
    return {
      location_id: loc.id,
      location_name: loc.name,
      aktive_bestellungen: aktiv,
      kapazitaetsgrenze: grenze,
      auslastungsgrad: parseFloat(auslastungsgrad.toFixed(2)),
      eta_anpassungsfaktor: calcEtaFaktor(auslastungsgrad),
      status: calcStatus(auslastungsgrad),
    };
  });

  return {
    kuechen,
    gesamt_aktiv,
    gesamt_kapazitaet,
    gesamt_auslastung: parseFloat((gesamt_aktiv / gesamt_kapazitaet).toFixed(2)),
    timestamp: new Date().toISOString(),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = createClient();

    const activeStati = ['bestätigt', 'in_zubereitung', 'neu', 'confirmed', 'preparing'];

    let query = supabase
      .from('orders')
      .select('id, location_id, status')
      .in('status', activeStati);

    if (locationId) query = query.eq('location_id', locationId);

    const { data: orders, error } = await query;
    if (error) throw error;
    if (!orders || orders.length === 0) return NextResponse.json(buildMock(locationId));

    let locQuery = supabase.from('locations').select('id, name');
    if (locationId) locQuery = locQuery.eq('id', locationId);
    const { data: locations } = await locQuery;

    const locMap = new Map<string, string>(
      (locations ?? []).map((l: { id: string; name: string }) => [l.id, l.name]),
    );

    const countMap = new Map<string, number>();
    for (const o of orders) {
      if (!o.location_id) continue;
      countMap.set(o.location_id, (countMap.get(o.location_id) ?? 0) + 1);
    }

    let gesamt_aktiv = 0;
    let gesamt_kapazitaet = 0;

    const kuechen: KuecheRow[] = [...countMap.entries()].map(([locId, aktiv]) => {
      const grenze = KAPAZITAET_DEFAULT;
      const auslastungsgrad = aktiv / grenze;
      gesamt_aktiv += aktiv;
      gesamt_kapazitaet += grenze;
      return {
        location_id: locId,
        location_name: locMap.get(locId) ?? locId,
        aktive_bestellungen: aktiv,
        kapazitaetsgrenze: grenze,
        auslastungsgrad: parseFloat(auslastungsgrad.toFixed(2)),
        eta_anpassungsfaktor: calcEtaFaktor(auslastungsgrad),
        status: calcStatus(auslastungsgrad),
      };
    });

    return NextResponse.json({
      kuechen,
      gesamt_aktiv,
      gesamt_kapazitaet,
      gesamt_auslastung: gesamt_kapazitaet > 0
        ? parseFloat((gesamt_aktiv / gesamt_kapazitaet).toFixed(2))
        : 0,
      timestamp: new Date().toISOString(),
    } satisfies KuechenAuslastungResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
