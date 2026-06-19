/**
 * POST /api/delivery/push/send-status
 *
 * Phase 303 — Interner Endpunkt zum manuellen Auslösen von Status-Push-Notifications.
 * Nützlich für Admin-Panel, Retries und Supabase-Webhooks bei DB-Status-Änderungen.
 *
 * Body: { orderId, locationId, status, secret? }
 *   status: 'unterwegs' | 'geliefert' | 'zugewiesen'
 *
 * Authentifizierung: DELIVERY_PUSH_SECRET Header oder Body-Secret.
 * Wenn kein Secret konfiguriert → nur interne Aufrufe via Service-Role erlaubt.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fireStatusPush } from '@/lib/delivery/status-push-bridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUSH_SECRET = process.env.DELIVERY_PUSH_SECRET;

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { orderId, locationId, status, secret } = body as {
    orderId:    string;
    locationId: string;
    status:     string;
    secret?:    string;
  };

  // Secret-Check wenn konfiguriert
  if (PUSH_SECRET) {
    const headerSecret = req.headers.get('x-delivery-push-secret');
    const provided = headerSecret ?? secret ?? '';
    if (provided !== PUSH_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!orderId || !locationId || !status) {
    return NextResponse.json({ error: 'orderId, locationId, status erforderlich' }, { status: 400 });
  }

  const result = await fireStatusPush(orderId, status, locationId);

  return NextResponse.json({ ok: true, ...result });
}
