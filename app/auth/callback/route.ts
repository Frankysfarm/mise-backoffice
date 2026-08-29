import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolvePasswordRecoveryOrigin, sanitizeAuthNext } from '@/lib/auth/password-recovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /auth/callback?code=...&next=...
 *
 * OAuth callback (Google etc.). Tauscht den `code` gegen Session,
 * leitet danach auf `next` weiter.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const publicOrigin = resolvePasswordRecoveryOrigin(req.url, req.headers);
  const code = url.searchParams.get('code');
  const next = sanitizeAuthNext(url.searchParams.get('next'));

  if (code) {
    const sb = await createClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/login?reason=auth_failed`, publicOrigin));
    }
  }

  return NextResponse.redirect(new URL(next, publicOrigin));
}
