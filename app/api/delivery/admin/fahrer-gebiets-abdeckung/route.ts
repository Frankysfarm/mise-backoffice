/**
 * GET /api/delivery/admin/fahrer-gebiets-abdeckung?location_id=<uuid>
 *
 * Phase 1898 — Fahrer-Gebiets-Abdeckungs-API
 * Welche Zonen A/B/C/D aktuell abgedeckt vs. unbesetzt; Lücken-Flag;
 * Fahrer-je-Zone-Count. Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ZonenAbdeckung {
  zone: string;
  fahrer_count: number;
  fahrer_namen: string[];
  abgedeckt: boolean;
  luecke: boolean;
}

interface ApiAntwort {
  location_id: string;
  zonen: ZonenAbdeckung[];
  luecken_gesamt: number;
  empfehlung: string | null;
  generiert_am: string;
}

const MOCK: ApiAntwort = {
  location_id: 'mock',
  zonen: [
    { zone: 'A', fahrer_count: 2, fahrer_namen: ['Max M.', 'Sara K.'], abgedeckt: true, luecke: false },
    { zone: 'B', fahrer_count: 1, fahrer_namen: ['Ana P.'], abgedeckt: true, luecke: false },
    { zone: 'C', fahrer_count: 0, fahrer_namen: [], abgedeckt: false, luecke: true },
    { zone: 'D', fahrer_count: 0, fahrer_namen: [], abgedeckt: false, luecke: true },
  ],
  luecken_gesamt: 2,
  empfehlung: 'Zonen C und D unbesetzt — Fahrer zuweisen oder Liefergebiet temporär einschränken.',
  generiert_am: new Date().toISOString(),
};

const ZONES = ['A', 'B', 'C', 'D'] as const;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');

  if (!location_id) {
    return NextResponse.json({ error: 'location_id erforderlich' }, { status: 400 });
  }

  try {
    const supabase = createClient();

    const { data: fahrer, error } = await supabase
      .from('drivers')
      .select('id, name, current_zone, status')
      .eq('location_id', location_id)
      .in('status', ['online', 'on_tour']);

    if (error) throw error;

    const zonenMap = new Map<string, { count: number; namen: string[] }>(
      ZONES.map((z) => [z, { count: 0, namen: [] }]),
    );

    for (const f of fahrer ?? []) {
      const zone = (f.current_zone as string | null)?.toUpperCase() ?? '';
      if (zonenMap.has(zone)) {
        const entry = zonenMap.get(zone)!;
        entry.count += 1;
        entry.namen.push(f.name as string);
      }
    }

    const zonen: ZonenAbdeckung[] = ZONES.map((z) => {
      const entry = zonenMap.get(z)!;
      return {
        zone: z,
        fahrer_count: entry.count,
        fahrer_namen: entry.namen,
        abgedeckt: entry.count > 0,
        luecke: entry.count === 0,
      };
    });

    const luecken = zonen.filter((z) => z.luecke);
    const luecken_gesamt = luecken.length;
    let empfehlung: string | null = null;
    if (luecken_gesamt > 0) {
      const namen = luecken.map((z) => `Zone ${z.zone}`).join(' und ');
      empfehlung =
        luecken_gesamt === 1
          ? `${namen} unbesetzt — Fahrer zuweisen oder Liefergebiet temporär einschränken.`
          : `${namen} unbesetzt — Fahrer zuweisen oder Liefergebiet temporär einschränken.`;
    }

    const antwort: ApiAntwort = {
      location_id,
      zonen,
      luecken_gesamt,
      empfehlung,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(antwort);
  } catch {
    return NextResponse.json({ ...MOCK, location_id }, { status: 200 });
  }
}
