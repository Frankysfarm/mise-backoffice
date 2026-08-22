import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { ZReportClient } from './client';

export const dynamic = 'force-dynamic';

export default async function ZReportPage() {
  await requireManagerPlus();
  const supabase = await createClient();
  const { data: registers } = await supabase
    .from('pos_registers')
    .select('id,name,location_id,startbestand')
    .eq('aktiv', true);

  return (
    <>
      <PageHeader
        title="Z-Bericht"
        description="Tagesabschluss nach GoBD — Ist-Bestand zählen, Differenz prüfen, Tagesumsatz dokumentieren."
      />
      <ZReportClient registers={(registers as any) ?? []} />
    </>
  );
}
