'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { Pencil, Plus, Trash2 } from 'lucide-react';

export type Template = {
  id: string;
  name: string;
  position: string | null;
  zeit_von: string;
  zeit_bis: string;
  pause_minuten: number | null;
  typ: string | null;
  department_id: string | null;
  location_id: string | null;
  farbe: string | null;
  sort_order: number;
};

const DEFAULT_COLORS = ['#2d6b45', '#d4a64a', '#8a4a2d', '#5b8c6b', '#c97b5e', '#7a6fa3'];

export function TemplatesManager({ initialTemplates, departments, locations }: {
  initialTemplates: Template[];
  departments: { id: string; name: string }[];
  locations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Template | null>(null);
  const [isNew, setIsNew] = useState(false);

  function openNew() {
    setIsNew(true);
    setEditing({
      id: '',
      name: '',
      position: '',
      zeit_von: '07:00',
      zeit_bis: '13:00',
      pause_minuten: 30,
      typ: 'normal',
      department_id: null,
      location_id: null,
      farbe: DEFAULT_COLORS[0],
      sort_order: initialTemplates.length + 1,
    });
  }

  function openEdit(t: Template) {
    setIsNew(false);
    setEditing(t);
  }

  async function onDelete(id: string) {
    if (!confirm('Diese Vorlage wirklich löschen?')) return;
    const { error } = await createClient().from('shift_templates').delete().eq('id', id);
    if (error) { toastError('Löschen fehlgeschlagen', error.message); return; }
    toastSuccess('Vorlage gelöscht');
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between p-4">
        <div className="text-sm text-muted-foreground">
          {initialTemplates.length} Vorlage{initialTemplates.length === 1 ? '' : 'n'}
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Neue Vorlage</Button>
      </div>

      {initialTemplates.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Zeit</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Pause</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Abteilung</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialTemplates.map(t => (
              <TableRow key={t.id}>
                <TableCell>
                  <span
                    className="mr-2 inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: t.farbe ?? '#2d6b45' }}
                  />
                  {t.name}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {t.zeit_von.slice(0, 5)}–{t.zeit_bis.slice(0, 5)}
                </TableCell>
                <TableCell>{t.position ?? '—'}</TableCell>
                <TableCell>{t.pause_minuten ?? 0} Min</TableCell>
                <TableCell>{t.typ ?? 'normal'}</TableCell>
                <TableCell>
                  {departments.find(d => d.id === t.department_id)?.name ?? '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(t.id)} className="text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <TemplateDialog
        template={editing}
        isNew={isNew}
        departments={departments}
        locations={locations}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function TemplateDialog({ template, isNew, departments, locations, onClose }: {
  template: Template | null;
  isNew: boolean;
  departments: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [form, setForm] = useState<Template | null>(null);
  const [err, setErr] = useState<string | null>(null);

  React.useEffect(() => {
    setForm(template);
    setErr(null);
  }, [template]);

  if (!form) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.name.trim()) { setErr('Name ist Pflicht.'); return; }

    start(async () => {
      const payload = {
        name: form.name.trim(),
        position: form.position || null,
        zeit_von: form.zeit_von,
        zeit_bis: form.zeit_bis,
        pause_minuten: form.pause_minuten ?? 0,
        typ: form.typ || 'normal',
        department_id: form.department_id || null,
        location_id: form.location_id || null,
        farbe: form.farbe,
        sort_order: form.sort_order,
      };

      const sb = createClient();
      const { error } = isNew
        ? await sb.from('shift_templates').insert(payload)
        : await sb.from('shift_templates').update(payload).eq('id', form.id);

      if (error) { setErr(error.message); return; }
      toastSuccess(isNew ? 'Vorlage erstellt' : 'Vorlage gespeichert');
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={!!template} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? 'Neue Vorlage' : 'Vorlage bearbeiten'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="z.B. Früh Barista"
              required
            />
          </div>
          <div><Label>Start</Label><Input type="time" value={form.zeit_von.slice(0, 5)} onChange={e => setForm({ ...form, zeit_von: e.target.value })} required /></div>
          <div><Label>Ende</Label><Input type="time" value={form.zeit_bis.slice(0, 5)} onChange={e => setForm({ ...form, zeit_bis: e.target.value })} required /></div>
          <div><Label>Position</Label><Input value={form.position ?? ''} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="Barista" /></div>
          <div><Label>Pause (Min.)</Label><Input type="number" value={form.pause_minuten ?? 0} onChange={e => setForm({ ...form, pause_minuten: Number(e.target.value) })} /></div>
          <div>
            <Label>Typ</Label>
            <select
              value={form.typ ?? 'normal'}
              onChange={e => setForm({ ...form, typ: e.target.value })}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="normal">Normal</option>
              <option value="einarbeitung">🌱 Einarbeitung</option>
              <option value="probe">🎓 Probeschicht</option>
            </select>
          </div>
          <div>
            <Label>Abteilung</Label>
            <select
              value={form.department_id ?? ''}
              onChange={e => setForm({ ...form, department_id: e.target.value || null })}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">—</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Standort</Label>
            <select
              value={form.location_id ?? ''}
              onChange={e => setForm({ ...form, location_id: e.target.value || null })}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">—</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <Label>Farbe</Label>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, farbe: c })}
                  className={`h-7 w-7 rounded-full border-2 transition ${form.farbe === c ? 'scale-110 border-foreground' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Farbe ${c}`}
                />
              ))}
            </div>
          </div>

          {err && <p className="col-span-2 text-sm text-destructive">{err}</p>}

          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={isPending}>{isPending ? '…' : 'Speichern'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
