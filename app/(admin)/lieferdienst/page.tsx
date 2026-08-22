import { LieferdienstClient } from './client';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Lieferdienst-Display · Mise' };

export default async function LieferdienstPage() {
  const employee = await requireManagerPlus();
  if (!employee.tenant_id) redirect('/start');

  let locationId = employee.location_id;
  if (!locationId) {
    const { data: location } = await createServiceClient()
      .from('locations')
      .select('id')
      .eq('tenant_id', employee.tenant_id)
      .eq('aktiv', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    locationId = location?.id ?? null;
  }
  if (!locationId) redirect('/start?reason=missing-location');

  return (
    <LieferdienstClient
      tenantId={employee.tenant_id}
      locationId={locationId}
      staff={{
        id: employee.id,
        name: [employee.vorname, employee.nachname].filter(Boolean).join(' ') || 'Küche',
        pin: '',
        role: employee.rolle === 'manager' ? 'manager' : 'admin',
        active: true,
      }}
    />
  );
}
