import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/push/unsubscribe?t=UUID
 *   → löscht Subscription, zeigt Bestätigungs-HTML
 *
 * Aufrufbar ohne Login — Token reicht (aus Notification-Action).
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t');
  if (!token) {
    return htmlResponse('Kein Token — nichts zu tun.', false);
  }

  const svc = createServiceClient();
  const { data, error } = await svc
    .from('customer_push_subscriptions')
    .delete()
    .eq('unsubscribe_token', token)
    .select('id');

  if (error || !data || data.length === 0) {
    return htmlResponse('Subscription nicht gefunden oder schon abbestellt.', false);
  }

  return htmlResponse('Abbestellt. Du bekommst keine Push-Nachrichten mehr.', true);
}

function htmlResponse(message: string, success: boolean): NextResponse {
  const bg = success ? '#ecfdf5' : '#fef2f2';
  const fg = success ? '#064e3b' : '#7f1d1d';
  const emoji = success ? '✅' : '⚠️';
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>Abmeldung</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;background:${bg};color:${fg};display:grid;place-items:center;min-height:100vh;margin:0;padding:2rem}
.card{background:white;border:2px solid ${fg}22;border-radius:1.25rem;padding:2rem;max-width:420px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.05)}
.emoji{font-size:3rem;margin-bottom:1rem}
h1{font-size:1.25rem;margin:0 0 .5rem;font-weight:700}
p{margin:0;opacity:.8;line-height:1.5}
a{color:${fg};font-weight:600}
</style></head>
<body><div class="card">
<div class="emoji">${emoji}</div>
<h1>${message}</h1>
<p style="margin-top:1rem"><a href="/">Zurück zur Startseite</a></p>
</div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
