import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /auth/qr-login?t=TOKEN
 *
 * One-Time-QR-Login für Kiosk-Geräte (fest installierte iPads/iPhones).
 *
 * Reihenfolge (wichtig): erst Session erzeugen, DANN Token markieren.
 * So kann der User bei Netzwerk-Glitches oder iOS-Preview-Fetches retryen
 * ohne dass der Token verbrannt ist.
 */
export async function GET(req: NextRequest) {
  const reqUrl = new URL(req.url);
  const origin = publicOrigin(req);
  const baseUrl = new URL(reqUrl.pathname + reqUrl.search, origin);

  const token = baseUrl.searchParams.get('t');
  if (!token) return loginError(origin, 'fehlender Token');

  const svc = createServiceClient();

  const { data: tokenRow } = await svc
    .from('kiosk_login_tokens')
    .select('id, employee_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle();

  if (!tokenRow) return loginError(origin, 'Token ungültig');
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return loginError(origin, 'Token abgelaufen');
  }

  // Grace-Period: wenn vor < 90s vom gleichen Gerät verwendet, trotzdem zulassen
  // (deckt iOS-Link-Preview, Doppelklick + Netzwerk-Glitch ab)
  const usedAt = tokenRow.used_at ? new Date(tokenRow.used_at).getTime() : 0;
  const usedRecently = usedAt > 0 && Date.now() - usedAt < 90_000;
  if (tokenRow.used_at && !usedRecently) {
    return loginError(origin, 'Token bereits verwendet');
  }

  const { data: kiosk } = await svc
    .from('employees')
    .select('email, auth_user_id')
    .eq('id', tokenRow.employee_id)
    .maybeSingle();

  if (!kiosk?.email || !kiosk?.auth_user_id) {
    return loginError(origin, 'Kiosk-Account nicht gefunden');
  }

  // Wenn schon als Kiosk-User eingeloggt (z.B. iOS Preview-Fetch hat Cookie schon gesetzt)
  // → einfach redirecten, kein neuer Magic-Link (würde Supabase-Rate-Limit triggern)
  const sb = await createClient();
  const { data: existing } = await sb.auth.getUser();
  if (existing?.user && existing.user.id === kiosk.auth_user_id) {
    await markTokenUsed(svc, tokenRow.id, tokenRow.used_at, req);
    return NextResponse.redirect(new URL('/pos/inbox', origin));
  }

  // Magic-Link generieren → liefert hashed_token
  const { data: linkData, error: linkErr } = await (svc as any).auth.admin.generateLink({
    type: 'magiclink',
    email: kiosk.email,
  });

  if (linkErr || !linkData?.properties?.hashed_token) {
    return loginError(origin, 'Magic-Link konnte nicht erzeugt werden');
  }

  // Session server-seitig erzeugen → Cookies werden via @supabase/ssr gesetzt
  const { data: verifyData, error: verifyErr } = await (sb as any).auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });

  if (verifyErr || !verifyData?.session) {
    const msg = verifyErr?.message ?? '';
    if (msg.includes('rate') || (verifyErr as any)?.status === 429) {
      return loginError(origin, 'Zu viele Anfragen — bitte 60 Sek warten und neuen QR generieren');
    }
    return loginError(origin, 'Session konnte nicht erzeugt werden');
  }

  // ERST jetzt markieren — Best-Effort. Bei Race-Condition kann Token nochmal
  // verwendet werden (innerhalb 90s Grace). Das ist OK: ein Kiosk-User loggt
  // sich höchstens 1x parallel ein, mehrere Sessions sind unproblematisch.
  await markTokenUsed(svc, tokenRow.id, tokenRow.used_at, req);

  return NextResponse.redirect(new URL('/pos/inbox', origin));
}

async function markTokenUsed(
  svc: ReturnType<typeof createServiceClient>,
  tokenId: string,
  previousUsedAt: string | null,
  req: NextRequest,
) {
  await svc
    .from('kiosk_login_tokens')
    .update({
      used_at: previousUsedAt ?? new Date().toISOString(),
      used_ip: req.headers.get('x-forwarded-for') ?? null,
      used_user_agent: req.headers.get('user-agent') ?? null,
    })
    .eq('id', tokenId);
}

function publicOrigin(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'mise-gastro.de';
  return `${proto}://${host}`;
}

function loginError(origin: string, reason: string): NextResponse {
  const target = new URL('/login', origin);
  target.searchParams.set('reason', 'qr_failed');
  target.searchParams.set('qr_error', reason);
  return NextResponse.redirect(target);
}
