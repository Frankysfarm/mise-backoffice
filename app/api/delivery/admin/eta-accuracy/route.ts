/**
 * GET  /api/delivery/admin/eta-accuracy
 *   → ETA-Genauigkeitsbericht + Kalibrierungsfaktoren für den eigenen Standort
 *
 * POST /api/delivery/admin/eta-accuracy
 *   → Kalibrierungsfaktoren manuell neu berechnen (normalerweise per Cron täglich)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getAccuracyReport,
  recomputeCalibrationFactors,
} from '@/lib/delivery/eta-calibration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  void req;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Nicht eingeloggt oder kein Standort' }, { status: 401 });
  }

  try {
    const report = await getAccuracyReport(locationId);
    return NextResponse.json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Nicht eingeloggt oder kein Standort' }, { status: 401 });
  }

  try {
    const factorsUpdated = await recomputeCalibrationFactors(locationId);
    return NextResponse.json({ ok: true, factors_updated: factorsUpdated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
