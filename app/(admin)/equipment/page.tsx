import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { EquipmentEditor } from './editor';

export default async function EquipmentPage() {
  await requireManagerPlus();
  const supabase = await createClient();
  const [{ data: items }, { data: locs }] = await Promise.all([
    supabase.from('equipment').select('*').order('name'),
    supabase.from('locations').select('id,name').order('name'),
  ]);
  return (
    <div>
      <PageHeader title="Geräte" description={`${items?.length ?? 0} Geräte mit Wartungsintervall und Logs.`} />
      <EquipmentEditor equipment={items ?? []} locations={locs ?? []} />
    </div>
  );
}
