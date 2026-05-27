import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getConversationAudioUrl } from '@/lib/voice-orders/elevenlabs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/voice-orders/webhook/elevenlabs
 *
 * ElevenLabs sendet bei `conversation.started`, `conversation.ended`,
 * `conversation.escalated` einen POST hierher. Wir mappen die agent_id
 * auf den Tenant und schreiben den Anruf in `voice_calls`.
 *
 * TODO: HMAC-Signatur prüfen (`x-elevenlabs-signature`).
 */
export async function POST(req: NextRequest) {
  const event = (await req.json().catch(() => null)) as
    | {
        type?: string;
        conversation_id?: string;
        agent_id?: string;
        call?: {
          caller_phone?: string;
          duration_secs?: number;
          status?: string;
          transcript?: Array<{ role: string; message: string }>;
        };
      }
    | null;

  if (!event?.conversation_id || !event.agent_id) {
    return NextResponse.json({ ok: false, reason: 'missing_ids' }, { status: 200 });
  }

  const svc = createServiceClient();

  const { data: tenant } = await svc
    .from('tenants')
    .select('id')
    .eq('voice_orders_elevenlabs_agent_id', event.agent_id)
    .maybeSingle();

  if (!tenant) {
    return NextResponse.json({ ok: false, reason: 'tenant_not_found' }, { status: 200 });
  }

  if (event.type === 'conversation.started') {
    await svc.from('voice_calls').upsert(
      {
        tenant_id: tenant.id,
        conversation_id: event.conversation_id,
        agent_id: event.agent_id,
        caller_phone: event.call?.caller_phone ?? null,
        status: 'in_progress',
      },
      { onConflict: 'conversation_id' },
    );
    return NextResponse.json({ ok: true });
  }

  if (event.type === 'conversation.ended') {
    const transcript = (event.call?.transcript ?? []).map((t) => ({
      role: t.role === 'agent' ? 'agent' : 'user',
      content: t.message,
    }));

    let recordingUrl: string | null = null;
    try {
      recordingUrl = await getConversationAudioUrl(event.conversation_id);
    } catch {}

    await svc.from('voice_calls').upsert(
      {
        tenant_id: tenant.id,
        conversation_id: event.conversation_id,
        agent_id: event.agent_id,
        status: event.call?.status === 'failed' ? 'failed' : 'completed',
        ended_at: new Date().toISOString(),
        duration_sec: event.call?.duration_secs ?? null,
        transcript,
        recording_url: recordingUrl,
      },
      { onConflict: 'conversation_id' },
    );
    return NextResponse.json({ ok: true });
  }

  if (event.type === 'conversation.escalated') {
    await svc.from('voice_calls').upsert(
      {
        tenant_id: tenant.id,
        conversation_id: event.conversation_id,
        agent_id: event.agent_id,
        status: 'escalated',
        notes: 'Anrufer wollte Mensch sprechen — ans Personal weitergeleitet.',
      },
      { onConflict: 'conversation_id' },
    );
  }

  return NextResponse.json({ ok: true });
}
