/**
 * GET  /api/delivery/driver/selbst-bewertung?driver_id=...&location_id=...
 *      → Heutige Selbstbewertung des Fahrers (falls vorhanden)
 *
 * POST /api/delivery/driver/selbst-bewertung
 *      { driver_id, location_id, sterne, stimmung?, kommentar? }
 *      → Speichert Selbstbewertung (UPSERT für heute)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const driverId   = searchParams.get('driver_id');
    const locationId = searchParams.get('location_id');

    if (!driverId || !locationId) {
      return NextResponse.json({ ok: false, error: 'driver_id and location_id required' }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('fahrer_selbst_bewertungen')
      .select('id, sterne, kommentar, stimmung, schicht_datum, erstellt_am')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .eq('schicht_datum', today)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    if (!data) return NextResponse.json({ ok: true, bewertung: null });

    return NextResponse.json({
      ok: true,
      bewertung: {
        id:           data.id,
        sterne:       data.sterne,
        kommentar:    data.kommentar,
        stimmung:     data.stimmung,
        schichtDatum: data.schicht_datum,
        erstelltAm:   data.erstellt_am,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json() as {
      driver_id:   string;
      location_id: string;
      sterne:      number;
      stimmung?:   string;
      kommentar?:  string;
    };

    const { driver_id, location_id, sterne, stimmung, kommentar } = body;

    if (!driver_id || !location_id || !sterne) {
      return NextResponse.json({ ok: false, error: 'driver_id, location_id and sterne required' }, { status: 400 });
    }
    if (sterne < 1 || sterne > 5) {
      return NextResponse.json({ ok: false, error: 'sterne must be 1-5' }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('fahrer_selbst_bewertungen')
      .upsert(
        {
          driver_id,
          location_id,
          schicht_datum: today,
          sterne,
          stimmung: stimmung ?? null,
          kommentar: kommentar?.trim() || null,
          erstellt_am: new Date().toISOString(),
        },
        { onConflict: 'driver_id,schicht_datum' },
      )
      .select('id, sterne, kommentar, stimmung, schicht_datum, erstellt_am')
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      bewertung: {
        id:           data.id,
        sterne:       data.sterne,
        kommentar:    data.kommentar,
        stimmung:     data.stimmung,
        schichtDatum: data.schicht_datum,
        erstelltAm:   data.erstellt_am,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
