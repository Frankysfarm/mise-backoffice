import { NextRequest, NextResponse } from 'next/server';
import { getAbschluss } from '@/lib/delivery/schicht-abschluss';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  const datum      = searchParams.get('datum') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  const sb   = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const bericht = await getAbschluss(user.id, locationId, datum);
  return NextResponse.json({ bericht });
}
