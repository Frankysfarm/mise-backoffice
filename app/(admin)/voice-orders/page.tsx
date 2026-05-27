import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { VoiceOrdersSetup } from './client';

export const dynamic = 'force-dynamic';

export default async function VoiceOrdersPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const { data: empT } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('id', emp.id)
    .maybeSingle();
  if (!empT?.tenant_id) redirect('/start');

  // Modul-Status checken
  const svc = createServiceClient();
  const { data: tenantModule } = await svc
    .from('tenant_modules')
    .select('status, aktiv')
    .eq('tenant_id', empT.tenant_id)
    .eq('module_id', 'voice_orders')
    .maybeSingle();

  if (!tenantModule || !tenantModule.aktiv) {
    redirect('/modules?locked=voice_orders');
  }

  const { data: tenant } = await svc
    .from('tenants')
    .select(
      'id, name, voice_orders_aktiv, voice_orders_voice_id, voice_orders_first_message, voice_orders_elevenlabs_agent_id, voice_orders_elevenlabs_phone_number_id, voice_orders_twilio_phone_number, voice_orders_setup_completed_at',
    )
    .eq('id', empT.tenant_id)
    .single();

  const { count: callCount } = await svc
    .from('voice_calls')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', empT.tenant_id);

  return (
    <>
      <PageHeader
        title="Telefon-KI"
        description="KI nimmt Anrufe entgegen und schreibt Bestellungen direkt in den Liefer-Flow."
        backHref="/"
      />
      <VoiceOrdersSetup
        tenantName={tenant?.name ?? ''}
        currentVoiceId={tenant?.voice_orders_voice_id ?? null}
        currentFirstMessage={tenant?.voice_orders_first_message ?? null}
        agentId={tenant?.voice_orders_elevenlabs_agent_id ?? null}
        phoneNumberId={tenant?.voice_orders_elevenlabs_phone_number_id ?? null}
        twilioPhone={tenant?.voice_orders_twilio_phone_number ?? null}
        setupCompletedAt={tenant?.voice_orders_setup_completed_at ?? null}
        callCount={callCount ?? 0}
      />
    </>
  );
}
