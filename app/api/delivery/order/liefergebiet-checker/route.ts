import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ApiResponse = {
  lieferbar: boolean;
  plz: string;
  zone: 'A' | 'B' | 'C' | 'D' | null;
  eta_min: number | null;
  mindestbestellwert_eur: number | null;
  lieferkosten_eur: number | null;
  grund: string | null;
};

// PLZ prefix → zone mapping (simplified Germany logic)
function inferZone(plz: string): 'A' | 'B' | 'C' | 'D' | null {
  const n = parseInt(plz.slice(0, 2), 10);
  if (isNaN(n)) return null;
  if (n <= 20) return 'A';
  if (n <= 40) return 'B';
  if (n <= 60) return 'C';
  if (n <= 80) return 'D';
  return null;
}

const ZONE_ETA: Record<string, number> = { A: 20, B: 30, C: 40, D: 50 };
const ZONE_MBW: Record<string, number> = { A: 10, B: 15, C: 15, D: 20 };
const ZONE_LK: Record<string, number> = { A: 0, B: 1.5, C: 2.5, D: 3.5 };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const plz = (searchParams.get('plz') ?? '').trim().replace(/\s/g, '');
  const locationId = searchParams.get('location_id');

  if (!/^\d{5}$/.test(plz)) {
    return NextResponse.json({ lieferbar: false, plz, zone: null, eta_min: null, mindestbestellwert_eur: null, lieferkosten_eur: null, grund: 'Ungültige PLZ' });
  }

  try {
    const supabase = await createClient();
    const q = supabase
      .from('delivery_zones')
      .select('id, zone_label, plz_list, eta_min, mindestbestellwert_eur, lieferkosten_eur, aktiv')
      .eq('aktiv', true);
    if (locationId) q.eq('location_id', locationId);
    const { data: zones } = await q;

    if (zones && zones.length > 0) {
      const match = zones.find((z) => Array.isArray(z.plz_list) && z.plz_list.includes(plz));
      if (match) {
        return NextResponse.json({
          lieferbar: true,
          plz,
          zone: match.zone_label ?? null,
          eta_min: match.eta_min ?? null,
          mindestbestellwert_eur: match.mindestbestellwert_eur ?? null,
          lieferkosten_eur: match.lieferkosten_eur ?? null,
          grund: null,
        } satisfies ApiResponse);
      }
      return NextResponse.json({ lieferbar: false, plz, zone: null, eta_min: null, mindestbestellwert_eur: null, lieferkosten_eur: null, grund: 'PLZ liegt nicht im Liefergebiet' } satisfies ApiResponse);
    }

    // Fallback: infer from PLZ prefix
    const zone = inferZone(plz);
    if (!zone) {
      return NextResponse.json({ lieferbar: false, plz, zone: null, eta_min: null, mindestbestellwert_eur: null, lieferkosten_eur: null, grund: 'PLZ liegt nicht im Liefergebiet' });
    }
    return NextResponse.json({
      lieferbar: true,
      plz,
      zone,
      eta_min: ZONE_ETA[zone],
      mindestbestellwert_eur: ZONE_MBW[zone],
      lieferkosten_eur: ZONE_LK[zone],
      grund: null,
    });
  } catch {
    const zone = inferZone(plz);
    if (!zone) {
      return NextResponse.json({ lieferbar: false, plz, zone: null, eta_min: null, mindestbestellwert_eur: null, lieferkosten_eur: null, grund: 'PLZ liegt nicht im Liefergebiet' });
    }
    return NextResponse.json({
      lieferbar: true,
      plz,
      zone,
      eta_min: ZONE_ETA[zone],
      mindestbestellwert_eur: ZONE_MBW[zone],
      lieferkosten_eur: ZONE_LK[zone],
      grund: null,
    });
  }
}
