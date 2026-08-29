import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  TABLE_SESSION_COOKIE,
  hashTableSessionSecret,
  isSameOriginRequest,
  privateFingerprint,
  tableSessionCookieValue,
  tableSessionSecret,
} from '@/lib/orders/table-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Origin nicht erlaubt' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const qrToken = String(body?.qrToken ?? '').trim();
  const universalToken = String(body?.universalToken ?? '').trim();
  const requestedTableId = String(body?.tableId ?? '').trim();
  const hasTableQr = /^[0-9a-f-]{36}$/i.test(qrToken);
  const hasUniversalQr = /^[0-9a-f-]{36}$/i.test(universalToken)
    && /^[0-9a-f-]{36}$/i.test(requestedTableId);
  if (!hasTableQr && !hasUniversalQr) {
    return NextResponse.json({ error: 'QR-Code ungültig' }, { status: 400 });
  }

  const service = createServiceClient();
  let universalLocationId: string | null = null;
  if (hasUniversalQr) {
    const { data: location } = await service
      .from('locations')
      .select('id')
      .eq('universal_qr_token', universalToken)
      .maybeSingle();
    universalLocationId = location?.id ?? null;
    if (!universalLocationId) {
      return NextResponse.json({ error: 'QR-Code ungültig' }, { status: 404 });
    }
  }

  let tableQuery = service
    .from('restaurant_tables')
    .select('id,tenant_id,location_id,aktiv,status,qr_version,qr_disabled_at,session_ttl_minutes,service_confirmation_required');
  tableQuery = hasTableQr
    ? tableQuery.eq('qr_token', qrToken)
    : tableQuery.eq('id', requestedTableId).eq('location_id', universalLocationId!);
  const { data: table } = await tableQuery.maybeSingle();
  if (!table?.aktiv || table.qr_disabled_at || table.status === 'gesperrt') {
    return NextResponse.json({ error: 'Dieser Tisch-QR-Code ist nicht aktiv.' }, { status: 404 });
  }

  const secret = tableSessionSecret();
  const ttlMinutes = Math.max(15, Math.min(720, Number(table.session_ttl_minutes ?? 180)));
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  // A location-wide QR lets the guest pick a table. It therefore always needs
  // an explicit confirmation from service before orders can be placed.
  const status = hasUniversalQr || table.service_confirmation_required
    ? 'wartet_auf_bestaetigung'
    : 'aktiv';
  const { data: session, error } = await service
    .from('table_sessions')
    .insert({
      tenant_id: table.tenant_id,
      location_id: table.location_id,
      table_id: table.id,
      qr_version: table.qr_version,
      token_hash: hashTableSessionSecret(secret),
      status,
      expires_at: expiresAt.toISOString(),
      ip_hash: privateFingerprint(secret, forwarded),
      user_agent_hash: privateFingerprint(secret, request.headers.get('user-agent')),
    })
    .select('id,status,expires_at')
    .single();
  if (error || !session) {
    return NextResponse.json({ error: 'Tischsitzung konnte nicht gestartet werden.' }, { status: 500 });
  }

  const response = NextResponse.json({
    sessionId: session.id,
    status: session.status,
    expiresAt: session.expires_at,
  }, { status: 201 });
  response.cookies.set(TABLE_SESSION_COOKIE, tableSessionCookieValue(session.id, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/order',
    maxAge: ttlMinutes * 60,
  });
  response.headers.set('Cache-Control', 'no-store, private');
  return response;
}
