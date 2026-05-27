import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RoleBadge, StatusBadge } from '@/components/role-badge';
import { Plus } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty';

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ rolle?: string; status?: string; q?: string }> }) {
  await requireManagerPlus();
  const params = await searchParams;
  const supabase = await createClient();

  let q = supabase.from('employees')
    .select('id,personalnummer,vorname,nachname,email,rolle,status,employment_type,position_typ,stundenlohn,wochenstunden,department:departments(name),location:locations(name)')
    .order('nachname');

  if (params.rolle)  q = q.eq('rolle', params.rolle);
  if (params.status) q = q.eq('status', params.status);
  if (params.q)      q = q.or(`vorname.ilike.%${params.q}%,nachname.ilike.%${params.q}%,email.ilike.%${params.q}%`);

  const { data: employees } = await q;

  return (
    <div>
      <PageHeader
        title="Mitarbeiter"
        description={`${employees?.length ?? 0} Einträge — Stammdaten, Rollen, Status.`}
        actions={<Link href="/employees/new"><Button><Plus className="h-4 w-4" /> Neu anlegen</Button></Link>}
      />

      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" placeholder="Name oder E-Mail..." defaultValue={params.q}
          className="h-9 w-64 rounded-md border bg-background px-3 text-sm" />
        <select name="rolle" defaultValue={params.rolle ?? ''} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="">Alle Rollen</option>
          <option value="admin">Admin</option>
          <option value="backoffice">Backoffice</option>
          <option value="manager">Manager</option>
          <option value="teamleiter">Teamleiter</option>
          <option value="mitarbeiter">Mitarbeiter</option>
        </select>
        <select name="status" defaultValue={params.status ?? ''} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="">Alle Status</option>
          <option value="aktiv">Aktiv</option>
          <option value="inaktiv">Inaktiv</option>
          <option value="pause">Pause</option>
          <option value="gekündigt">Gekündigt</option>
        </select>
        <Button type="submit" variant="outline" size="sm">Filtern</Button>
        <Link href="/employees"><Button type="button" variant="ghost" size="sm">Reset</Button></Link>
      </form>

      {(employees?.length ?? 0) === 0 ? (
        <EmptyState title="Keine Mitarbeiter gefunden" description="Filter anpassen oder neue Mitarbeiter anlegen." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>P-Nr.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Abteilung</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead className="text-right">Lohn €/h</TableHead>
                <TableHead className="text-right">Std./Woche</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees!.map(e => (
                <TableRow key={e.id} className="cursor-pointer">
                  <TableCell className="font-mono text-xs">{e.personalnummer ?? '—'}</TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/employees/${e.id}`} className="hover:underline">
                      {e.vorname} {e.nachname}
                    </Link>
                    <div className="text-xs text-muted-foreground">{e.email}</div>
                  </TableCell>
                  <TableCell><RoleBadge rolle={e.rolle} /></TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                  <TableCell className="text-sm">{(e.department as any)?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm">{e.employment_type ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{e.stundenlohn ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{e.wochenstunden ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
