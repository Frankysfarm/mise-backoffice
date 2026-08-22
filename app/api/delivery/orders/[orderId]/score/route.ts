/**
 * GET /api/delivery/orders/[orderId]/score
 *
 * Gibt die letzte 10-Faktoren Scoring-Aufschlüsselung für eine Bestellung zurück.
 * Nutzt die dispatch_scores Tabelle die vom Dispatch-Engine befüllt wird.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  if (!UUID_RE.test(params.orderId)) {
    return NextResponse.json({ error: 'Ungültige Order-ID' }, { status: 400 });
  }

  const { data, error } = await sb
    .from('dispatch_scores')
    .select('total_score, f_distance, f_load, f_vehicle, f_experience, f_zone, f_prep_time, f_time_of_day, f_priority, f_bundle_fit, f_history, decision, reason, created_at, driver:mise_drivers(name)')
    .eq('order_id', params.orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ score: null });

  const driverRaw = data.driver;
  const driverName = (Array.isArray(driverRaw) ? driverRaw[0]?.name : (driverRaw as Record<string, unknown> | null)?.name) as string | null ?? null;

  return NextResponse.json({
    score: {
      total:          data.total_score,
      f_distance:     data.f_distance,
      f_load:         data.f_load,
      f_vehicle:      data.f_vehicle,
      f_experience:   data.f_experience,
      f_zone:         data.f_zone,
      f_prep_time:    data.f_prep_time,
      f_time_of_day:  data.f_time_of_day,
      f_priority:     data.f_priority,
      f_bundle_fit:   data.f_bundle_fit,
      f_history:      data.f_history,
      decision:       data.decision,
      reason:         data.reason,
      driver_name:    driverName,
      scored_at:      data.created_at,
    },
  });
}
