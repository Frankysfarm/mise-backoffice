/**
 * GET /api/delivery/mov   — Effektiven MOV für Kunden abrufen (Storefront-Checkout)
 * POST /api/delivery/mov  — MOV A/B-Event aufzeichnen (Impression / Konversion)
 *
 * Öffentlicher Endpunkt — kein Login erforderlich.
 *
 * GET Query-Parameter:
 *   location_id    UUID der Location
 *   customer_hash  Stabiler Kunden-Identifier (z.B. Telefonnummer)
 *   zone           Lieferzone A|B|C|D
 *   fallback_mov   Fallback-MOV in EUR (z.B. 12)
 *
 * GET Antwort: { movEur, isTestVariant, variantName, testId, variantId }
 *
 * POST Body: { testId, variantId, locationId, customerHash, zone,
 *              orderTotalEur, movAppliedEur, converted, orderId? }
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveMovForCustomer,
  recordMovEvent,
} from '@/lib/delivery/mov-ab-test';
import type { ZoneName } from '@/lib/delivery/zones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_ZONES = new Set<string>(['A', 'B', 'C', 'D']);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId   = searchParams.get('location_id');
  const customerHash = searchParams.get('customer_hash');
  const zone         = searchParams.get('zone');
  const fallbackStr  = searchParams.get('fallback_mov');

  if (!locationId || !customerHash || !zone) {
    return NextResponse.json(
      { error: 'Fehlende Parameter: location_id, customer_hash, zone erforderlich' },
      { status: 400 },
    );
  }
  if (!VALID_ZONES.has(zone)) {
    return NextResponse.json({ error: 'Ungültige Zone (A|B|C|D erwartet)' }, { status: 400 });
  }

  const fallbackMovEur = fallbackStr ? parseFloat(fallbackStr) : 12;
  if (isNaN(fallbackMovEur) || fallbackMovEur < 0) {
    return NextResponse.json({ error: 'Ungültiger fallback_mov' }, { status: 400 });
  }

  try {
    const result = await getActiveMovForCustomer(
      locationId,
      customerHash,
      zone as ZoneName,
      fallbackMovEur,
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error('[api/delivery/mov GET]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      testId: string;
      variantId: string;
      locationId: string;
      customerHash: string;
      zone: string;
      orderTotalEur: number;
      movAppliedEur: number;
      converted: boolean;
      orderId?: string;
    };

    if (
      !body.testId ||
      !body.variantId ||
      !body.locationId ||
      !body.customerHash ||
      !VALID_ZONES.has(body.zone)
    ) {
      return NextResponse.json({ error: 'Fehlende oder ungültige Parameter' }, { status: 400 });
    }

    await recordMovEvent({
      testId:        body.testId,
      variantId:     body.variantId,
      locationId:    body.locationId,
      customerHash:  body.customerHash,
      zone:          body.zone as ZoneName,
      orderTotalEur: Number(body.orderTotalEur) || 0,
      movAppliedEur: Number(body.movAppliedEur) || 0,
      converted:     Boolean(body.converted),
      orderId:       body.orderId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/delivery/mov POST]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
