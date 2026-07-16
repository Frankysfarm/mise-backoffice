/**
 * GET /api/delivery/admin/fahrer-verfuegbarkeits-forecast?location_id=<uuid>
 *
 * Phase 2007 — Fahrer-Verfügbarkeits-Forecast-API
 * Erwartete Fahrerverfügbarkeit für die nächsten 4 Stunden je Stundenschlitz;
 * Ampel; Alert wenn <2 Fahrer erwartet; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

interface StundenSlot {
  stunde: string; // HH:MM
  stunde_utc: string;
  erwartete_fahrer: number;
  ampel: Ampel;
  alert: boolean;
  fahrer_namen: string[];
}

interface FahrerVerfuegbarkeitsForecastResponse {
  location_id: string;
  slots: StundenSlot[];
  engpass_count: number;
  generiert_am: string;
}

function ampelOf(n: number): Ampel {
  if (n >= 3) return 'gruen';
  if (n === 2) return 'gelb';
  return 'rot';
}

function stundeDE(date: Date): string {
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
}

const MOCK: FahrerVerfuegbarkeitsForecastResponse = {
  location_id: 'mock',
  slots: [
    { stunde: '14:00', stunde_utc: '', erwartete_fahrer: 4, ampel: 'gruen', alert: false, fahrer_namen: ['Max', 'Lisa', 'Tom', 'Anna'] },
    { stunde: '15:00', stunde_utc: '', erwartete_fahrer: 3, ampel: 'gruen', alert: false, fahrer_namen: ['Max', 'Lisa', 'Tom'] },
    { stunde: '16:00', stunde_utc: '', erwartete_fahrer: 2, ampel: 'gelb',  alert: false, fahrer_namen: ['Lisa', 'Tom'] },
    { stunde: '17:00', stunde_utc: '', erwartete_fahrer: 1, ampel: 'rot',   alert: true,  fahrer_namen: ['Lisa'] },
  ],
  engpass_count: 1,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  try {
    const sb = await createClient();
    const jetzt = new Date();

    const { data: fahrerRows, error: fahrerFehler } = await sb
      .from('delivery_drivers')
      .select('id, name, shift_start, shift_end')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (fahrerFehler || !fahrerRows?.length) {
      return NextResponse.json({ ...MOCK, location_id: locationId });
    }

    const slots: StundenSlot[] = [];
    for (let h = 0; h < 4; h++) {
      const slotStart = new Date(jetzt.getTime() + h * 60 * 60 * 1000);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
      const slotMitte = new Date(slotStart.getTime() + 30 * 60 * 1000);
      const mitteMin = slotMitte.getUTCHours() * 60 + slotMitte.getUTCMinutes();

      const verfuegbar = fahrerRows.filter((f) => {
        if (!f.shift_start || !f.shift_end) return true;
        const [sh, sm] = (f.shift_start as string).split(':').map(Number);
        const [eh, em] = (f.shift_end as string).split(':').map(Number);
        const start = sh * 60 + sm;
        const end = eh * 60 + em;
        if (start <= end) return mitteMin >= start && mitteMin < end;
        return mitteMin >= start || mitteMin < end;
      });

      const n = verfuegbar.length;
      slots.push({
        stunde: stundeDE(slotStart),
        stunde_utc: slotStart.toISOString(),
        erwartete_fahrer: n,
        ampel: ampelOf(n),
        alert: n < 2,
        fahrer_namen: verfuegbar.map((f) => f.name ?? 'Unbekannt'),
      });
    }

    const response: FahrerVerfuegbarkeitsForecastResponse = {
      location_id: locationId,
      slots,
      engpass_count: slots.filter((s) => s.alert).length,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
