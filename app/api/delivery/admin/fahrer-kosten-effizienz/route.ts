/**
 * GET /api/delivery/admin/fahrer-kosten-effizienz?location_id=<uuid>
 *
 * Phase 866 — Fahrer-Kosten-Effizienz-API
 * Kosten je Lieferung, Kosten je km und Ertrag-Kosten-Verhältnis je Fahrer heute.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOHN_PRO_STUNDE = 13.0;
const KM_KOSTEN_PRO_KM = 0.30;

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get('location_id');
  if (fromQuery) return fromQuery;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: shifts } = await sb
    .from('driver_shifts')
    .select('id, driver_id, started_at, ended_at, km_start, km_ende')
    .eq('location_id', locationId)
    .gte('started_at', todayStart.toISOString())
    .in('status', ['active', 'completed']);

  if (!shifts?.length) {
    return NextResponse.json({
      fahrer: [],
      avg_kosten_pro_lieferung: 0,
      avg_ekv: 0,
      generatedAt: now.toISOString(),
    });
  }

  const driverIds = [...new Set(shifts.map(s => s.driver_id as string))];

  const [{ data: drivers }, { data: batches }] = await Promise.all([
    sb.from('mise_drivers').select('id, vorname, nachname').in('id', driverIds),
    sb
      .from('delivery_batches')
      .select('driver_id, delivery_fee, total_stops')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .not('delivery_fee', 'is', null),
  ]);

  const driverMap = new Map(
    (drivers ?? []).map(d => [
      d.id as string,
      `${d.vorname ?? ''} ${(d.nachname as string | undefined)?.charAt(0) ?? ''}.`.trim(),
    ])
  );

  type BatchRow = { driver_id: string; delivery_fee: number; total_stops: number };
  const einnahmenMap = new Map<string, number>();
  const lieferungenMap = new Map<string, number>();
  for (const b of (batches as BatchRow[] | null) ?? []) {
    const prev = einnahmenMap.get(b.driver_id) ?? 0;
    einnahmenMap.set(b.driver_id, prev + (b.delivery_fee ?? 0));
    const prevL = lieferungenMap.get(b.driver_id) ?? 0;
    lieferungenMap.set(b.driver_id, prevL + (b.total_stops ?? 1));
  }

  const result = shifts.map(shift => {
    const driverId = shift.driver_id as string;
    const startedAt = new Date(shift.started_at as string);
    const endedAt = shift.ended_at ? new Date(shift.ended_at as string) : now;
    const stundenAktiv = Math.max(0.1, (endedAt.getTime() - startedAt.getTime()) / 3_600_000);
    const kmGefahren = Math.max(0, ((shift.km_ende as number | null) ?? 0) - ((shift.km_start as number | null) ?? 0));
    const lohnKosten = stundenAktiv * LOHN_PRO_STUNDE;
    const kmKosten = kmGefahren * KM_KOSTEN_PRO_KM;
    const gesamtkosten = lohnKosten + kmKosten;
    const einnahmen = einnahmenMap.get(driverId) ?? 0;
    const lieferungen = lieferungenMap.get(driverId) ?? 0;
    const kostenProLieferung = lieferungen > 0 ? gesamtkosten / lieferungen : gesamtkosten;
    const kostenProKm = kmGefahren > 0 ? gesamtkosten / kmGefahren : 0;
    const ekv = gesamtkosten > 0 ? Math.min(200, Math.round((einnahmen / gesamtkosten) * 100)) : 0;
    return {
      driver_id: driverId,
      name: driverMap.get(driverId) ?? 'Unbekannt',
      lieferungen,
      km_gefahren: parseFloat(kmGefahren.toFixed(1)),
      gesamtkosten: parseFloat(gesamtkosten.toFixed(2)),
      einnahmen: parseFloat(einnahmen.toFixed(2)),
      kosten_pro_lieferung: parseFloat(kostenProLieferung.toFixed(2)),
      kosten_pro_km: parseFloat(kostenProKm.toFixed(2)),
      ekv,
    };
  });

  const avgKostenProLieferung =
    result.length > 0
      ? result.reduce((s, r) => s + r.kosten_pro_lieferung, 0) / result.length
      : 0;
  const avgEkv =
    result.length > 0 ? result.reduce((s, r) => s + r.ekv, 0) / result.length : 0;

  return NextResponse.json({
    fahrer: result.sort((a, b) => b.ekv - a.ekv),
    avg_kosten_pro_lieferung: parseFloat(avgKostenProLieferung.toFixed(2)),
    avg_ekv: Math.round(avgEkv),
    generatedAt: now.toISOString(),
  });
}
