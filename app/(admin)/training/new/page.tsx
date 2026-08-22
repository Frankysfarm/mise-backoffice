'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewTrainingModule() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const { data, error } = await createClient().from('training_modules').insert({
        titel: fd.get('titel'),
        kategorie: fd.get('kategorie') || null,
        position_typ: fd.get('position_typ') || null,
        dauer_minuten: fd.get('dauer_minuten') ? Number(fd.get('dauer_minuten')) : null,
        reihenfolge: fd.get('reihenfolge') ? Number(fd.get('reihenfolge')) : null,
        pflicht: fd.get('pflicht') === 'on', aktiv: true,
        inhalt: { lessons: [] },
      }).select('id').single();
      if (error) return setErr(error.message);
      router.push(`/training/${data!.id}`);
    });
  }

  return (
    <div>
      <PageHeader backHref="/training" title="Neues Schulungsmodul" />
      <Card>
        <CardContent className="p-6">
          <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Titel</Label><Input name="titel" required /></div>
            <div><Label>Kategorie</Label><Input name="kategorie" placeholder="Barista" /></div>
            <div><Label>Position (Typ)</Label><Input name="position_typ" placeholder="barista" /></div>
            <div><Label>Reihenfolge</Label><Input name="reihenfolge" type="number" /></div>
            <div><Label>Dauer (Min.)</Label><Input name="dauer_minuten" type="number" defaultValue="15" /></div>
            <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="pflicht" /> Pflicht</label>
            {err && <p className="col-span-2 text-sm text-destructive">{err}</p>}
            <Button type="submit" disabled={pending} className="col-span-2 w-fit">{pending ? '...' : 'Anlegen & bearbeiten'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
