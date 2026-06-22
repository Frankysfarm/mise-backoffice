import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getQualitaetForDriver } from '@/lib/delivery/liefer-qualitaet';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const sb           = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const locationId = req.nextUrl.searchParams.get('location_id');
  const days       = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10);

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const qualitaet = await getQualitaetForDriver(user.id, locationId, days);
    return NextResponse.json({ ok: true, qualitaet });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
