/**
 * POST /api/delivery/whatsapp-optin
 *
 * Öffentlicher Endpunkt: Kunden stimmen WhatsApp-Benachrichtigungen beim Checkout zu.
 * Kein Login erforderlich — location_id wird aus locationSlug aufgelöst.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { setWhatsAppOptIn } from '@/lib/delivery/whatsapp-notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { locationId?: string; phone?: string; optedIn?: boolean };
    const { locationId, phone, optedIn } = body;

    if (!locationId || !phone) {
      return NextResponse.json({ error: 'locationId und phone erforderlich' }, { status: 400 });
    }

    await setWhatsAppOptIn(locationId, phone, Boolean(optedIn), 'checkout');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}

export async function DELETE(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const phone      = req.nextUrl.searchParams.get('phone');

  if (!locationId || !phone) {
    return NextResponse.json({ error: 'location_id und phone erforderlich' }, { status: 400 });
  }

  const sb = createServiceClient();
  await sb
    .from('whatsapp_optins')
    .update({ opted_in: false, opted_out_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('location_id', locationId)
    .eq('phone', phone);

  return NextResponse.json({ ok: true });
}
