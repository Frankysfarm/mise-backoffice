'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toastError, toastSuccess } from '@/components/ui/toaster';

type Item = { id: string; name: string; lieferant: string | null; einheit: string; preis_pro_einheit: number | null; artikelnummer: string | null; min_bestand: number | null; soll_bestand: number | null };

export function NewOrderButton({ items, locations }: { items: Item[]; locations: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [supplier, setSupplier] = useState<string>('');
  const [loc, setLoc] = useState<string>(locations[0]?.id ?? '');
  const [qty, setQty] = useState<Record<string, number>>({});

  const suppliers = useMemo(() => Array.from(new Set(items.map(i => i.lieferant).filter(Boolean))) as string[], [items]);
  const suppliedItems = useMemo(() => items.filter(i => i.lieferant === supplier), [items, supplier]);
  const total = suppliedItems.reduce((acc, i) => acc + ((qty[i.id] ?? 0) * (i.preis_pro_einheit ?? 0)), 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const positionen = suppliedItems
      .filter(i => (qty[i.id] ?? 0) > 0)
      .map(i => ({
        item_id: i.id, name: i.name, artikelnummer: i.artikelnummer,
        menge: qty[i.id], einheit: i.einheit,
        preis_pro_einheit: i.preis_pro_einheit,
      }));
    if (positionen.length === 0) { toastError('Keine Positionen', 'Bitte mindestens eine Menge > 0.'); return; }
    start(async () => {
      const { error } = await createClient().from('order_lists').insert({
        location_id: loc, lieferant: supplier,
        positionen, gesamtbetrag: total, status: 'entwurf',
      });
      if (error) return toastError('Speichern fehlgeschlagen', error.message);
      toastSuccess('Bestellliste angelegt', `${positionen.length} Position(en) für ${supplier}.`);
      setOpen(false); setQty({}); router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Neue Liste</Button></DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Neue Bestellliste</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Standort</Label>
              <select value={loc} onChange={e => setLoc(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div><Label>Lieferant</Label>
              <select value={supplier} onChange={e => setSupplier(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm" required>
                <option value="">— wählen —</option>
                {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {supplier && (
            <div className="max-h-[300px] overflow-y-auto rounded border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/70"><tr>
                  <th className="px-3 py-2 text-left">Produkt</th>
                  <th className="px-3 py-2 text-right">Min</th>
                  <th className="px-3 py-2 text-right">Soll</th>
                  <th className="px-3 py-2 text-right">€</th>
                  <th className="px-3 py-2 text-right">Menge</th>
                </tr></thead>
                <tbody>
                  {suppliedItems.map(i => (
                    <tr key={i.id} className="border-b">
                      <td className="px-3 py-2">{i.name}</td>
                      <td className="px-3 py-2 text-right font-mono">{i.min_bestand ?? '—'}</td>
                      <td className="px-3 py-2 text-right font-mono">{i.soll_bestand ?? '—'}</td>
                      <td className="px-3 py-2 text-right font-mono">{i.preis_pro_einheit ?? '—'}</td>
                      <td className="px-3 py-2">
                        <Input type="number" min="0" step="0.01" className="w-20 text-right ml-auto"
                          value={qty[i.id] ?? ''}
                          onChange={e => setQty({ ...qty, [i.id]: Number(e.target.value) })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{suppliedItems.filter(i => (qty[i.id] ?? 0) > 0).length} Position(en)</span>
            <span className="font-semibold">Gesamt: {total.toFixed(2)} €</span>
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button type="submit" disabled={pending || !supplier}>{pending ? '...' : 'Als Entwurf speichern'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
