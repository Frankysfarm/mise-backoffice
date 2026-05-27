'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewRecipe() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const { data, error } = await createClient().from('recipes').insert({
        name: fd.get('name'),
        kategorie: fd.get('kategorie') || null,
        preis: fd.get('preis') ? Number(fd.get('preis')) : null,
        schwierigkeit: fd.get('schwierigkeit') || 'easy',
        portionen: 1, zutaten: [], zubereitung: '', aktiv: true,
      }).select('id').single();
      if (error) return setErr(error.message);
      router.push(`/recipes/${data!.id}`);
    });
  }

  return (
    <div>
      <PageHeader backHref="/recipes" title="Neues Rezept" />
      <Card><CardContent className="p-6">
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Name</Label><Input name="name" required /></div>
          <div><Label>Kategorie</Label><Input name="kategorie" placeholder="Heißgetränk" /></div>
          <div><Label>Preis €</Label><Input name="preis" type="number" step="0.10" /></div>
          <div className="col-span-2"><Label>Schwierigkeit</Label>
            <select name="schwierigkeit" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option>
            </select>
          </div>
          {err && <p className="col-span-2 text-sm text-destructive">{err}</p>}
          <Button type="submit" disabled={pending} className="col-span-2 w-fit">{pending ? '...' : 'Anlegen & bearbeiten'}</Button>
        </form>
      </CardContent></Card>
    </div>
  );
}
