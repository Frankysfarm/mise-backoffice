/**
 * GET /api/delivery/driver/pausen-empfehlung
 *
 * Fahrer-Pausenempfehlung basierend auf aktiver Schichtdauer.
 * Phase 516
 *
 * Query: ?driver_id=<uuid>&location_id=<uuid>   (optional — fallback: auth user)
 * Response: { ok, empfehlung, schichtMinuten }
 *   empfehlung: null | { typ: 'kurz' | 'mittag', title, text, dringlichkeit }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type PausenTyp = 'kurz' | 'mittag';
export type PausenDringlichkeit = 'hinweis' | 'warnung' | 'kritisch';

export interface PausenEmpfehlung {
  typ: PausenTyp;
  title: string;
  text: string;
  dringlichkeit: PausenDringlichkeit;
  schichtMinuten: number;
}

export interface PausenEmpfehlungResponse {
  ok: boolean;
  empfehlung: PausenEmpfehlung | null;
  schichtMinuten: number;
}

function buildEmpfehlung(schichtMinuten: number): PausenEmpfehlung | null {
  if (schichtMinuten >= 360) {
    return {
      typ: 'mittag',
      title: 'Mittagspause empfohlen',
      text: `Du bist seit ${Math.round(schichtMinuten / 60)}h im Einsatz. Gönn dir eine längere Pause (15–30 Min.).`,
      dringlichkeit: schichtMinuten >= 420 ? 'kritisch' : 'warnung',
      schichtMinuten,
    };
  }
  if (schichtMinuten >= 180) {
    return {
      typ: 'kurz',
      title: 'Kurze Pause empfohlen',
      text: `Nach ${Math.round(schichtMinuten / 60)}h Schicht empfehlen wir 5–10 Min. Pause für frische Energie.`,
      dringlichkeit: schichtMinuten >= 270 ? 'warnung' : 'hinweis',
      schichtMinuten,
    };
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryDriverId = searchParams.get('driver_id');

    const svc = createServiceClient();
    let driverId = queryDriverId;

    // Falls kein driver_id übergeben: aus Auth ableiten
    if (!driverId) {
      const sb = await createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

      const { data: emp } = await svc
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!emp) return NextResponse.json({ error: 'Kein Fahrer-Profil' }, { status: 404 });
      driverId = (emp as { id: string }).id;
    }

    // Aktive Schicht suchen
    const { data: shift } = await svc
      .from('driver_shifts')
      .select('id, actual_start, started_at')
      .eq('driver_id', driverId)
      .eq('status', 'active')
      .order('actual_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!shift) {
      return NextResponse.json<PausenEmpfehlungResponse>({ ok: true, empfehlung: null, schichtMinuten: 0 });
    }

    const shiftRow = shift as { id: string; actual_start: string | null; started_at: string | null };
    const startTime = shiftRow.actual_start ?? shiftRow.started_at;
    const schichtMinuten = startTime
      ? Math.round((Date.now() - new Date(startTime).getTime()) / 60_000)
      : 0;

    const empfehlung = buildEmpfehlung(schichtMinuten);

    return NextResponse.json<PausenEmpfehlungResponse>({ ok: true, empfehlung, schichtMinuten });
  } catch (err) {
    console.error('[pausen-empfehlung]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
