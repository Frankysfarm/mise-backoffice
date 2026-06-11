import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { BewerbungenClient } from './client';

export const dynamic = 'force-dynamic';

export default async function FahrerBewerbungenPage() {
  const emp = await requireManagerPlus();
  const sb  = await createClient();
  const svc = createServiceClient();

  const { data: empT } = await sb
    .from('employees')
    .select('tenant_id, location_id')
    .eq('id', emp.id)
    .maybeSingle();
  if (!empT?.tenant_id) redirect('/start');

  const { data: locations } = await svc
    .from('locations')
    .select('id, name')
    .eq('tenant_id', empT.tenant_id)
    .eq('aktiv', true)
    .order('name');

  const locationId = empT.location_id ?? (locations as { id: string; name: string }[])?.[0]?.id;

  return (
    <>
      <PageHeader
        title="Fahrer-Bewerbungen"
        description="Eingehende Bewerbungen prüfen, Onboarding starten und Fahrer freigeben."
      />
      <BewerbungenClient
        locations={(locations as { id: string; name: string }[]) ?? []}
        defaultLocationId={locationId ?? null}
      />
    </>
  );
}
