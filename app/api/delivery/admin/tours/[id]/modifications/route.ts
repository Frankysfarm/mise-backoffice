/**
 * GET /api/delivery/admin/tours/[id]/modifications
 *   ?limit=N  (default 50)
 *
 * Gibt den Modifikations-Audit-Trail einer Tour zurück.
 * Nur für eingeloggte Admins.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTourModifications } from '@/lib/delivery/tour-modifier';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
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

  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10) || 50,
    200,
  );

  const modifications = await getTourModifications(
    params.id,
    emp.location_id as string,
    limit,
  );

  return NextResponse.json({ modifications });
}
