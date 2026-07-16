import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Phase 1841 — Schicht-Kapazitäts-Ampel-API
 * GET /api/delivery/admin/schicht-kapazitaets-ampel?location_id=<uuid>
 *
 * Liefert Echtzeit-Kapazitätsstatus:
 * - freie_fahrer, aktive_touren, wartende_bestellungen
 * - Ampel: gruen / gelb / rot
 * Multi-Tenant; Supabase + Mock-Fallback.
 */

type AmpelStatus = 'gruen' | 'gelb' | 'rot';

interface KapazitaetsAntwort {
  status: AmpelStatus;
  freie_fahrer: number;
  aktive_fahrer: number;
  aktive_touren: number;
  wartende_bestellungen: number;
  auslastungs_prozent: number;
  empfehlung: string;
  location_id: string;
  generiert_am: string;
}

function berechneAmpel(freie: number, wartend: number, gesamt: number): AmpelStatus {
  if (gesamt === 0) return 'gruen';
  const auslastung = (gesamt - freie) / gesamt;
  if (auslastung >= 0.9 || wartend > 3) return 'rot';
  if (auslastung >= 0.65 || wartend > 1) return 'gelb';
  return 'gruen';
}

const MOCK: KapazitaetsAntwort = {
  status: 'gelb',
  freie_fahrer: 1,
  aktive_fahrer: 3,
  aktive_touren: 3,
  wartende_bestellungen: 2,
  auslastungs_prozent: 75,
  empfehlung: 'Auslastung erhöht — optionaler Fahrer empfohlen',
  location_id: 'mock',
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const [{ data: fahrer }, { data: touren }, { data: wartend }] = await Promise.all([
      sb
        .from('employees')
        .select('id, is_available')
        .eq('location_id', locationId)
        .eq('role', 'driver')
        .eq('is_active', true),
      sb
        .from('delivery_batches')
        .select('id')
        .eq('location_id', locationId)
        .in('status', ['assigned', 'in_progress']),
      sb
        .from('orders')
        .select('id')
        .eq('location_id', locationId)
        .eq('status', 'ready_for_pickup'),
    ]);

    const gesamt = fahrer?.length ?? 0;
    const freieFahrer = fahrer?.filter((f) => f.is_available).length ?? 0;
    const aktiveFahrer = gesamt - freieFahrer;
    const aktiveTouren = touren?.length ?? 0;
    const wartendeBest = wartend?.length ?? 0;

    const auslastung = gesamt > 0 ? Math.round(((gesamt - freieFahrer) / gesamt) * 100) : 0;
    const ampel = berechneAmpel(freieFahrer, wartendeBest, gesamt);

    const empfehlung =
      ampel === 'rot'
        ? 'Überlastet — sofort weiteren Fahrer einplanen'
        : ampel === 'gelb'
        ? 'Auslastung erhöht — optionaler Fahrer empfohlen'
        : 'Kapazität ausreichend';

    const body: KapazitaetsAntwort = {
      status: ampel,
      freie_fahrer: freieFahrer,
      aktive_fahrer: aktiveFahrer,
      aktive_touren: aktiveTouren,
      wartende_bestellungen: wartendeBest,
      auslastungs_prozent: auslastung,
      empfehlung,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
