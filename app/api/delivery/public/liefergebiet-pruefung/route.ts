/**
 * GET /api/delivery/public/liefergebiet-pruefung?location_id=<uuid>&plz=<string>
 *
 * Phase 1506 supporting API — Liefergebiet-Prüfung
 * Live-Check ob PLZ im Liefergebiet liegt; Zone + ETA + Alternativen.
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface LiefergebietPruefResult {
  plz: string;
  status: 'lieferbar' | 'alternatives' | 'nicht_lieferbar';
  zone: string | null;
  eta_min: number | null;
  alternativen: string[] | null;
  hinweis: string | null;
}

function buildMock(plz: string): LiefergebietPruefResult {
  const digit = parseInt(plz[0] ?? '5', 10);
  if (digit <= 3) {
    return { plz, status: 'lieferbar', zone: 'A', eta_min: 25, alternativen: null, hinweis: null };
  }
  if (digit <= 6) {
    return {
      plz, status: 'alternatives', zone: 'C', eta_min: 45,
      alternativen: ['12345', '12346'],
      hinweis: 'Grenzbereich — längere Lieferzeit möglich.',
    };
  }
  return {
    plz, status: 'nicht_lieferbar', zone: null, eta_min: null,
    alternativen: ['12100', '12200'],
    hinweis: 'Leider außerhalb des Liefergebiets.',
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const plz = req.nextUrl.searchParams.get('plz')?.replace(/\s/g, '') ?? '';

  if (!locationId || plz.length < 4) {
    return NextResponse.json({ error: 'location_id and plz required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    type ZoneRow = {
      zone_name?: string;
      zone_label?: string;
      plz_list?: string[];
      plz_prefixes?: string[];
      eta_min?: number;
      status?: string;
    };

    const { data: zones } = await (sb as any)
      .from('delivery_zones')
      .select('zone_name, zone_label, plz_list, plz_prefixes, eta_min, status')
      .eq('location_id', locationId)
      .eq('aktiv', true);

    if (!zones || (zones as unknown[]).length === 0) {
      return NextResponse.json({ ...buildMock(plz), plz });
    }

    let matchedZone: ZoneRow | null = null;
    for (const z of zones as ZoneRow[]) {
      if (z.plz_list && Array.isArray(z.plz_list) && z.plz_list.includes(plz)) {
        matchedZone = z;
        break;
      }
      if (z.plz_prefixes && Array.isArray(z.plz_prefixes)) {
        for (const prefix of z.plz_prefixes) {
          if (plz.startsWith(prefix)) {
            matchedZone = z;
            break;
          }
        }
        if (matchedZone) break;
      }
    }

    if (matchedZone) {
      const result: LiefergebietPruefResult = {
        plz,
        status: 'lieferbar',
        zone: matchedZone.zone_label ?? matchedZone.zone_name ?? null,
        eta_min: matchedZone.eta_min ?? null,
        alternativen: null,
        hinweis: null,
      };
      return NextResponse.json(result);
    }

    const { data: allPlz } = await (sb as any)
      .from('delivery_zones')
      .select('plz_list')
      .eq('location_id', locationId)
      .eq('aktiv', true);

    type PlzRow = { plz_list?: string[] };
    const allKnownPlz = (allPlz as PlzRow[] ?? [])
      .flatMap(z => z.plz_list ?? [])
      .filter(p => typeof p === 'string');

    const prefix = plz.substring(0, 3);
    const alternatives = allKnownPlz
      .filter(p => p.startsWith(prefix) && p !== plz)
      .slice(0, 3);

    const result: LiefergebietPruefResult = {
      plz,
      status: alternatives.length > 0 ? 'alternatives' : 'nicht_lieferbar',
      zone: null,
      eta_min: null,
      alternativen: alternatives.length > 0 ? alternatives : null,
      hinweis: alternatives.length > 0
        ? 'Grenzbereich — naheliegende PLZ werden beliefert.'
        : 'Leider außerhalb des Liefergebiets.',
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ...buildMock(plz), plz });
  }
}
