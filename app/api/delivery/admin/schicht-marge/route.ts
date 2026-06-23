/**
 * GET /api/delivery/admin/schicht-marge
 *   ?location_id=<uuid>
 *
 * Live-Analyse der Schicht-Marge für heute:
 *   Fahrlohn (aktive Fahrer × Schichtstunden × 13.50 €/h)
 *   Plattformkosten (0.80 €/Bestellung)
 *   Liefergebühren-Einnahmen
 *   → Netto-Marge, Break-Even, Vorgestern-Vergleich
 *
 * Response: MargenData
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STUNDEN_LOHN = 13.50;     // € pro Stunde
const PLATTFORM_KOSTEN = 0.80;  // € pro Bestellung

interface MargenData {
  schichtStunden: number;
  fahrerAnzahl: number;
  bestellungen: number;
  umsatzGesamt: number;
  liefergebuehrenGesamt: number;
  fahrerLohnGesamt: number;
  plattformKostenGesamt: number;
  nettoMargeGesamt: number;
  kostenProBestellung: number;
  gebuehrenProBestellung: number;
  margeProBestellung: number;
  margePct: number;
  breakEvenBestellungen: number;
  trend: 'up' | 'down' | 'flat';
  vergleichGestern: { margePct: number; bestellungen: number } | null;
}

type ShiftRow = {
  driver_id: string;
  actual_start: string | null;
  actual_end: string | null;
  planned_start: string;
  planned_end: string;
  status: string;
};

type OrderRow = {
  gesamtbetrag: number | null;
  liefergebuehr: number | null;
};

async function computeMarge(
  svc: ReturnType<typeof createServiceClient>,
  locationId: string,
  dayStart: string,
  dayEnd: string,
): Promise<{ marge: Omit<MargenData, 'trend' | 'vergleichGestern'> }> {
  // Fetch shifts for the day
  const { data: shifts } = await svc
    .from('driver_shifts')
    .select('driver_id, actual_start, actual_end, planned_start, planned_end, status')
    .eq('location_id', locationId)
    .in('status', ['active', 'completed'])
    .gte('planned_start', dayStart)
    .lt('planned_start', dayEnd);

  const shiftRows = (shifts ?? []) as ShiftRow[];

  // Unique drivers
  const driverIds = new Set(shiftRows.map(s => s.driver_id));
  const fahrerAnzahl = driverIds.size;

  // Total shift hours: use actual when available, else planned
  const nowMs = Date.now();
  let totalHours = 0;
  for (const s of shiftRows) {
    const startStr = s.actual_start ?? s.planned_start;
    const endStr   = s.actual_end   ?? (s.status === 'active' ? new Date(nowMs).toISOString() : s.planned_end);
    const startMs  = new Date(startStr).getTime();
    const endMs    = new Date(endStr).getTime();
    const h = Math.max(0, (endMs - startMs) / 3_600_000);
    totalHours += Math.min(h, 12); // cap at 12h per shift
  }
  const schichtStunden = Math.round(totalHours * 10) / 10;

  // Fetch orders for the day
  const { data: orders } = await svc
    .from('customer_orders')
    .select('gesamtbetrag, liefergebuehr')
    .eq('location_id', locationId)
    .neq('status', 'storniert')
    .gte('created_at', dayStart)
    .lt('created_at', dayEnd);

  const orderRows = (orders ?? []) as OrderRow[];
  const bestellungen = orderRows.length;
  const umsatzGesamt = orderRows.reduce((s, o) => s + Math.max(0, Number(o.gesamtbetrag ?? 0)), 0);
  const liefergebuehrenGesamt = orderRows.reduce((s, o) => s + Math.max(0, Number(o.liefergebuehr ?? 0)), 0);

  const fahrerLohnGesamt = fahrerAnzahl * schichtStunden * STUNDEN_LOHN;
  const plattformKostenGesamt = bestellungen * PLATTFORM_KOSTEN;
  const nettoMargeGesamt = liefergebuehrenGesamt - fahrerLohnGesamt - plattformKostenGesamt;

  const kostenProBestellung     = bestellungen > 0 ? (fahrerLohnGesamt + plattformKostenGesamt) / bestellungen : 0;
  const gebuehrenProBestellung  = bestellungen > 0 ? liefergebuehrenGesamt / bestellungen : 0;
  const margeProBestellung      = bestellungen > 0 ? nettoMargeGesamt / bestellungen : 0;
  const margePct                = liefergebuehrenGesamt > 0 ? nettoMargeGesamt / liefergebuehrenGesamt : 0;
  const breakEvenBestellungen   = gebuehrenProBestellung > 0
    ? Math.ceil((fahrerLohnGesamt + plattformKostenGesamt) / gebuehrenProBestellung)
    : 0;

  return {
    marge: {
      schichtStunden,
      fahrerAnzahl,
      bestellungen,
      umsatzGesamt: Math.round(umsatzGesamt * 100) / 100,
      liefergebuehrenGesamt: Math.round(liefergebuehrenGesamt * 100) / 100,
      fahrerLohnGesamt: Math.round(fahrerLohnGesamt * 100) / 100,
      plattformKostenGesamt: Math.round(plattformKostenGesamt * 100) / 100,
      nettoMargeGesamt: Math.round(nettoMargeGesamt * 100) / 100,
      kostenProBestellung: Math.round(kostenProBestellung * 100) / 100,
      gebuehrenProBestellung: Math.round(gebuehrenProBestellung * 100) / 100,
      margeProBestellung: Math.round(margeProBestellung * 100) / 100,
      margePct: Math.round(margePct * 10000) / 10000,
      breakEvenBestellungen,
    },
  };
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id erforderlich' }, { status: 400 });

  const svc = createServiceClient();

  // Today: UTC day window
  const todayDate = new Date();
  const todayStr  = todayDate.toISOString().slice(0, 10);
  const todayStart = `${todayStr}T00:00:00.000Z`;
  const todayEnd   = `${todayStr}T23:59:59.999Z`;

  // Yesterday window
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterdayStr  = yesterdayDate.toISOString().slice(0, 10);
  const yesterdayStart = `${yesterdayStr}T00:00:00.000Z`;
  const yesterdayEnd   = `${yesterdayStr}T23:59:59.999Z`;

  const [todayResult, yesterdayResult] = await Promise.all([
    computeMarge(svc, locationId, todayStart, todayEnd),
    computeMarge(svc, locationId, yesterdayStart, yesterdayEnd),
  ]);

  const todayMarge     = todayResult.marge;
  const yesterdayMarge = yesterdayResult.marge;

  const delta = todayMarge.margePct - yesterdayMarge.margePct;
  const trend: MargenData['trend'] = delta > 0.03 ? 'up' : delta < -0.03 ? 'down' : 'flat';

  const response: MargenData = {
    ...todayMarge,
    trend,
    vergleichGestern: {
      margePct: yesterdayMarge.margePct,
      bestellungen: yesterdayMarge.bestellungen,
    },
  };

  return NextResponse.json(response);
}
