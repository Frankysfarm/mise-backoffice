'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Wysiwyg } from '@/components/ui/wysiwyg';

const ALLERGENS = ['gluten','laktose','ei','soja','nuss','erdnuss','sellerie','senf','sesam','fisch','krebstiere','weichtiere','schwefel','lupine'] as const;

export function RecipeEditor({ recipe, allergens }: { recipe: any; allergens: { allergen: string; spuren: boolean }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: recipe.name,
    kategorie: recipe.kategorie ?? '',
    beschreibung: recipe.beschreibung ?? '',
    preis: recipe.preis ?? '',
    kalorien_pro_portion: recipe.kalorien_pro_portion ?? '',
    schwierigkeit: recipe.schwierigkeit ?? 'easy',
    zubereitungszeit_min: recipe.zubereitungszeit_min ?? '',
    ziel_temperatur_c: recipe.ziel_temperatur_c ?? '',
    zutaten: JSON.stringify(recipe.zutaten ?? [], null, 2),
    zubereitung: recipe.zubereitung ?? '',
    aktiv: recipe.aktiv ?? true,
  });
  const [selAllergens, setAllergens] = useState<Record<string, boolean>>(
    Object.fromEntries(allergens.map(a => [a.allergen, true])),
  );

  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    let zutaten;
    try { zutaten = JSON.parse(form.zutaten); } catch { setMsg('Zutaten-JSON ungültig'); return; }
    const sb = createClient();
    start(async () => {
      const { error } = await sb.from('recipes').update({
        name: form.name, kategorie: form.kategorie || null,
        beschreibung: form.beschreibung || null,
        preis: form.preis ? Number(form.preis) : null,
        kalorien_pro_portion: form.kalorien_pro_portion ? Number(form.kalorien_pro_portion) : null,
        schwierigkeit: form.schwierigkeit,
        zubereitungszeit_min: form.zubereitungszeit_min ? Number(form.zubereitungszeit_min) : null,
        ziel_temperatur_c: form.ziel_temperatur_c ? Number(form.ziel_temperatur_c) : null,
        zutaten, zubereitung: form.zubereitung, aktiv: form.aktiv,
      }).eq('id', recipe.id);
      if (error) { setMsg(error.message); return; }

      // Allergene neu setzen
      await sb.from('recipe_allergens').delete().eq('recipe_id', recipe.id);
      const inserts = Object.entries(selAllergens).filter(([,v]) => v).map(([allergen]) => ({ recipe_id: recipe.id, allergen, spuren: false }));
      if (inserts.length) await sb.from('recipe_allergens').insert(inserts);

      setMsg('Gespeichert ✓');
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
      <Card>
        <CardContent className="p-6">
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <F label="Name"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></F>
              <F label="Kategorie"><Input value={form.kategorie} onChange={e => setForm({ ...form, kategorie: e.target.value })} placeholder="Heißgetränk" /></F>
              <F label="Preis €"><Input type="number" step="0.10" value={form.preis} onChange={e => setForm({ ...form, preis: e.target.value as any })} /></F>
              <F label="kcal pro Portion"><Input type="number" value={form.kalorien_pro_portion} onChange={e => setForm({ ...form, kalorien_pro_portion: e.target.value as any })} /></F>
              <F label="Schwierigkeit">
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.schwierigkeit} onChange={e => setForm({ ...form, schwierigkeit: e.target.value })}>
                  <option value="easy">easy</option>
                  <option value="medium">medium</option>
                  <option value="hard">hard</option>
                </select>
              </F>
              <F label="Zubereitungszeit (Min.)"><Input type="number" value={form.zubereitungszeit_min} onChange={e => setForm({ ...form, zubereitungszeit_min: e.target.value as any })} /></F>
              <F label="Ziel-Temperatur °C"><Input type="number" value={form.ziel_temperatur_c} onChange={e => setForm({ ...form, ziel_temperatur_c: e.target.value as any })} /></F>
              <label className="flex items-end gap-2 text-sm"><input type="checkbox" checked={form.aktiv} onChange={e => setForm({ ...form, aktiv: e.target.checked })} /> Aktiv</label>
            </div>
            <F label="Beschreibung"><Textarea className="font-sans" rows={2} value={form.beschreibung} onChange={e => setForm({ ...form, beschreibung: e.target.value })} /></F>
            <F label="Zutaten (JSON-Array: {menge, name})">
              <Textarea rows={8} value={form.zutaten} onChange={e => setForm({ ...form, zutaten: e.target.value })} />
            </F>
            <F label="Zubereitung">
              <Wysiwyg
                value={form.zubereitung || ''}
                onChange={html => setForm({ ...form, zubereitung: html })}
                placeholder="Schritt 1. Zutaten vorbereiten …"
                minHeight={220}
              />
            </F>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={pending}>{pending ? 'Speichere...' : 'Speichern'}</Button>
              {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Allergene</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {ALLERGENS.map(a => (
            <label key={a} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!selAllergens[a]} onChange={e => setAllergens({ ...selAllergens, [a]: e.target.checked })} />
              <span className="capitalize">{a}</span>
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
