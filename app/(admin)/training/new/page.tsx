'use client';

import { useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewTrainingModule() {
  const router = useRouter();
  const pathname = usePathname();
  const basePath = pathname.startsWith('/neo/app/schulungen') ? '/neo/app/schulungen' : '/training';
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const response = await fetch('/api/training/modules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: fd.get('titel'), description: '', category: fd.get('kategorie') || '', durationMinutes: fd.get('dauer_minuten') ? Number(fd.get('dauer_minuten')) : null, required: fd.get('pflicht') === 'on', active: true, passingThreshold: 80, deadlineDays: null, recurrenceMonths: null, targets: fd.get('position_typ') ? [{ type: 'position', positionType: fd.get('position_typ') }] : [], blocks: [] }) });
      const data = await response.json();
      if (!response.ok) return setErr(data.error ?? 'Schulung konnte nicht angelegt werden.');
      router.push(`${basePath}/${data.id}`);
    });
  }

  return (
    <div>
      <PageHeader backHref={basePath} title="Neues Schulungsmodul" />
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
