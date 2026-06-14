/**
 * GET  /api/delivery/referral?customer_token=X&location_id=Y
 *   → Holt oder erstellt einen Empfehlungs-Code für den Kunden
 *
 * POST /api/delivery/referral
 *   action=validate  — prüft ob ein Code gültig ist (keine Konversion)
 *   action=apply     — legt Konversion an (beim Checkout)
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getOrCreateReferralCode,
  getReferralCode,
  applyReferralCode,
} from '@/lib/delivery/referral-program';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const customerToken = searchParams.get('customer_token');
  const locationId    = searchParams.get('location_id');

  if (!customerToken || !locationId) {
    return NextResponse.json({ error: 'customer_token und location_id erforderlich' }, { status: 400 });
  }

  try {
    const referralCode = await getOrCreateReferralCode(locationId, customerToken);
    if (!referralCode) {
      return NextResponse.json({ ok: false, enabled: false });
    }
    return NextResponse.json({ ok: true, enabled: true, code: referralCode });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = (body.action as string) ?? '';

    if (action === 'validate') {
      const code = (body.code as string | undefined)?.toUpperCase();
      if (!code) return NextResponse.json({ error: 'code erforderlich' }, { status: 400 });
      const referralCode = await getReferralCode(code);
      if (!referralCode) {
        return NextResponse.json({ ok: false, valid: false, error: 'Ungültiger Code' });
      }
      return NextResponse.json({ ok: true, valid: true, code: referralCode.code });
    }

    if (action === 'apply') {
      const code          = (body.code as string | undefined)?.toUpperCase();
      const refereeToken  = body.referee_token as string | undefined;
      const locationId    = body.location_id as string | undefined;
      const orderId       = body.order_id as string | undefined;

      if (!code || !refereeToken || !locationId) {
        return NextResponse.json({ error: 'code, referee_token und location_id erforderlich' }, { status: 400 });
      }

      const result = await applyReferralCode(code, refereeToken, locationId, orderId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
