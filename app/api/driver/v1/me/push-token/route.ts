import { NextRequest, NextResponse } from 'next/server';
import { badRequest, getDriverFromBearer, sb, unauthorized } from '../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  expo_push_token: string | null;
  /** wenn false: Tracking pausieren */
  push_enabled?: boolean;
}

/**
 * POST /api/driver/v1/me/push-token
 * Body: { expo_push_token: "ExponentPushToken[xxx]" | null, push_enabled? }
 *
 * Driver registriert das Push-Token vom Device. Wird nach Login + bei
 * jedem App-Start aufgerufen (Token kann sich ändern).
 *
 * Wenn der Driver „push_enabled: false" sendet (z.B. Toggle in Profile aus),
 * stoppen wir Pushes — Token bleibt aber gespeichert.
 */
export async function POST(req: NextRequest) {
  const m = await getDriverFromBearer(req);
  if (!m) return unauthorized();

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest('Ungültiges JSON');
  }

  const update: Record<string, unknown> = {};
  if (typeof body.expo_push_token === 'string' || body.expo_push_token === null) {
    update.expo_push_token = body.expo_push_token;
    update.push_token_updated_at = new Date().toISOString();
  }
  if (typeof body.push_enabled === 'boolean') {
    update.push_enabled = body.push_enabled;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await sb()
    .from('mise_drivers')
    .update(update)
    .eq('id', m.driver.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
