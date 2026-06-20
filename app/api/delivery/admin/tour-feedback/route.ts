import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getFeedbackDashboard, pruneTourFeedback } from '@/lib/delivery/tour-feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocation(req: NextRequest, sb: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const urlLoc = new URL(req.url).searchParams.get('location_id');
  if (urlLoc) return urlLoc;
  const { data: emp } = await sb.from('employees').select('location_id').eq('auth_user_id', user.id).single();
  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const locationId = await resolveLocation(req, sb);
  if (!locationId) return NextResponse.json({ error: 'Kein Standort' }, { status: 400 });

  const action = new URL(req.url).searchParams.get('action') ?? 'dashboard';
  const days   = parseInt(new URL(req.url).searchParams.get('days') ?? '30', 10);

  if (action === 'dashboard') {
    const dashboard = await getFeedbackDashboard(locationId, days);
    return NextResponse.json(dashboard);
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as { action: string; days_to_keep?: number };

  if (body.action === 'prune') {
    const pruned = await pruneTourFeedback(body.days_to_keep ?? 90);
    return NextResponse.json({ pruned });
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}
