/**
 * GET /api/delivery/admin/performance?location_id=...&limit=20
 *
 * Fahrer-Performance-KPIs aus v_driver_performance_stats (Migration 007).
 * Gibt pro Fahrer: Lieferungen heute/gestern, aktiver Batch, letzter Standort.
 *
 * Nur für eingeloggte Admins.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DriverPerfRow {
  driver_id: string;
  auth_user_id: string | null;
  vehicle: string;
  active: boolean;
  state: string;
  total_deliveries: number;
  current_capacity: number;
  max_capacity: number;
  deliveries_today: number;
  deliveries_yesterday: number;
  active_batch_id: string | null;
  last_position: { lat: number; lng: number; at: string } | null;
  last_delivery_at: string | null;
}

interface DriverPerfWithName extends DriverPerfRow {
  employee_name: string | null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100);

  const svc = createServiceClient();

  // Fahrer für diese Location laden (via mise_drivers → employees)
  const { data: drivers, error } = await svc
    .from('mise_drivers')
    .select('id, auth_user_id')
    .eq('active', true)
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!drivers || drivers.length === 0) return NextResponse.json({ drivers: [] });

  // Employee-Namen via auth_user_id auflösen
  const authIds = drivers.map((d) => d.auth_user_id).filter(Boolean) as string[];
  const { data: employees } = await svc
    .from('employees')
    .select('auth_user_id, vorname, nachname, location_id')
    .in('auth_user_id', authIds)
    .eq('location_id', locationId);

  const empMap = new Map(
    (employees ?? []).map((e) => [
      e.auth_user_id,
      `${e.vorname ?? ''} ${e.nachname ?? ''}`.trim(),
    ]),
  );

  // Nur Fahrer dieser Location (auth_user_id in empMap)
  const locationDriverIds = drivers
    .filter((d) => d.auth_user_id && empMap.has(d.auth_user_id))
    .map((d) => d.id);

  if (locationDriverIds.length === 0) return NextResponse.json({ drivers: [] });

  // Performance-Stats aus View laden
  const { data: stats, error: statsErr } = await svc
    .from('v_driver_performance_stats')
    .select('driver_id, auth_user_id, vehicle, active, state, total_deliveries, current_capacity, max_capacity, deliveries_today, deliveries_yesterday, active_batch_id, last_position, last_delivery_at')
    .in('driver_id', locationDriverIds)
    .order('deliveries_today', { ascending: false })
    .limit(limit);

  if (statsErr) {
    // View noch nicht in DB — leere Antwort mit Hinweis
    return NextResponse.json({ drivers: [], _fallback: true, _error: statsErr.message });
  }

  const result: DriverPerfWithName[] = (stats ?? []).map((row) => ({
    ...(row as unknown as DriverPerfRow),
    employee_name: empMap.get((row as any).auth_user_id ?? '') ?? null,
  }));

  return NextResponse.json({ drivers: result, total: result.length });
}
