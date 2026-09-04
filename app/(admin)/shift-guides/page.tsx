import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requirePosAccess } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { operationsBasePath } from '@/lib/routing/operations-base-path';

const ROLE_LABELS: Record<string, string> = {
  manager: 'Filialleiter', teamleiter: 'Teamleiter', mitarbeiter: 'Mitarbeiter', backoffice: 'Backoffice',
  admin: 'Admin', server: 'Service', bartender: 'Bar', cook: 'Küche', dishwasher: 'Spüle',
};

const TYPE_LABELS: Record<string, string> = {
  opening: 'Öffnung', closing: 'Schließung', cleaning: 'Reinigung', control: 'Kontrolle',
  production: 'Produktion', handover: 'Übergabe', hygiene_temperature: 'Hygiene / Temperatur', other: 'Sonstiges',
};

export default async function ShiftGuidesPage() {
  const actor = await requirePosAccess();
  const canManage = ['manager', 'backoffice', 'admin'].includes(actor.rolle);
  const basePath = await operationsBasePath('/shift-guides', '/neo/app/ablaeufe/schichtleitfaeden');
  const supabase = await createClient();
  const { data: guides } = await supabase.from('shift_guides')
    .select('id,titel,phase,ablauf_typ,position_typ,aktiv,version,inhalt,assignment_kind,assigned_role,department:departments(name)')
    .order('titel');

  return (
    <div>
      <PageHeader title="Listen & Abläufe" description="Checklisten mit Schritt-Anleitung (Bilder/Videos, Foto-Nachweis) – gekoppelt an Schichten, Rollen oder einzelne Mitarbeiter." />
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
                      : (g as any).assignment_kind === 'mitarbeiter'
                        ? <Badge variant="secondary">Mitarbeiter</Badge>
                        : <Badge variant="outline">Schicht</Badge>}
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
