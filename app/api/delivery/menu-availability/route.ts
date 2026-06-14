/**
 * GET /api/delivery/menu-availability?location_id=...
 *
 * Öffentlicher Endpunkt für die Storefront.
 * Gibt die Namen aller aktuell deaktivierten Menü-Artikel zurück.
 * Die Storefront kann diese Artikel ausgegraut anzeigen oder ausblenden.
 *
 * Kein Auth erforderlich — public read.
 *
 * Response:
 *   { disabledItems: string[], updatedAt: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDisabledItems } from '@/lib/delivery/menu-availability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const locationId = new URL(req.url).searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ disabledItems: [], updatedAt: new Date().toISOString() });
  }

  const disabledItems = await getDisabledItems(locationId).catch(() => [] as string[]);
  return NextResponse.json({
    disabledItems,
    updatedAt: new Date().toISOString(),
  });
}
