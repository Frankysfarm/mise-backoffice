import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { dateDE, dateTimeDE } from '@/lib/utils';
import { notFound } from 'next/navigation';

export default async function EquipmentDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireManagerPlus();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: eq }, { data: logs }] = await Promise.all([
    supabase.from('equipment').select('*').eq('id', id).maybeSingle(),
    supabase.from('equipment_logs').select('*,employee:employees!equipment_logs_employee_id_fkey(vorname,nachname)').eq('equipment_id', id).order('created_at', { ascending: false }),
  ]);
  if (!eq) notFound();
  return (
    <div>
      <PageHeader backHref="/equipment" title={eq.name}
        description={`${eq.kategorie ?? '—'} · ${eq.hersteller ?? '—'} · SN ${eq.seriennummer ?? '—'}`}
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Info label="Status" value={<Badge>{eq.status}</Badge>} />
        <Info label="Wartungsintervall" value={`${eq.wartungsintervall_tage ?? '—'} Tage`} />
        <Info label="Anschaffung" value={dateDE(eq.anschaffungsdatum)} />
        <Info label="Garantie bis" value={dateDE(eq.garantie_bis)} />
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Wartungshistorie</CardTitle></CardHeader>
        <CardContent>
          {(logs?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Logs erfasst.</p>
          ) : (
            <ul className="divide-y">
              {logs!.map((l, i) => (
                <li key={i} className="py-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{l.typ}</Badge>
                    <span className="text-xs text-muted-foreground">{dateTimeDE(l.created_at)}</span>
                    {l.employee && <span className="text-xs text-muted-foreground">· {(l.employee as any).vorname} {(l.employee as any).nachname}</span>}
                  </div>
                  <p className="mt-1 text-sm">{l.beschreibung ?? '—'}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </CardContent></Card>
  );
}
