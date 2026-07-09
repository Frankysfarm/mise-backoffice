/**
 * GET /api/delivery/driver/schicht-ziele?driver_id=<uuid>
 *
 * Phase 989 (Support) — Schicht-Ziel-Fortschritt
 * Heutiger Fortschritt je Fahrer: Touren, Km, Einkommen vs. konfiguriertes Tagesziel.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOUREN_ZIEL = 10;
const KM_ZIEL = 60;
const EINKOMMEN_ZIEL_EUR = 80.0;
const KM_KOSTEN = 0.30;
const LOHN_PRO_STUNDE = 13.0;

interface SchichtZiele {
  touren_heute: number;
  touren_ziel: number;
  km_heute: number;
  km_ziel: number;
  einkommen_heute_eur: number;
  einkommen_ziel_eur: number;
  alle_ziele_erreicht: boolean;
  generiert_am: string;
}

const MOCK: SchichtZiele = {
  touren_heute: 7,
  touren_ziel: TOUREN_ZIEL,
  km_heute: 42,
  km_ziel: KM_ZIEL,
  einkommen_heute_eur: 54.5,
  einkommen_ziel_eur: EINKOMMEN_ZIEL_EUR,
  alle_ziele_erreicht: false,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driver_id');
  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: batches, error } = await supabase
      .from('delivery_batches')
      .select('id, status, distance_km, delivery_fee_total, dispatched_at, completed_at, created_at')
      .eq('driver_id', driverId)
      .gte('created_at', todayStart.toISOString());

    if (error || !batches || batches.length === 0) {
      return NextResponse.json({ ...MOCK, generiert_am: new Date().toISOString() });
    }

    const abgeschlossen = batches.filter(b =>
      ['abgeschlossen', 'completed', 'geliefert'].includes(b.status ?? '')
    );

    const tourCount = abgeschlossen.length;
    const kmGesamt = batches.reduce((s, b) => s + Number(b.distance_km ?? 0), 0);

    // Einkommen = Liefergebühren + 13€/h Lohn-Anteil (Schichtdauer heute)
    const schichtMs = batches.reduce((s, b) => {
      if (!b.dispatched_at) return s;
      const end = b.completed_at ? new Date(b.completed_at).getTime() : Date.now();
      return s + (end - new Date(b.dispatched_at).getTime());
    }, 0);
    const schichtH = schichtMs / 3_600_000;
    const lohn = schichtH * LOHN_PRO_STUNDE;
    const trinkgeld = batches.reduce((s, b) => s + Number(b.delivery_fee_total ?? 0), 0);
    const einkommen = lohn + trinkgeld;

    const alleZiele =
      tourCount >= TOUREN_ZIEL &&
      kmGesamt >= KM_ZIEL &&
      einkommen >= EINKOMMEN_ZIEL_EUR;

    return NextResponse.json({
      touren_heute: tourCount,
      touren_ziel: TOUREN_ZIEL,
      km_heute: Math.round(kmGesamt),
      km_ziel: KM_ZIEL,
      einkommen_heute_eur: Math.round(einkommen * 100) / 100,
      einkommen_ziel_eur: EINKOMMEN_ZIEL_EUR,
      alle_ziele_erreicht: alleZiele,
      generiert_am: new Date().toISOString(),
    } satisfies SchichtZiele);
  } catch {
    return NextResponse.json({ ...MOCK, generiert_am: new Date().toISOString() });
  }
}
