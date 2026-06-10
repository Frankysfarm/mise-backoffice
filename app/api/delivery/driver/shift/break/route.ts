/**
 * POST /api/delivery/driver/shift/break
 *   Body: { action: 'start'|'end', shift_id, break_type?, notes? }
 *
 * GET  /api/delivery/driver/shift/break?shift_id=...
 *   Gibt aktuelle Pausen-Zusammenfassung zurück.
 *
 * Auth: muss als Fahrer eingeloggt sein (mise_drivers.auth_user_id = user.id)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  startBreak,
  endBreak,
  getActiveBreak,
  getBreakSummary,
  type BreakType,
} from '@/lib/delivery/shifts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveDriver(userId: string) {
  const svc = createServiceClient();
  const { data } = await svc
    .from('mise_drivers')
    .select('id, location_id')
    .eq('auth_user_id', userId)
    .single();
  return data as { id: string; location_id: string } | null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const shiftId = searchParams.get('shift_id');
  if (!shiftId) return NextResponse.json({ error: 'shift_id fehlt' }, { status: 400 });

  const driver = await resolveDriver(user.id);
  if (!driver) return NextResponse.json({ error: 'Kein Fahrer-Account' }, { status: 403 });

  const [summary, activeBreak] = await Promise.all([
    getBreakSummary(shiftId),
    getActiveBreak(shiftId),
  ]);

  return NextResponse.json({ summary, activeBreak });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const driver = await resolveDriver(user.id);
  if (!driver) return NextResponse.json({ error: 'Kein Fahrer-Account' }, { status: 403 });

  const body = await req.json() as {
    action: 'start' | 'end';
    shift_id: string;
    break_type?: BreakType;
    notes?: string;
  };

  const { action, shift_id, break_type, notes } = body;
  if (!action || !shift_id) {
    return NextResponse.json({ error: 'action + shift_id erforderlich' }, { status: 400 });
  }

  if (action === 'start') {
    const breakRecord = await startBreak(
      shift_id,
      driver.id,
      driver.location_id,
      break_type ?? 'pause',
      notes,
    );
    return NextResponse.json({ break: breakRecord });
  }

  if (action === 'end') {
    const breakRecord = await endBreak(shift_id, driver.id);
    return NextResponse.json({ break: breakRecord });
  }

  return NextResponse.json({ error: 'Ungültige action' }, { status: 400 });
}
