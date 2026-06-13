import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getDriverActiveSuggestion, respondToSuggestion } from '@/lib/delivery/positioning';

export const dynamic = 'force-dynamic';

async function resolveDriver(req: NextRequest): Promise<{
  driverId: string;
  locationId: string;
} | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const serviceSb = createServiceClient();
  const { data: emp } = await serviceSb
    .from('employees')
    .select('id, tenant_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!emp?.tenant_id) return null;

  const { data: driver } = await serviceSb
    .from('mise_drivers')
    .select('id')
    .eq('employee_id', emp.id as string)
    .maybeSingle();

  if (!driver) return null;
  return { driverId: driver.id as string, locationId: emp.tenant_id as string };
}

// GET — Aktiver Vorschlag für diesen Fahrer
export async function GET(req: NextRequest) {
  const ctx = await resolveDriver(req);
  if (!ctx) return NextResponse.json({ suggestion: null });

  try {
    const suggestion = await getDriverActiveSuggestion(ctx.driverId, ctx.locationId);
    return NextResponse.json({ suggestion });
  } catch {
    return NextResponse.json({ suggestion: null });
  }
}

// POST — Vorschlag annehmen oder ablehnen: { suggestion_id, response: 'accepted' | 'rejected' }
export async function POST(req: NextRequest) {
  const ctx = await resolveDriver(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { suggestion_id?: string; response?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
  }

  if (!body.suggestion_id) {
    return NextResponse.json({ error: 'suggestion_id fehlt' }, { status: 400 });
  }
  if (body.response !== 'accepted' && body.response !== 'rejected') {
    return NextResponse.json({ error: 'response muss accepted oder rejected sein' }, { status: 400 });
  }

  try {
    await respondToSuggestion(body.suggestion_id, body.response);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[driver positioning POST]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
