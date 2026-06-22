import { NextRequest, NextResponse } from 'next/server';
import {
  generateAbschluss,
  generateAbschlussForLocation,
  generateAbschlussAllLocations,
  getAbschluss,
  getTodaysAbschluesse,
  pruneOldBerichte,
} from '@/lib/delivery/schicht-abschluss';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');
  const datum      = searchParams.get('datum') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  if (driverId) {
    const bericht = await getAbschluss(driverId, locationId, datum);
    return NextResponse.json({ bericht });
  }

  const berichte = await getTodaysAbschluesse(locationId);
  return NextResponse.json({ berichte });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { action, location_id, driver_id, datum } = body as {
    action?: string;
    location_id?: string;
    driver_id?: string;
    datum?: string;
  };

  if (action === 'generate-all') {
    const results = await generateAbschlussAllLocations(datum);
    return NextResponse.json({ results });
  }

  if (!location_id) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  if (action === 'generate-driver') {
    if (!driver_id) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
    const result = await generateAbschluss(driver_id, location_id, datum);
    return NextResponse.json({ result });
  }

  if (action === 'prune') {
    const deleted = await pruneOldBerichte(60);
    return NextResponse.json({ deleted });
  }

  // Default: generate for all drivers of this location
  const result = await generateAbschlussForLocation(location_id, datum);
  return NextResponse.json({ result });
}
