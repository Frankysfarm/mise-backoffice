import { NextRequest, NextResponse } from 'next/server';
import { getZeugnisseForDriver } from '@/lib/delivery/fahrer-zeugnis';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const limit      = parseInt(req.nextUrl.searchParams.get('limit') ?? '12', 10);

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  try {
    const zeugnisse = await getZeugnisseForDriver(user.id, locationId, limit);
    return NextResponse.json({ ok: true, zeugnisse });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
