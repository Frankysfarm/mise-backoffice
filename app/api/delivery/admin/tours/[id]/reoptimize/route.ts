/**
 * POST /api/delivery/admin/tours/[id]/reoptimize
 *
 * Optimiert die verbleibenden offenen Stops einer aktiven Tour neu.
 * Nutzt Nearest-Neighbor-Heuristik, abgeschlossene Stops werden nicht bewegt.
 *
 * Nur für eingeloggte Admins.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { reoptimizeActiveTour } from '@/lib/delivery/tour-modifier';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!emp?.location_id) return NextResponse.json({ error: 'Kein Standort' }, { status: 403 });

  const result = await reoptimizeActiveTour(
    params.id,
    emp.location_id as string,
    user.id,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 422 });
  }

  return NextResponse.json(result);
}
