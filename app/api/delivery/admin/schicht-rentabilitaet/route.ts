/**
 * GET /api/delivery/admin/schicht-rentabilitaet
 *   ?location_id=<uuid>
 *
 * Echtzeitberechnung: Umsatz − Fahrerkosten − Fixkosten je Schicht.
 * Gibt alle heutigen Schichten mit Einzel-Rentabilität zurück.
 *
 * Phase 552
 *
 * Response: { ok, shifts: ShiftRentabilitaet[], summary: RentabilitaetSummary, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STUNDEN_LOHN   = 13.50;   // € / h
const PLATTFORM_FEE  = 0.80;    // € / Bestellung
const FIXKOSTEN_H    = 2.50;    // € / Schicht-h (Versicherung, Wartung, anteilig)

export interface ShiftRentabilitaet {
  shiftId: string;
  driverId: string;
  fahrerName: string;
  status: 'active' | 'completed' | 'planned';
  startedAt: string;
  endedAt: string | null;
  schichtStunden: number;
  bestellungen: number;
  umsatz: number;
  liefergebuehren: number;
  fahrerLohn: number;
  fixKosten: number;
  plattformKosten: number;
  gesamtKosten: number;
  gewinn: number;
  gewinnPct: number;
  gewinnProBestellung: number;
  rentabel: boolean;
  breakEvenBestellungen: number;
}

export interface RentabilitaetSummary {
  totalShifts: number;
  activeShifts: number;
  rentableShifts: number;
  gesamtUmsatz: number;
  gesamtKosten: number;
  gesamtGewinn: number;
  durchschnittGewinnPct: number;
  warningLevel: 'ok' | 'niedrig' | 'kritisch';
}

export interface SchichtRentabilitaetResponse {
  ok: boolean;
  shifts: ShiftRentabilitaet[];
  summary: RentabilitaetSummary;
  generatedAt: string;
}

type ShiftRow = {
  id: string;
  driver_id: string;
  status: string;
  actual_start: string | null;
  actual_end: string | null;
  planned_start: string;
  planned_end: string;
};

type DriverRow = { id: string; vorname: string; nachname: string };

type OrderRow = {
  gesamtbetrag: number | null;
  liefergebuehr: number | null;
  driver_id: string | null;
};

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
    const todayStr = now.toISOString().slice(0, 10);
    const dayStart = `${todayStr}T00:00:00.000Z`;
    const dayEnd   = `${todayStr}T23:59:59.999Z`;

    const [{ data: rawShifts }, { data: rawDrivers }, { data: rawOrders }] = await Promise.all([
      svc.from('driver_shifts')
        .select('id, driver_id, status, actual_start, actual_end, planned_start, planned_end')
        .eq('location_id', locationId)
        .in('status', ['active', 'completed', 'planned'])
        .gte('planned_start', dayStart)
        .lt('planned_start', dayEnd),

      svc.from('drivers')
        .select('id, vorname, nachname')
        .eq('location_id', locationId),

      svc.from('customer_orders')
        .select('gesamtbetrag, liefergebuehr, driver_id')
        .eq('location_id', locationId)
        .neq('status', 'storniert')
        .gte('created_at', dayStart)
        .lt('created_at', dayEnd),
    ]);

    const shifts  = (rawShifts  ?? []) as ShiftRow[];
    const drivers = (rawDrivers ?? []) as DriverRow[];
    const orders  = (rawOrders  ?? []) as OrderRow[];

    const driverMap = new Map<string, DriverRow>(drivers.map(d => [d.id, d]));

    const nowMs = now.getTime();

    const shiftResults: ShiftRentabilitaet[] = shifts.map(s => {
      const startStr  = s.actual_start  ?? s.planned_start;
      const endStr    = s.actual_end    ?? (s.status === 'active' ? now.toISOString() : s.planned_end);
      const startMs   = new Date(startStr).getTime();
      const endMs     = new Date(endStr).getTime();
      const schichtH  = Math.max(0, Math.min((endMs - startMs) / 3_600_000, 12));

      const driverOrders = orders.filter(o => o.driver_id === s.driver_id);
      const bestellungen = driverOrders.length;
      const umsatz       = driverOrders.reduce((a, o) => a + Math.max(0, Number(o.gesamtbetrag ?? 0)), 0);
      const liefergebH   = driverOrders.reduce((a, o) => a + Math.max(0, Number(o.liefergebuehr ?? 0)), 0);

      const fahrerLohn      = schichtH * STUNDEN_LOHN;
      const fixKosten       = schichtH * FIXKOSTEN_H;
      const plattformKosten = bestellungen * PLATTFORM_FEE;
      const gesamtKosten    = fahrerLohn + fixKosten + plattformKosten;
      const gewinn          = liefergebH - gesamtKosten;
      const gewinnPct       = liefergebH > 0 ? gewinn / liefergebH : 0;
      const gewinnProBestell = bestellungen > 0 ? gewinn / bestellungen : 0;
      const breakEven       = (PLATTFORM_FEE > 0 || liefergebH > 0)
        ? Math.ceil(gesamtKosten / Math.max(0.01, liefergebH / Math.max(1, bestellungen)))
        : 0;

      const drv = driverMap.get(s.driver_id);
      const fahrerName = drv ? `${drv.vorname} ${drv.nachname}` : s.driver_id.slice(0, 8);

      return {
        shiftId: s.id,
        driverId: s.driver_id,
        fahrerName,
        status: s.status as ShiftRentabilitaet['status'],
        startedAt: startStr,
        endedAt: s.actual_end ?? null,
        schichtStunden: Math.round(schichtH * 10) / 10,
        bestellungen,
        umsatz:             Math.round(umsatz           * 100) / 100,
        liefergebuehren:    Math.round(liefergebH       * 100) / 100,
        fahrerLohn:         Math.round(fahrerLohn        * 100) / 100,
        fixKosten:          Math.round(fixKosten         * 100) / 100,
        plattformKosten:    Math.round(plattformKosten   * 100) / 100,
        gesamtKosten:       Math.round(gesamtKosten      * 100) / 100,
        gewinn:             Math.round(gewinn            * 100) / 100,
        gewinnPct:          Math.round(gewinnPct         * 10000) / 10000,
        gewinnProBestellung: Math.round(gewinnProBestell * 100) / 100,
        rentabel: gewinn >= 0,
        breakEvenBestellungen: breakEven,
      };
    });

    // Summary
    const activeShifts   = shiftResults.filter(s => s.status === 'active').length;
    const rentableShifts = shiftResults.filter(s => s.rentabel).length;
    const gesamtUmsatz   = shiftResults.reduce((a, s) => a + s.umsatz, 0);
    const gesamtKosten   = shiftResults.reduce((a, s) => a + s.gesamtKosten, 0);
    const gesamtGewinn   = shiftResults.reduce((a, s) => a + s.gewinn, 0);
    const avgGewinnPct   = shiftResults.length > 0
      ? shiftResults.reduce((a, s) => a + s.gewinnPct, 0) / shiftResults.length
      : 0;

    const warningLevel: RentabilitaetSummary['warningLevel'] =
      avgGewinnPct < -0.1 ? 'kritisch' :
      avgGewinnPct < 0.05 ? 'niedrig'  : 'ok';

    const summary: RentabilitaetSummary = {
      totalShifts: shiftResults.length,
      activeShifts,
      rentableShifts,
      gesamtUmsatz:      Math.round(gesamtUmsatz  * 100) / 100,
      gesamtKosten:      Math.round(gesamtKosten  * 100) / 100,
      gesamtGewinn:      Math.round(gesamtGewinn  * 100) / 100,
      durchschnittGewinnPct: Math.round(avgGewinnPct * 10000) / 10000,
      warningLevel,
    };

    const response: SchichtRentabilitaetResponse = {
      ok: true,
      shifts: shiftResults,
      summary,
      generatedAt: now.toISOString(),
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('[schicht-rentabilitaet]', err);
    return NextResponse.json({ ok: false, error: 'Interner Fehler' }, { status: 500 });
  }
}
