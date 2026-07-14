/**
 * GET /api/delivery/public/treue-punkte?location_id=<uuid>&customer_id=<id>
 *
 * Phase 1448 — Treue-Punkte-Abfrage (Storefront)
 * Gibt gesammelte Punkte eines Kunden zurück.
 * Supabase customer_loyalty_points + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUNKTE_FUER_1_EUR_RABATT = 100;

interface TreuePunkteResponse {
  punkte: number;
  rabatt_eur: number;
  naechstes_ziel_punkte: number;
  naechstes_ziel_label: string;
  location_id: string;
  customer_id: string;
  generiert_am: string;
}

function buildResponse(punkte: number, locationId: string, customerId: string): TreuePunkteResponse {
  const rabattEur = Math.floor(punkte / PUNKTE_FUER_1_EUR_RABATT);
  const naechstesZiel = Math.ceil(punkte / PUNKTE_FUER_1_EUR_RABATT + 1) * PUNKTE_FUER_1_EUR_RABATT;
  return {
    punkte,
    rabatt_eur: rabattEur,
    naechstes_ziel_punkte: naechstesZiel,
    naechstes_ziel_label: `${Math.ceil(punkte / PUNKTE_FUER_1_EUR_RABATT + 1)}€ Rabatt`,
    location_id: locationId,
    customer_id: customerId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const customerId = req.nextUrl.searchParams.get('customer_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }
  if (!customerId) {
    return NextResponse.json({ error: 'customer_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const { data, error } = await (sb as any)
      .from('customer_loyalty_points')
      .select('punkte')
      .eq('location_id', locationId)
      .eq('customer_id', customerId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(buildResponse(0, locationId, customerId));
    }

    return NextResponse.json(buildResponse(data.punkte ?? 0, locationId, customerId));
  } catch {
    return NextResponse.json(buildResponse(0, locationId, customerId));
  }
}
