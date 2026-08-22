import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { LocationsEditor } from './editor';

export default async function LocationsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from('locations').select('*').order('name');
  return (
    <div>
      <PageHeader title="Standorte" description="Adressen, GPS-Koordinaten, Geofence-Radius für Stempel." />
      <LocationsEditor locations={data ?? []} />
    </div>
  );
}
