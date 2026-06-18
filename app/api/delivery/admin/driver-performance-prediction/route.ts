/**
 * GET+POST /api/delivery/admin/driver-performance-prediction
 *
 * Phase 232 — Smart Driver Performance Prediction
 *
 * GET  ?action=dashboard              → PredictionDashboard
 * POST { action: 'rebuild' }          → BuildResult
 * POST { action: 'settle', date? }    → SettleResult
 * POST { action: 'prune', days?: 90 } → { pruned }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getPredictionDashboard,
  buildPredictionsForLocation,
  settlePredictions,
  pruneOldPredictions,
} from '@/lib/delivery/driver-performance-prediction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getLocationId(req: NextRequest): Promise<string | null> {
  const sb = createServiceClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (emp?.location_id) return emp.location_id as string;
  return req.nextUrl.searchParams.get('location_id') ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (action === 'dashboard') {
    const dashboard = await getPredictionDashboard(locationId);
    return NextResponse.json(dashboard);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { action: string; days?: number; date?: string };

  if (body.action === 'rebuild') {
    const result = await buildPredictionsForLocation(locationId);
    return NextResponse.json(result);
  }

  if (body.action === 'settle') {
    const result = await settlePredictions(locationId, body.date);
    return NextResponse.json(result);
  }

  if (body.action === 'prune') {
    const result = await pruneOldPredictions(body.days ?? 90);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
