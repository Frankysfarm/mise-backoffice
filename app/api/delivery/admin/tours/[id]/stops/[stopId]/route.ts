/**
 * DELETE /api/delivery/admin/tours/[id]/stops/[stopId]
 *
 * Entfernt einen Stop aus einer aktiven Tour.
 * Body (optional): { reason?: string }
 *
 * Nur für eingeloggte Admins.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { removeStopFromActiveTour } from '@/lib/delivery/tour-modifier';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; stopId: string } },
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

  let reason = 'Admin entfernt';
  try {
    const body = await req.json() as { reason?: string };
    if (body.reason) reason = body.reason;
  } catch {
    // Body ist optional
  }

  const result = await removeStopFromActiveTour(
    params.id,
    params.stopId,
    emp.location_id as string,
    reason,
    user.id,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 422 });
  }

  return NextResponse.json(result);
}
