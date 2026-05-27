'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { Trash2 } from 'lucide-react';

const GRÜNDE = [
  { value: 'abgelaufen', label: '🕐 Abgelaufen (MHD)' },
  { value: 'verdorben', label: '🤢 Verdorben' },
  { value: 'beschädigt', label: '💔 Beschädigt' },
  { value: 'überproduktion', label: '📈 Überproduktion' },
  { value: 'fehlbestellung', label: '❌ Fehlbestellung' },
  { value: 'sonstiges', label: '📝 Sonstiges' },
];

type Item = { id: string; name: string; einheit: string; preis_pro_einheit: number | null };

export function WasteForm({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [itemId, setItemId] = useState('');
  const [menge, setMenge] = useState('');
  const [grund, setGrund] = useState('abgelaufen');
  const [notiz, setNotiz] = useState('');

  const selectedItem = items.find(i => i.id === itemId);
  const wert = selectedItem?.preis_pro_einheit && menge
    ? (Number(menge) * selectedItem.preis_pro_einheit).toFixed(2)
    : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!itemId || !menge) return toastError('Produkt und Menge sind Pflicht');
    start(async () => {
      const { error } = await createClient().from('inventory_waste').insert({
        item_id: itemId,
        menge: Number(menge),
        einheit: selectedItem?.einheit ?? 'Stück',
        grund,
        wert_euro: wert ? Number(wert) : null,
        notiz: notiz || null,
      } as any);
      if (error) return toastError('Speichern fehlgeschlagen', error.message);
      toastSuccess('Schwund erfasst', `${menge} × ${selectedItem?.name}`);
      setItemId(''); setMenge(''); setNotiz('');
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trash2 className="h-4 w-4" /> Schwund erfassen</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-6 items-end">
          <div className="md:col-span-2">
            <Label>Produkt</Label>
            <select value={itemId} onChange={e => setItemId(e.target.value)} required
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— wählen —</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Menge</Label>
            <div className="flex items-center gap-1">
              <Input type="number" min="0.01" step="0.01" value={menge} onChange={e => setMenge(e.target.value)} required />
              <span className="text-xs text-muted-foreground">{selectedItem?.einheit ?? ''}</span>
            </div>
          </div>
          <div>
            <Label>Grund</Label>
            <select value={grund} onChange={e => setGrund(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {GRÜNDE.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Notiz</Label>
            <Input value={notiz} onChange={e => setNotiz(e.target.value)} placeholder="optional" />
          </div>
          <div>
            {wert && <div className="text-xs text-destructive font-semibold mb-1">≈ {wert} €</div>}
            <Button type="submit" variant="destructive" disabled={pending} className="w-full">
              {pending ? '...' : 'Erfassen'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
