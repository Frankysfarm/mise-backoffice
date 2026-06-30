/**
 * GET /api/delivery/driver/tages-einnahmen?driver_id=...
 *
 * Phase 521 — Fahrer-Tageseinnahmen-Übersicht
 * Zeigt dem Fahrer seine heutigen Einnahmen: Basisvergütung, Trinkgeld, Boni, Gesamt.
 * Stündliche Aufschlüsselung und Vergleich zum gestrigen Tag.
 *
 * Response: { ok, data: TagesEinnahmenData, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface EinnahmenStunde {
  hour: number;
  lieferungen: number;
  trinkgeldEur: number;
  basisEur: number;
  totalEur: number;
}

export interface TagesEinnahmenData {
  driverName: string;
  heute: {
    lieferungen: number;
    trinkgeldEur: number;
    basisEur: number;
    bonusEur: number;
    totalEur: number;
  };
  gestern: {
    lieferungen: number;
    totalEur: number;
  };
  deltaEur: number;
  deltaLieferungen: number;
  stunden: EinnahmenStunde[];
  aktivSeitMin: number | null;
}

async function resolveDriverId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: driver } = await sb
    .from('mise_drivers')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (driver?.id as string) ?? null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let driverId = searchParams.get('driver_id');
  if (!driverId) driverId = await resolveDriverId(user.id);
  if (!driverId) return NextResponse.json({ error: 'driver_id fehlt' }, { status: 400 });

  const ssb = createServiceClient();
  const now = new Date();

  // Heute 00:00 UTC
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // Gestern 00:00 UTC
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);

  // Fahrername laden
  const { data: driverRow } = await ssb
    .from('mise_drivers')
    .select('name')
    .eq('id', driverId)
    .maybeSingle();
  const driverName = (driverRow?.name as string) ?? 'Fahrer';

  // Heutige Batches
  const { data: heuteBatches } = await ssb
    .from('mise_delivery_batches')
    .select('id, completed_at, started_at, tip_eur, driver_pay_eur, bonus_eur')
    .eq('driver_id', driverId)
    .in('status', ['completed', 'abgeschlossen', 'delivered'])
    .gte('completed_at', todayStart.toISOString());

  // Gestrige Batches
  const { data: gesternBatches } = await ssb
    .from('mise_delivery_batches')
    .select('id, tip_eur, driver_pay_eur, bonus_eur')
    .eq('driver_id', driverId)
    .in('status', ['completed', 'abgeschlossen', 'delivered'])
    .gte('completed_at', yesterdayStart.toISOString())
    .lt('completed_at', todayStart.toISOString());

  // Heutige Stops für Lieferanzahl
  const heuteBatchIds = (heuteBatches ?? []).map((b) => b.id as string);
  let helieferungen = 0;
  if (heuteBatchIds.length > 0) {
    const { count } = await ssb
      .from('mise_delivery_batch_stops')
      .select('id', { count: 'exact', head: true })
      .in('batch_id', heuteBatchIds)
      .not('geliefert_am', 'is', null);
    helieferungen = count ?? 0;
  }

  const heTabatches = heuteBatches ?? [];
  const trinkgeldEur = heTabatches.reduce((s, b) => s + ((b.tip_eur as number) ?? 0), 0);
  const basisEur = heTabatches.reduce((s, b) => s + ((b.driver_pay_eur as number) ?? 0), 0);
  const bonusEur = heTabatches.reduce((s, b) => s + ((b.bonus_eur as number) ?? 0), 0);
  const totalEur = trinkgeldEur + basisEur + bonusEur;

  const gesternTabatches = gesternBatches ?? [];
  const gLieferungen = gesternTabatches.length;
  const gTotal = gesternTabatches.reduce(
    (s, b) => s + ((b.tip_eur as number) ?? 0) + ((b.driver_pay_eur as number) ?? 0) + ((b.bonus_eur as number) ?? 0),
    0
  );

  // Stündliche Aufschlüsselung heute
  const stundenMap: Map<number, EinnahmenStunde> = new Map();
  for (const b of heTabatches) {
    const h = b.completed_at ? new Date(b.completed_at as string).getUTCHours() : now.getUTCHours();
    const existing = stundenMap.get(h) ?? { hour: h, lieferungen: 0, trinkgeldEur: 0, basisEur: 0, totalEur: 0 };
    existing.lieferungen += 1;
    existing.trinkgeldEur += (b.tip_eur as number) ?? 0;
    existing.basisEur += (b.driver_pay_eur as number) ?? 0;
    existing.totalEur += ((b.tip_eur as number) ?? 0) + ((b.driver_pay_eur as number) ?? 0) + ((b.bonus_eur as number) ?? 0);
    stundenMap.set(h, existing);
  }
  const stunden = Array.from(stundenMap.values()).sort((a, b) => a.hour - b.hour);

  // Aktiv seit (erste GPS-Event heute)
  const { data: firstGps } = await ssb
    .from('driver_gps_events')
    .select('recorded_at')
    .eq('driver_id', driverId)
    .gte('recorded_at', todayStart.toISOString())
    .order('recorded_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const aktivSeitMin = firstGps?.recorded_at
    ? Math.round((now.getTime() - new Date(firstGps.recorded_at as string).getTime()) / 60_000)
    : null;

  const data: TagesEinnahmenData = {
    driverName,
    heute: { lieferungen: helieferungen, trinkgeldEur, basisEur, bonusEur, totalEur },
    gestern: { lieferungen: gLieferungen, totalEur: gTotal },
    deltaEur: Math.round((totalEur - gTotal) * 100) / 100,
    deltaLieferungen: helieferungen - gLieferungen,
    stunden,
    aktivSeitMin,
  };

  return NextResponse.json({ ok: true, data, generatedAt: now.toISOString() });
}
