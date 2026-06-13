/**
 * GET  /api/delivery/preferences
 *      ?email=...&address_hash=...&location_id=...
 *      Lädt gespeicherte Präferenzen für eine Adresse (Storefront / Fahrer-App)
 *
 * POST /api/delivery/preferences
 *      body: { email, address_hash, address_display?, location_id, ...prefs }
 *      Speichert / aktualisiert Zustellpräferenzen
 *
 * GET  /api/delivery/preferences?action=order&order_id=...&location_id=...
 *      Lädt Adress-Infos für einen Auftrag (Fahrer-App Stop-Karte)
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getAddressPreferences,
  getCustomerAddresses,
  getOrderAddressInfo,
  saveAddressPreferences,
  hashAddress,
} from '@/lib/delivery/address-intelligence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  // Auftragsbezogener Lookup (für Fahrer-App)
  const action = searchParams.get('action');
  if (action === 'order') {
    const orderId = searchParams.get('order_id');
    if (!orderId) return NextResponse.json({ error: 'order_id required' }, { status: 400 });
    try {
      const info = await getOrderAddressInfo(orderId, locationId);
      return NextResponse.json(info);
    } catch (err) {
      console.error('[preferences GET order]', err);
      return NextResponse.json({ preferences: null, qualityScore: 100, issueCount: 0 });
    }
  }

  // Alle gespeicherten Adressen eines Kunden
  const email = searchParams.get('email');
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const addressHash = searchParams.get('address_hash');

  try {
    if (addressHash) {
      const prefs = await getAddressPreferences(email, addressHash, locationId);
      return NextResponse.json({ preferences: prefs });
    }

    const addresses = await getCustomerAddresses(email, locationId);
    return NextResponse.json({ addresses });
  } catch (err) {
    console.error('[preferences GET]', err);
    return NextResponse.json({ preferences: null, addresses: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const locationId = body.location_id as string;
    const email = body.email as string;

    if (!locationId || !email)
      return NextResponse.json({ error: 'location_id and email required' }, { status: 400 });

    // address_hash berechnen wenn address_display übergeben
    const addressDisplay = body.address_display as string | undefined;
    const addressHash =
      (body.address_hash as string | undefined) ??
      (addressDisplay ? hashAddress(addressDisplay) : null);

    if (!addressHash)
      return NextResponse.json({ error: 'address_hash or address_display required' }, { status: 400 });

    const saved = await saveAddressPreferences(locationId, {
      customerEmail: email,
      addressHash,
      addressDisplay,
      addressLabel: body.address_label as string | undefined,
      ringBell: body.ring_bell !== undefined ? Boolean(body.ring_bell) : undefined,
      leaveAtDoor: body.leave_at_door !== undefined ? Boolean(body.leave_at_door) : undefined,
      floor: body.floor as string | undefined,
      apartment: body.apartment as string | undefined,
      gateCode: body.gate_code as string | undefined,
      buildingInfo: body.building_info as string | undefined,
      specialInstructions: body.special_instructions as string | undefined,
    });

    return NextResponse.json({ preferences: saved });
  } catch (err) {
    console.error('[preferences POST]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
