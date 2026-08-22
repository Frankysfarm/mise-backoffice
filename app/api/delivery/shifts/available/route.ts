import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getBookableSlots } from '@/lib/delivery/shift-booking';

export const dynamic = 'force-dynamic';

/**
 * GET /api/delivery/shifts/available?location_id=...&days_ahead=7
 *
 * Gibt Schicht-Slots zurück, bei denen die Location noch Fahrer benötigt.
 * Authentifizierung: muss ein Fahrer (mise_drivers) sein.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = createServiceClient();
  const { data: driver } = await svc
    .from('mise_drivers')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!driver) return NextResponse.json({ error: 'Not a driver' }, { status: 403 });

  const daysAhead = Math.min(14, Math.max(1, parseInt(searchParams.get('days_ahead') ?? '7', 10)));
  const slots = await getBookableSlots(locationId, driver.id, daysAhead);

  return NextResponse.json({ slots });
}
