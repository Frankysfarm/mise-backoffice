/**
 * GET /api/delivery/admin/fahrer-rueckkehr-prognose
 *
 * Fahrer-Rückkehr-Prognose: Wann kommen aktive Fahrer zurück + Restkapazität?
 *
 * Basis: driver-return-prediction engine (Phase 274)
 * Neu: residualCapacity — geschätzte zusätzliche Stops im nächsten 60-Min-Fenster
 *       nach Rückkehr des Fahrers (basierend auf historischer Stops/Stunde-Rate).
 *
 * Response: FahrerRueckkehrPrognose[]
 *   driverName, minutesUntilReturn, remainingStops, confidence,
 *   residualCapacity, estimatedReturnUtc, batchId
 *
 * Multi-Tenant: location_id aus Query oder aus Auth-User.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getReturnPredictionDashboard } from '@/lib/delivery/driver-return-prediction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerRueckkehrPrognose {
  driverId: string;
  driverName: string | null;
  driverVehicle: 'bike' | 'car';
  batchId: string | null;
  minutesUntilReturn: number;
  remainingStops: number;
  totalStops: number;
  estimatedReturnUtc: string;
  confidence: number;
  residualCapacity: number;
  urgency: 'soon' | 'coming' | 'later';
}

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  if (!emp?.tenant_id) return null;
  const { data: loc } = await sb
    .from('locations')
    .select('id')
    .eq('tenant_id', emp.tenant_id as string)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (loc?.id as string) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  try {
    const dashboard = await getReturnPredictionDashboard(locationId);

    const prognosen: FahrerRueckkehrPrognose[] = dashboard.predictions.map((p) => {
      const min = p.minutesUntilReturn;

      // Residual capacity: if driver returns within 60 min, estimate how many extra
      // stops they could complete based on their historical rate (~2 stops/hr on a bike,
      // ~3 stops/hr in a car for typical zone distances).
      const stopsPerHour = p.driverVehicle === 'car' ? 3 : 2;
      const remainingWindowMin = Math.max(0, 60 - min);
      const residualCapacity = Math.round((remainingWindowMin / 60) * stopsPerHour);

      const urgency: FahrerRueckkehrPrognose['urgency'] =
        min <= 5 ? 'soon' : min <= 20 ? 'coming' : 'later';

      return {
        driverId:           p.driverId,
        driverName:         p.driverName,
        driverVehicle:      p.driverVehicle,
        batchId:            p.batchId,
        minutesUntilReturn: min,
        remainingStops:     p.remainingStops,
        totalStops:         p.totalStops,
        estimatedReturnUtc: p.estimatedReturnUtc,
        confidence:         p.confidence,
        residualCapacity,
        urgency,
      };
    });

    // Sort: soonest return first
    prognosen.sort((a, b) => a.minutesUntilReturn - b.minutesUntilReturn);

    return NextResponse.json({
      ok:                   true,
      prognosen,
      activeDrivers:        dashboard.activeDrivers,
      returningWithin15Min: dashboard.returningWithin15Min,
      returningWithin30Min: dashboard.returningWithin30Min,
      avgMinutesUntilReturn: dashboard.avgMinutesUntilReturn,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
