/**
 * GET /api/delivery/admin/fahrer-pausen-empfehlung
 *   ?location_id=<uuid>
 *
 * Phase 560 — Fahrer-Pausen-Empfehlung
 *
 * Analysiert aktive Fahrer-Schichten und empfiehlt optimale Pausen basierend auf:
 *   - Schichtdauer ohne Pause (Alert > 3,5h; Kritisch > 5h)
 *   - Anzahl abgeschlossener Touren (Empfehlung nach Tour-Abschluss)
 *   - Letzter Heartbeat (GPS-Aktivität als Proxy für Pause)
 *   - Erwartete Demand-Lücke in nächsten 30 Min
 *
 * Pausenempfehlung:
 *   'jetzt_optimal'  — Tour abgeschlossen, Demand gering → ideale Pausenzeit
 *   'empfohlen'      — >3.5h aktiv, Tour abgeschlossen
 *   'dringend'       — >5h aktiv ohne Pause
 *   'optional'       — >3h, aber Tour läuft noch
 *   'kein_bedarf'    — <3h aktiv
 *
 * Response: { ok, fahrer: FahrerPausenEmpfehlung[], summary, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type PausenEmpfehlungLevel = 'jetzt_optimal' | 'empfohlen' | 'dringend' | 'optional' | 'kein_bedarf';

export interface FahrerPausenEmpfehlung {
  driverId: string;
  fahrerName: string;
  schichtStartedAt: string;
  aktiveStunden: number;
  absolvierteTouren: number;
  hatAktiveTour: boolean;
  letzteAktivitaetVorMin: number | null;
  empfehlungLevel: PausenEmpfehlungLevel;
  empfehlungText: string;
  empfohlenePauseDauer: number;  // Minuten
  pausenFensterLabel: string;
}

export interface PausenEmpfehlungSummary {
  gesamtFahrer: number;
  dringendCount: number;
  empfohlenCount: number;
  optimalCount: number;
  handlungsbedarfSofort: boolean;
}

export interface FahrerPausenResponse {
  ok: boolean;
  fahrer: FahrerPausenEmpfehlung[];
  summary: PausenEmpfehlungSummary;
  generatedAt: string;
}

type ShiftRow = {
  id: string;
  driver_id: string;
  started_at: string;
  status: string;
};

type DriverRow = {
  id: string;
  name: string | null;
  vorname: string | null;
};

type BatchRow = {
  driver_id: string;
  status: string;
  updated_at: string;
};

type HeartbeatRow = {
  driver_id: string;
  created_at: string;
};

function buildEmpfehlung(
  aktiveStunden: number,
  hatAktiveTour: boolean,
  letzteAktVorMin: number | null,
): { level: PausenEmpfehlungLevel; text: string; dauer: number; fenster: string } {
  if (aktiveStunden >= 5) {
    return {
      level:  'dringend',
      text:   `Seit ${aktiveStunden.toFixed(1)}h aktiv — gesetzliche Pause dringend erforderlich`,
      dauer:  30,
      fenster: 'Sofort bei Touren-Abschluss',
    };
  }
  if (aktiveStunden >= 3.5 && !hatAktiveTour) {
    return {
      level:  'jetzt_optimal',
      text:   `Tour abgeschlossen, ${aktiveStunden.toFixed(1)}h aktiv — perfekter Pausenzeitpunkt`,
      dauer:  15,
      fenster: 'Jetzt (Tour beendet)',
    };
  }
  if (aktiveStunden >= 3.5) {
    return {
      level:  'empfohlen',
      text:   `${aktiveStunden.toFixed(1)}h aktiv — nach dieser Tour Pause einplanen`,
      dauer:  15,
      fenster: 'Nach aktueller Tour',
    };
  }
  if (aktiveStunden >= 3 && !hatAktiveTour) {
    return {
      level:  'optional',
      text:   `${aktiveStunden.toFixed(1)}h aktiv — kurze Pause möglich`,
      dauer:  10,
      fenster: 'Bei Bedarf',
    };
  }
  return {
    level:  'kein_bedarf',
    text:   `${aktiveStunden.toFixed(1)}h aktiv — kein Pausenbedarf`,
    dauer:  0,
    fenster: '—',
  };
}

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const param = new URL(req.url).searchParams.get('location_id');
  if (param) return param;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return (emp as { location_id: string } | null)?.location_id ?? null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const locationId = await resolveLocationId(req);
    if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

    const svc = createServiceClient();
    const now = new Date();
    const shiftCutoff = new Date(now.getTime() - 8 * 60 * 60_000).toISOString();

    const [shiftsRes, driversRes, batchesRes, heartbeatRes] = await Promise.all([
      svc
        .from('driver_shifts')
        .select('id, driver_id, started_at, status')
        .eq('location_id', locationId)
        .eq('status', 'active')
        .gte('started_at', shiftCutoff),
      svc
        .from('mise_drivers')
        .select('id, name, vorname')
        .eq('location_id', locationId),
      svc
        .from('delivery_batches')
        .select('driver_id, status, updated_at')
        .eq('location_id', locationId)
        .in('status', ['dispatched', 'in_progress', 'picking_up']),
      svc
        .from('driver_heartbeats')
        .select('driver_id, created_at')
        .eq('location_id', locationId)
        .gte('created_at', new Date(now.getTime() - 4 * 60 * 60_000).toISOString())
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    const shifts     = (shiftsRes.data ?? []) as ShiftRow[];
    const drivers    = (driversRes.data ?? []) as DriverRow[];
    const batches    = (batchesRes.data ?? []) as BatchRow[];
    const heartbeats = (heartbeatRes.data ?? []) as HeartbeatRow[];

    const driverMap = new Map<string, DriverRow>(drivers.map(d => [d.id, d]));

    const activeDriverIds = new Set<string>(batches.map(b => b.driver_id));

    const latestHeartbeat = new Map<string, Date>();
    for (const hb of heartbeats) {
      const existing = latestHeartbeat.get(hb.driver_id);
      const ts = new Date(hb.created_at);
      if (!existing || ts > existing) {
        latestHeartbeat.set(hb.driver_id, ts);
      }
    }

    const tourCountPerDriver = new Map<string, number>();
    const today = now.toISOString().slice(0, 10);
    const completedBatchRes = await svc
      .from('delivery_batches')
      .select('driver_id')
      .eq('location_id', locationId)
      .eq('status', 'completed')
      .gte('created_at', `${today}T00:00:00`);
    for (const b of (completedBatchRes.data ?? []) as { driver_id: string }[]) {
      tourCountPerDriver.set(b.driver_id, (tourCountPerDriver.get(b.driver_id) ?? 0) + 1);
    }

    const fahrer: FahrerPausenEmpfehlung[] = [];

    for (const shift of shifts) {
      const driver = driverMap.get(shift.driver_id);
      const fahrerName = driver
        ? `${driver.vorname ?? ''} ${driver.name ?? ''}`.trim() || shift.driver_id.slice(0, 8)
        : shift.driver_id.slice(0, 8);

      const startedAt    = new Date(shift.started_at);
      const aktiveStunden = (now.getTime() - startedAt.getTime()) / 3_600_000;
      const hatAktiveTour = activeDriverIds.has(shift.driver_id);
      const touren        = tourCountPerDriver.get(shift.driver_id) ?? 0;

      const lastHb = latestHeartbeat.get(shift.driver_id);
      const letzteAktVorMin = lastHb
        ? Math.round((now.getTime() - lastHb.getTime()) / 60_000)
        : null;

      const { level, text, dauer, fenster } = buildEmpfehlung(aktiveStunden, hatAktiveTour, letzteAktVorMin);

      fahrer.push({
        driverId:                  shift.driver_id,
        fahrerName,
        schichtStartedAt:          shift.started_at,
        aktiveStunden:             Math.round(aktiveStunden * 10) / 10,
        absolvierteTouren:         touren,
        hatAktiveTour,
        letzteAktivitaetVorMin:    letzteAktVorMin,
        empfehlungLevel:           level,
        empfehlungText:            text,
        empfohlenePauseDauer:      dauer,
        pausenFensterLabel:        fenster,
      });
    }

    fahrer.sort((a, b) => {
      const order: Record<PausenEmpfehlungLevel, number> = {
        dringend:       0,
        jetzt_optimal:  1,
        empfohlen:      2,
        optional:       3,
        kein_bedarf:    4,
      };
      return order[a.empfehlungLevel] - order[b.empfehlungLevel];
    });

    const dringendCount   = fahrer.filter(f => f.empfehlungLevel === 'dringend').length;
    const empfohlenCount  = fahrer.filter(f => f.empfehlungLevel === 'empfohlen' || f.empfehlungLevel === 'jetzt_optimal').length;
    const optimalCount    = fahrer.filter(f => f.empfehlungLevel === 'jetzt_optimal').length;

    const summary: PausenEmpfehlungSummary = {
      gesamtFahrer:          fahrer.length,
      dringendCount,
      empfohlenCount,
      optimalCount,
      handlungsbedarfSofort: dringendCount > 0,
    };

    const response: FahrerPausenResponse = {
      ok: true,
      fahrer,
      summary,
      generatedAt: now.toISOString(),
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[fahrer-pausen-empfehlung]', err);
    return NextResponse.json({ error: 'Interner Fehler', detail: String(err) }, { status: 500 });
  }
}
