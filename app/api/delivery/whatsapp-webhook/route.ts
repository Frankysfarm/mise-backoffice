/**
 * GET  /api/delivery/whatsapp-webhook  — Meta Webhook Verification
 * POST /api/delivery/whatsapp-webhook  — Meta Status Callbacks
 *
 * Meta sendet Delivery/Read-Status-Updates und eingehende Nachrichten hierher.
 * WEBHOOK_VERIFY_TOKEN muss in Meta Business Suite konfiguriert werden.
 */
import { NextRequest, NextResponse } from 'next/server';
import { handleMetaWebhookStatus, setWhatsAppOptIn } from '@/lib/delivery/whatsapp-notify';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? 'mise-whatsapp-verify';

// ── GET: Hub Verification ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const mode      = req.nextUrl.searchParams.get('hub.mode');
  const token     = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// ── POST: Status Callbacks + Incoming Messages ────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as MetaWebhookPayload;

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;
        const value = change.value;

        // Delivery/Read status updates
        for (const status of value.statuses ?? []) {
          const newStatus = mapMetaStatus(status.status);
          if (newStatus) {
            await handleMetaWebhookStatus(status.id, newStatus).catch(() => {});
          }
        }

        // Incoming messages: handle STOP / opt-out keywords
        for (const msg of value.messages ?? []) {
          if (msg.type !== 'text') continue;
          const text = (msg.text?.body ?? '').trim().toUpperCase();
          if (['STOP', 'OPT-OUT', 'ABBESTELLEN', 'NEIN'].includes(text)) {
            const phone = msg.from;
            // Opt out from all locations (best-effort)
            const sb = createServiceClient();
            const { data: locations } = await sb.from('locations').select('id').limit(20);
            for (const loc of locations ?? []) {
              await setWhatsAppOptIn(loc.id, phone, false, 'sms_reply').catch(() => {});
            }
          }
        }
      }
    }
  } catch {
    // never 500 to Meta — always 200
  }

  return NextResponse.json({ ok: true });
}

// ── Typen ────────────────────────────────────────────────────────────────────

interface MetaWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      field: string;
      value: {
        statuses?: Array<{ id: string; status: string }>;
        messages?: Array<{ from: string; type: string; text?: { body: string } }>;
      };
    }>;
  }>;
}

function mapMetaStatus(s: string): 'delivered' | 'read' | 'failed' | null {
  if (s === 'delivered') return 'delivered';
  if (s === 'read')      return 'read';
  if (s === 'failed')    return 'failed';
  return null;
}
