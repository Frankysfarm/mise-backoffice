'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { Plus, Trash2, Package } from 'lucide-react';
import { euro } from '@/lib/utils';

type Ingredient = { id: string; item_id: string; menge: number; einheit: string; item_name?: string; preis?: number | null };
type Item = { id: string; name: string; einheit: string; preis_pro_einheit: number | null };

export function RecipeIngredients({ recipeId, ingredients, inventoryItems }: {
  recipeId: string;
  ingredients: Ingredient[];
  inventoryItems: Item[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState(ingredients);

  const totalCost = rows.reduce((s, r) => {
    const item = inventoryItems.find(i => i.id === r.item_id);
    return s + r.menge * (item?.preis_pro_einheit ?? 0);
  }, 0);

  async function add(fd: FormData) {
    const itemId = fd.get('item_id') as string;
    const menge = Number(fd.get('menge'));
    const einheit = fd.get('einheit') as string;
    if (!itemId || !menge) return toastError('Produkt und Menge wählen');
    start(async () => {
      const { error } = await createClient().from('recipe_ingredients').insert({
        recipe_id: recipeId, item_id: itemId, menge, einheit,
      } as any);
      if (error) return toastError('Fehler', error.message);
      toastSuccess('Zutat verknüpft');
      router.refresh();
    });
  }

  async function del(id: string) {
    start(async () => {
      await createClient().from('recipe_ingredients').delete().eq('id', id);
      setRows(rs => rs.filter(r => r.id !== id));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2"><Package className="h-5 w-5" /> Zutaten aus Inventar</span>
          <span className="text-sm font-mono text-muted-foreground">Food-Cost: {euro(totalCost)} / Portion</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Noch keine Inventar-Verknüpfung. Verknüpfe Zutaten um Food-Cost automatisch zu berechnen.</p>
        ) : (
          <div className="space-y-2">
            {rows.map(r => {
              const item = inventoryItems.find(i => i.id === r.item_id);
              const cost = r.menge * (item?.preis_pro_einheit ?? 0);
              return (
                <div key={r.id} className="flex items-center gap-3 rounded-md border bg-card p-3">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item?.name ?? r.item_name ?? '?'}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.menge} {r.einheit} × {euro(item?.preis_pro_einheit ?? 0)} = <strong>{euro(cost)}</strong>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => del(r.id)} disabled={pending}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <form action={add} className="flex flex-wrap items-end gap-2 pt-3 border-t">
          <div className="flex-1 min-w-[200px]">
            <Label>Inventar-Produkt</Label>
            <select name="item_id" required className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— wählen —</option>
              {inventoryItems.map(i => (
                <option key={i.id} value={i.id}>{i.name} ({i.einheit}{i.preis_pro_einheit ? ` · ${euro(i.preis_pro_einheit)}` : ''})</option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <Label>Menge</Label>
            <Input name="menge" type="number" step="0.001" required placeholder="0.002" />
          </div>
          <div className="w-24">
            <Label>Einheit</Label>
            <Input name="einheit" required placeholder="kg" />
          </div>
          <Button type="submit" disabled={pending}><Plus className="h-4 w-4" /> Verknüpfen</Button>
        </form>
      </CardContent>
    </Card>
  );
}
