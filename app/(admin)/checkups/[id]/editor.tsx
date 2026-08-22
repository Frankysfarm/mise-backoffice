'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function TemplateEditor({ tpl, departments }: { tpl: any; departments: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    titel: tpl.titel, phase: tpl.phase ?? '', position_typ: tpl.position_typ ?? '',
    department_id: tpl.department_id ?? '', aktiv: tpl.aktiv,
    intervall: tpl.intervall ?? 'täglich',
    auto_reminder_minutes: tpl.auto_reminder_minutes ?? 15,
    eskalation_minutes: tpl.eskalation_minutes ?? 30,
    fragen: JSON.stringify(tpl.fragen ?? { tasks: [] }, null, 2),
  });

  async function onSave(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    let parsed;
    try { parsed = JSON.parse(form.fragen); } catch { setMsg('Aufgaben-JSON ungültig'); return; }
    start(async () => {
      const { error } = await createClient().from('checkup_templates').update({
        titel: form.titel, phase: form.phase || null, position_typ: form.position_typ || null,
        department_id: form.department_id || null, aktiv: form.aktiv,
        intervall: form.intervall, auto_reminder_minutes: form.auto_reminder_minutes,
        eskalation_minutes: form.eskalation_minutes, fragen: parsed,
      }).eq('id', tpl.id);
      setMsg(error ? error.message : 'Gespeichert ✓');
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSave} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <F label="Titel"><Input value={form.titel} onChange={e => setForm({ ...form, titel: e.target.value })} required /></F>
            <F label="Phase">
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })}>
                <option value="">—</option>
                <option value="opening">Morgens (opening)</option>
                <option value="closing">Abends (closing)</option>
                <option value="middle">Tags (middle)</option>
              </select>
            </F>
            <F label="Position"><Input value={form.position_typ} onChange={e => setForm({ ...form, position_typ: e.target.value })} placeholder="barista" /></F>
            <F label="Abteilung">
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}>
                <option value="">—</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </F>
            <F label="Intervall"><Input value={form.intervall} onChange={e => setForm({ ...form, intervall: e.target.value })} /></F>
            <F label="Reminder nach (Min.)"><Input type="number" value={form.auto_reminder_minutes} onChange={e => setForm({ ...form, auto_reminder_minutes: +e.target.value })} /></F>
            <F label="Eskalation nach (Min.)"><Input type="number" value={form.eskalation_minutes} onChange={e => setForm({ ...form, eskalation_minutes: +e.target.value })} /></F>
            <label className="col-span-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.aktiv} onChange={e => setForm({ ...form, aktiv: e.target.checked })} /> Aktiv</label>
          </div>
          <F label="Aufgaben (JSON: tasks[] mit id, title, description, requiresPhoto, estMin)">
            <Textarea rows={20} value={form.fragen} onChange={e => setForm({ ...form, fragen: e.target.value })} />
          </F>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>{pending ? 'Speichere...' : 'Speichern'}</Button>
            {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
