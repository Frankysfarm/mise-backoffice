/**
 * DELETE /api/delivery/admin/credits/[id]
 *
 * Storniert einen ausgestellten Credit (nur wenn status='issued').
 * Auth: employees.auth_user_id → location_id
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cancelCredit } from '@/lib/delivery/credits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
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

  const locationId = emp?.location_id as string | null;
  if (!locationId) return NextResponse.json({ error: 'Kein Employee-Konto' }, { status: 403 });

  const result = await cancelCredit(params.id, locationId);

  if (!result.ok) {
    const status = result.reason === 'not_found' ? 404 : 409;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json({ ok: true });
}
