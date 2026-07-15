/**
 * GET /api/delivery/public/oeffnungszeiten?location_id=<uuid>
 *
 * Phase 1785 — Lieferdienst-Öffnungszeiten-API (Public)
 * Liefert ob Lieferung aktuell möglich + nächster verfügbarer Slot.
 * Liest delivery_config (oeffnungszeiten-JSON) aus Supabase; Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OeffnungszeitenAntwort {
  ist_geoeffnet: boolean;
  naechster_slot: string | null;
  naechster_slot_label: string | null;
  nachricht: string;
  schliesst_um: string | null;
  oeffnet_naechstes_mal_um: string | null;
}

interface TagsZeiten {
  oeffnung: number; // Stunde, z.B. 11
  schliessung: number; // Stunde, z.B. 22
}

const DEFAULT_ZEITEN: TagsZeiten = { oeffnung: 11, schliessung: 22 };

function buildAntwort(now: Date, zeiten: TagsZeiten): OeffnungszeitenAntwort {
  const h = now.getHours() + now.getMinutes() / 60;
  const { oeffnung, schliessung } = zeiten;
  const ist_geoeffnet = h >= oeffnung && h < schliessung;

  const pad = (n: number) => String(Math.floor(n)).padStart(2, '0') + ':00';

  if (ist_geoeffnet) {
    return {
      ist_geoeffnet: true,
      naechster_slot: null,
      naechster_slot_label: null,
      nachricht: `Lieferung möglich bis ${pad(schliessung)} Uhr`,
      schliesst_um: pad(schliessung),
      oeffnet_naechstes_mal_um: null,
    };
  }

  const morgenOeffnung = pad(oeffnung);
  const istVorOeffnung = h < oeffnung;
  const naechster_slot_label = istVorOeffnung
    ? `Heute ab ${morgenOeffnung} Uhr`
    : `Morgen ab ${morgenOeffnung} Uhr`;

  return {
    ist_geoeffnet: false,
    naechster_slot: morgenOeffnung,
    naechster_slot_label,
    nachricht: 'Lieferung aktuell nicht möglich — Bestellung für später aufgeben',
    schliesst_um: null,
    oeffnet_naechstes_mal_um: morgenOeffnung,
  };
}

function buildMock(locationId: string): OeffnungszeitenAntwort {
  return buildAntwort(new Date(), DEFAULT_ZEITEN);
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? '';

  try {
    const sb = await createClient();
    const now = new Date();

    // Öffnungszeiten aus delivery_config lesen
    let q = (sb as any)
      .from('delivery_config')
      .select('value')
      .eq('key', 'oeffnungszeiten');
    if (locationId) q = q.eq('location_id', locationId);
    const { data, error } = await q.maybeSingle();

    let zeiten = DEFAULT_ZEITEN;
    if (!error && data?.value) {
      try {
        const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        if (typeof parsed.oeffnung === 'number' && typeof parsed.schliessung === 'number') {
          zeiten = parsed as TagsZeiten;
        }
      } catch {}
    }

    return NextResponse.json(buildAntwort(now, zeiten));
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
