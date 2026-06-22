import { NextRequest, NextResponse } from 'next/server';
import { getVerfuegbarkeitsKalender } from '@/lib/delivery/fahrer-verfuegbarkeit';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const days       = parseInt(req.nextUrl.searchParams.get('days') ?? '7', 10);

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const kalender = await getVerfuegbarkeitsKalender(locationId, Math.min(days, 14));
    return NextResponse.json({ ok: true, ...kalender });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
