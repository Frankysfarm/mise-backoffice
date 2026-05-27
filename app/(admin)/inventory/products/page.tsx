import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty';
import { euro } from '@/lib/utils';
import { Plus } from 'lucide-react';

function ampel(bestand: number | null, min: number | null): { label: string; variant: 'secondary' | 'gold' | 'destructive' | 'muted' } {
  if (bestand === null) return { label: '?', variant: 'muted' };
  if (bestand <= 0) return { label: 'Leer', variant: 'destructive' };
  if (min !== null && bestand < min) return { label: 'Unter Min.', variant: 'destructive' };
  if (min !== null && bestand < min * 1.3) return { label: 'Niedrig', variant: 'gold' };
  return { label: 'OK', variant: 'secondary' };
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; area?: string }> }) {
  await requireManagerPlus();
  const params = await searchParams;
  const supabase = await createClient();

  let q = supabase.from('inventory_items')
    .select('*,area:inventory_areas(name),supplier:suppliers(name)')
    .eq('aktiv', true).order('name');
  if (params.area) q = q.eq('area_id', params.area);
  if (params.q) q = q.or(`name.ilike.%${params.q}%,artikelnummer.ilike.%${params.q}%`);
  const { data: items } = await q;
  const { data: areas } = await supabase.from('inventory_areas').select('id,name').order('name');

  return (
    <div>
      <PageHeader
        backHref="/inventory"
        title="Produkte"
        description={`${(items ?? []).length} aktive Produkte. Ampel zeigt Bestandsstatus.`}
        actions={<Link href="/inventory/products/new"><Button><Plus className="h-4 w-4" /> Neu</Button></Link>}
      />

      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" placeholder="Suche nach Name/Art.-Nr." defaultValue={params.q}
          className="h-9 w-72 rounded-md border bg-background px-3 text-sm" />
        <select name="area" defaultValue={params.area ?? ''} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="">Alle Bereiche</option>
          {areas?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <Button type="submit" variant="outline" size="sm">Filtern</Button>
      </form>

      {(items ?? []).length === 0 ? (
        <EmptyState title="Keine Produkte gefunden" />
      ) : (
        <Card>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Ampel</TableHead>
              <TableHead>Art.-Nr.</TableHead>
              <TableHead>Produkt</TableHead>
              <TableHead>Bereich</TableHead>
              <TableHead>Lieferant</TableHead>
              <TableHead className="text-right">Bestand</TableHead>
              <TableHead className="text-right">Min.</TableHead>
              <TableHead className="text-right">Soll</TableHead>
              <TableHead className="text-right">Preis/Einh.</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(items ?? []).map((i: any) => {
                const a = ampel(i.letzte_inventur, i.min_bestand);
                return (
                  <TableRow key={i.id}>
                    <TableCell><Badge variant={a.variant}>{a.label}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{i.artikelnummer ?? '—'}</TableCell>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell>{i.area?.name ?? '—'}</TableCell>
                    <TableCell>{i.supplier?.name ?? i.lieferant ?? '—'}</TableCell>
                    <TableCell className={`text-right font-mono ${a.variant === 'destructive' ? 'text-destructive font-bold' : ''}`}>
                      {i.letzte_inventur ?? '—'} {i.einheit}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{i.min_bestand ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{i.soll_bestand ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono">{i.preis_pro_einheit ? euro(i.preis_pro_einheit) : '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
