/**
 * POST /api/driver/v1/me/voip-token
 *
 * Phase 4 (2026-05-06): App registriert ihren PushKit VoIP-Token nach Login.
 * Body: { token: string }   (hex-string, kommt aus react-native-voip-push-notification)
 *
 * Auth: Bearer-Token vom eingeloggten Driver (Supabase-JWT oder legacy).
 *
 * Idempotent: identischer Token wird nicht nochmal geschrieben.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb, unauthorized } from '../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  token?: string;
  /** falls App die Registrierung explizit zurücknimmt (Logout) */
  clear?: boolean;
}

export async function POST(req: NextRequest) {
  const m = await getDriverFromBearer(req);
  if (!m) return unauthorized();

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 });
  }

  const c = sb();

  if (body.clear) {
    await c
      .from('mise_drivers')
      .update({ voip_push_token: null, voip_push_token_updated_at: new Date().toISOString() })
      .eq('id', m.driver.id);
    return NextResponse.json({ ok: true, cleared: true });
  }

  const token = (body.token ?? '').trim();
  if (!/^[A-Fa-f0-9]{40,200}$/.test(token)) {
    return NextResponse.json({ error: 'Token-Format ungültig' }, { status: 400 });
  }

  await c
    .from('mise_drivers')
    .update({
      voip_push_token: token.toLowerCase(),
      voip_push_token_updated_at: new Date().toISOString(),
    })
    .eq('id', m.driver.id);

  return NextResponse.json({ ok: true });
}
