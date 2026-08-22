import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Die frühere /api/driver-app-API vertraute vom Client übergebenen Fahrer-IDs
 * und wurde vollständig durch die sitzungsgebundene /api/driver/v1-API ersetzt.
 * Ein explizites 410 verhindert, dass alte Clients still gegen unsichere oder
 * halb kompatible Endpunkte weiterarbeiten.
 */
function retired() {
  return NextResponse.json(
    {
      error: 'Diese Fahrer-API wurde ersetzt. Bitte die aktuelle Fahrer-App verwenden.',
      code: 'driver_api_retired',
    },
    {
      status: 410,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

export const GET = retired;
export const POST = retired;
export const PUT = retired;
export const PATCH = retired;
export const DELETE = retired;
