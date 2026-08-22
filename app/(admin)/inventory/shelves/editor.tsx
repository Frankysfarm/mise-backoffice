'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { Plus, Trash2, GripVertical } from 'lucide-react';

type Shelf = { id: string; area_id: string; name: string; position: number; beschreibung: string | null; ebene: string | null; area: { name: string } | null };
type Area = { id: string; name: string };

export function ShelvesEditor({ shelves, areas }: { shelves: Shelf[]; areas: Area[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const grouped = areas.map(a => ({
    ...a,
    shelves: shelves.filter(s => s.area_id === a.id).sort((a, b) => a.position - b.position),
  }));

  async function add(areaId: string, fd: FormData) {
    start(async () => {
      const maxPos = shelves.filter(s => s.area_id === areaId).reduce((m, s) => Math.max(m, s.position), 0);
      const { error } = await createClient().from('inventory_shelves').insert({
        area_id: areaId,
        name: fd.get('name'),
        beschreibung: fd.get('beschreibung') || null,
        ebene: fd.get('ebene') || null,
        position: maxPos + 1,
      } as any);
      if (error) return toastError('Fehler', error.message);
      toastSuccess('Fach angelegt');
      router.refresh();
    });
  }

  async function del(id: string) {
    if (!confirm('Fach löschen? Produkte verlieren ihre Fach-Zuordnung.')) return;
    start(async () => {
      await createClient().from('inventory_shelves').delete().eq('id', id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {grouped.map(area => (
        <Card key={area.id}>
          <CardHeader>
            <CardTitle>{area.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {area.shelves.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Keine Fächer angelegt.</p>
            ) : (
              <div className="space-y-2">
                {area.shelves.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-800 font-mono text-sm font-bold">
                      {s.position}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[s.ebene && `Ebene: ${s.ebene}`, s.beschreibung].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => del(s.id)} disabled={pending}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <form action={(fd) => add(area.id, fd)} className="flex flex-wrap items-end gap-2 pt-2 border-t">
              <div className="flex-1 min-w-[160px]"><Label>Name</Label><Input name="name" required placeholder="Regal 4 — Gewürze" /></div>
              <div className="w-28"><Label>Ebene</Label><Input name="ebene" placeholder="oben" /></div>
              <div className="flex-1 min-w-[160px]"><Label>Beschreibung</Label><Input name="beschreibung" placeholder="Rechte Wand, 3. Fach" /></div>
              <Button type="submit" disabled={pending}><Plus className="h-4 w-4" /> Fach</Button>
            </form>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
