import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getSignedUrl } from '@/lib/voice-orders/elevenlabs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/voice-orders/test-url
 *
 * Liefert eine signed URL, mit der das Browser-Test-Widget eine
 * direkte Konversation zum eigenen Agent starten kann (kein Twilio
 * nötig).
 */
export async function GET() {
  const sb = await createClient();
  const { data: userRes } = await sb.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const { data: emp } = await sb
    .from('employees')
    .select('tenant_id, rolle')
    .eq('id', userRes.user.id)
    .maybeSingle();
  if (!emp?.tenant_id) {
    return NextResponse.json({ error: 'no tenant' }, { status: 403 });
  }

  const svc = createServiceClient();
  const { data: tenant } = await svc
    .from('tenants')
    .select('voice_orders_elevenlabs_agent_id')
    .eq('id', emp.tenant_id)
    .single();

  if (!tenant?.voice_orders_elevenlabs_agent_id) {
    return NextResponse.json({ error: 'agent not setup' }, { status: 400 });
  }

  try {
    const signedUrl = await getSignedUrl(tenant.voice_orders_elevenlabs_agent_id);
    return NextResponse.json({
      signedUrl,
      agentId: tenant.voice_orders_elevenlabs_agent_id,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'elevenlabs', detail: String(err) },
      { status: 502 },
    );
  }
}
