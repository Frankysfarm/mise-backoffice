import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requirePosAccess } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { operationsBasePath } from '@/lib/routing/operations-base-path';
import { CreateListDialog } from './create-list-dialog';

const ROLE_LABELS: Record<string, string> = {
  manager: 'Filialleiter', teamleiter: 'Teamleiter', mitarbeiter: 'Mitarbeiter', backoffice: 'Backoffice',
  admin: 'Admin', server: 'Service', bartender: 'Bar', cook: 'Küche', dishwasher: 'Spüle',
};

const WEEKDAY_SHORT = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
function scheduleLabel(weekdays: number[] | null, dueTime: string | null): string {
  const days = weekdays?.length ? weekdays.map((day) => WEEKDAY_SHORT[day]).join(' ') : 'täglich';
  return `${days} · bis ${dueTime ? String(dueTime).slice(0, 5) : '18:00'}`;
}

const TYPE_LABELS: Record<string, string> = {
  opening: 'Öffnung', closing: 'Schließung', cleaning: 'Reinigung', control: 'Kontrolle',
  production: 'Produktion', handover: 'Übergabe', hygiene_temperature: 'Hygiene / Temperatur', other: 'Sonstiges',
};

export default async function ShiftGuidesPage({ searchParams }: { searchParams?: Promise<{ typ?: string }> }) {
  const actor = await requirePosAccess();
  const canManage = ['manager', 'backoffice', 'admin'].includes(actor.rolle);
  const basePath = await operationsBasePath('/shift-guides', '/neo/app/ablaeufe/schichtleitfaeden');
  const typFilter = (await searchParams)?.typ;
  const supabase = await createClient();
  let query = supabase.from('shift_guides')
    .select('id,titel,phase,ablauf_typ,position_typ,aktiv,version,inhalt,assignment_kind,assigned_role,schedule_weekdays,due_time,department:departments(name)')
    .order('titel');
  if (typFilter && TYPE_LABELS[typFilter]) query = query.eq('ablauf_typ', typFilter);
  if (!canManage) query = query.eq('aktiv', true);
  const [{ data: guides }, { data: locations }] = await Promise.all([
    query,
    supabase.from('locations').select('id,name').order('name'),
  ]);

  return (
    <div>
      <PageHeader title="Listen & Abläufe" description="Eine Liste = Schritte mit Anleitung und Nachweis, zugeteilt an Schicht, Rolle, Bereich oder Mitarbeiter – mit Zeitplan." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {canManage && <CreateListDialog basePath={basePath} locations={locations ?? []} defaultLocationId={actor.location_id} />}
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Link href={basePath} className={`rounded-full border px-3 py-1 text-xs font-semibold no-underline ${!typFilter ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:border-muted-foreground/50'}`}>Alle</Link>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <Link key={value} href={`${basePath}?typ=${value}`} className={`rounded-full border px-3 py-1 text-xs font-semibold no-underline ${typFilter === value ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:border-muted-foreground/50'}`}>{label}</Link>
          ))}
        </div>
      </div>
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Titel</TableHead>
            <TableHead>Art</TableHead>
            <TableHead>Zuordnung</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Abteilung</TableHead>
            <TableHead className="text-right">Kategorien</TableHead>
            <TableHead className="text-right">Schritte</TableHead>
            <TableHead>Aktiv</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {guides?.map(g => {
              const cats = Array.isArray((g.inhalt as any)?.categories) ? (g.inhalt as any).categories : [];
              const steps = cats.reduce((acc: number, c: any) => acc + (c.steps?.length ?? 0), 0);
              return (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">
                    <Link href={canManage ? `${basePath}/${g.id}` : `${basePath}/${g.id}/ausfuehren`} className="hover:underline">{g.titel}</Link>
                  </TableCell>
                  <TableCell><Badge variant={g.ablauf_typ === 'opening' ? 'secondary' : 'gold'}>{TYPE_LABELS[g.ablauf_typ] ?? 'Sonstiges'}</Badge></TableCell>
                  <TableCell>
                    {(g as any).assignment_kind === 'rolle'
                      ? <Badge variant="secondary">Rolle: {ROLE_LABELS[(g as any).assigned_role as string] ?? (g as any).assigned_role}</Badge>
                      : (g as any).assignment_kind === 'bereich'
                        ? <Badge variant="secondary">Bereich</Badge>
                        : (g as any).assignment_kind === 'mitarbeiter'
                          ? <Badge variant="secondary">Mitarbeiter</Badge>
                          : <Badge variant="outline">Schicht</Badge>}
                    {(g as any).assignment_kind !== 'schicht' && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {scheduleLabel((g as any).schedule_weekdays as number[] | null, (g as any).due_time as string | null)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{g.position_typ ?? '—'}</TableCell>
                  <TableCell>{(g.department as any)?.name ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono">{cats.length}</TableCell>
                  <TableCell className="text-right font-mono">{steps}</TableCell>
                  <TableCell>{g.aktiv ? <Link className="font-medium text-primary hover:underline" href={`${basePath}/${g.id}/ausfuehren`}>Starten</Link> : '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
