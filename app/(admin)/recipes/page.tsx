import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { euro } from '@/lib/utils';

export default async function RecipesPage() {
  await requireManagerPlus();
  const supabase = await createClient();
  const { data: recipes } = await supabase.from('recipes')
    .select('id,name,kategorie,beschreibung,preis,kalorien_pro_portion,schwierigkeit,zubereitungszeit_min,tags,aktiv,allergene:recipe_allergens(allergen)')
    .order('name');

  return (
    <div>
      <PageHeader title="Rezepte" description={`${recipes?.length ?? 0} Rezepte.`}
        actions={<Link href="/recipes/new"><Button><Plus className="h-4 w-4" /> Neu</Button></Link>}
      />
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Kategorie</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead className="text-right">Preis</TableHead>
            <TableHead className="text-right">kcal</TableHead>
            <TableHead>Schwierigkeit</TableHead>
            <TableHead className="text-right">Zeit (Min.)</TableHead>
            <TableHead>Allergene</TableHead>
            <TableHead>Aktiv</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {recipes?.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium"><Link href={`/recipes/${r.id}`} className="hover:underline">{r.name}</Link></TableCell>
                <TableCell>{r.kategorie ?? '—'}</TableCell>
                <TableCell>{(r.tags ?? []).map((t: string) => <Badge key={t} variant="muted" className="mr-1">{t}</Badge>)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{r.preis ? euro(r.preis) : '—'}</TableCell>
                <TableCell className="text-right font-mono text-sm">{r.kalorien_pro_portion ?? '—'}</TableCell>
                <TableCell>{r.schwierigkeit ?? '—'}</TableCell>
                <TableCell className="text-right">{r.zubereitungszeit_min ?? '—'}</TableCell>
                <TableCell>{(r.allergene ?? []).map((a: any) => <Badge key={a.allergen} variant="destructive" className="mr-1">{a.allergen}</Badge>)}</TableCell>
                <TableCell>{r.aktiv ? '✓' : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
