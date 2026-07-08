/**
 * GET /api/delivery/admin/fahrer-rueckkehr-praezisions-eta?location_id=<uuid>
 *
 * Phase 795 — Fahrer-Rückkehr-Präzisions-API
 * Verbesserte ETA mit GPS-Echtzeit-Abgleich + historischer Abweichungskorrektur:
 *   - Haversine-Distanz (Fahrer-GPS → Basis)
 *   - Verbleibende Stops × Ø Min/Stop (historisch letzte 7d)
 *   - Korrektur: historische Abweichung letzte 7d (Faktor 0.85–1.15)
 *
 * Response: { ok, fahrer: FahrerEta[], generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AVG_SPEED_KMH = 28;
const DEFAULT_MIN_PER_STOP = 5;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface FahrerEta {
  driver_id: string;
  name: string;
  verbleibende_stops: number;
  gps_distanz_km: number | null;
  historischer_korrekturfaktor: number;
  eta_minuten: number;
  eta_uhrzeit: string;
  konfidenz: 'hoch' | 'mittel' | 'niedrig';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: emp } = await sb.from('employees').select('location_id').eq('auth_user_id', user.id).maybeSingle();
    if (!emp?.location_id) return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  const locId = locationId!;

  try {
    const sb = await createClient();

    // Basis-GPS der Location
    const { data: loc } = await sb
      .from('locations')
      .select('lat, lng')
      .eq('id', locId)
      .maybeSingle();

    const baseLat: number = (loc as any)?.lat ?? 52.52;
    const baseLng: number = (loc as any)?.lng ?? 13.405;

    // Aktive Batches mit Fahrer
    const { data: batches, error: bErr } = await sb
      .from('mise_delivery_batches')
      .select('id, driver_id, stop_count, completed_stops, status')
      .eq('location_id', locId)
      .in('status', ['active', 'in_progress', 'gestartet'])
      .not('driver_id', 'is', null);

    if (bErr) throw bErr;
    if (!batches || batches.length === 0) {
      return NextResponse.json({ ok: true, fahrer: [], generatedAt: new Date().toISOString() });
    }

    const driverIds = [...new Set(batches.map((b: any) => b.driver_id as string))];

    // Fahrer-Namen + GPS
    const { data: drivers } = await sb
      .from('employees')
      .select('id, vorname, nachname, current_lat, current_lng')
      .in('id', driverIds);

    const driverMap = new Map<string, any>((drivers ?? []).map((d: any) => [d.id, d]));

    // Historische Abweichung (letzte 7d) je Fahrer
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: histBatches } = await sb
      .from('mise_delivery_batches')
      .select('driver_id, started_at, completed_at, stop_count')
      .eq('location_id', locId)
      .eq('status', 'completed')
      .in('driver_id', driverIds)
      .gte('completed_at', cutoff)
      .not('started_at', 'is', null)
      .not('completed_at', 'is', null);

    // Korrekturfaktor je Fahrer: Ø(tatsächlich) / Ø(geschätzt)
    const faktoren = new Map<string, number>();
    for (const did of driverIds) {
      const hist = (histBatches ?? []).filter((b: any) => b.driver_id === did && b.stop_count);
      if (hist.length >= 3) {
        const ratios = hist.map((b: any) => {
          const actual = (new Date(b.completed_at).getTime() - new Date(b.started_at).getTime()) / 60_000;
          const estimated = (b.stop_count ?? 1) * DEFAULT_MIN_PER_STOP;
          return actual / estimated;
        });
        const avg = ratios.reduce((a: number, r: number) => a + r, 0) / ratios.length;
        faktoren.set(did, Math.max(0.85, Math.min(1.15, avg)));
      } else {
        faktoren.set(did, 1.0);
      }
    }

    const result: FahrerEta[] = [];
    const now = new Date();

    for (const batch of batches as any[]) {
      const driver = driverMap.get(batch.driver_id);
      if (!driver) continue;

      const name = `${driver.vorname ?? ''} ${driver.nachname ?? ''}`.trim() || 'Fahrer';
      const verbleibendeStops = Math.max(0, (batch.stop_count ?? 1) - (batch.completed_stops ?? 0));
      const faktor = faktoren.get(batch.driver_id) ?? 1.0;

      let gpsDistanzKm: number | null = null;
      let etaMin: number;
      let konfidenz: 'hoch' | 'mittel' | 'niedrig';

      if (driver.current_lat && driver.current_lng) {
        gpsDistanzKm = haversineKm(driver.current_lat, driver.current_lng, baseLat, baseLng);
        const fahrMinuten = (gpsDistanzKm / AVG_SPEED_KMH) * 60;
        const stopMinuten = verbleibendeStops * DEFAULT_MIN_PER_STOP * faktor;
        etaMin = Math.round(fahrMinuten + stopMinuten);
        konfidenz = faktor <= 1.05 ? 'hoch' : 'mittel';
      } else {
        etaMin = Math.round(verbleibendeStops * DEFAULT_MIN_PER_STOP * faktor);
        konfidenz = verbleibendeStops === 0 ? 'mittel' : 'niedrig';
      }

      const etaTime = new Date(now.getTime() + etaMin * 60_000);
      const etaUhrzeit = etaTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

      result.push({
        driver_id: batch.driver_id,
        name,
        verbleibende_stops: verbleibendeStops,
        gps_distanz_km: gpsDistanzKm ? Math.round(gpsDistanzKm * 10) / 10 : null,
        historischer_korrekturfaktor: Math.round(faktor * 100) / 100,
        eta_minuten: etaMin,
        eta_uhrzeit: etaUhrzeit,
        konfidenz,
      });
    }

    result.sort((a, b) => a.eta_minuten - b.eta_minuten);

    return NextResponse.json({ ok: true, fahrer: result, generatedAt: now.toISOString() });
  } catch (err: unknown) {
    console.error('[fahrer-rueckkehr-praezisions-eta]', err);
    return NextResponse.json({ ok: false, error: 'Serverfehler' }, { status: 500 });
  }
}
