'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function GuideEditor({ guide, departments }: { guide: any; departments: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    titel: guide.titel,
    phase: guide.phase ?? 'opening',
    position_typ: guide.position_typ ?? '',
    department_id: guide.department_id ?? '',
    aktiv: guide.aktiv,
    inhalt: JSON.stringify(guide.inhalt ?? { categories: [] }, null, 2),
  });

  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    let parsed;
    try { parsed = JSON.parse(form.inhalt); } catch { setMsg('JSON ungültig'); return; }
    start(async () => {
      const { error } = await createClient().from('shift_guides').update({
        titel: form.titel, phase: form.phase, position_typ: form.position_typ || null,
        department_id: form.department_id || null, aktiv: form.aktiv,
        inhalt: parsed, version: (guide.version ?? 1) + 1,
      }).eq('id', guide.id);
      setMsg(error ? error.message : 'Gespeichert ✓ (neue Version)');
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <F label="Titel"><Input value={form.titel} onChange={e => setForm({ ...form, titel: e.target.value })} /></F>
            <F label="Phase">
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })}>
                <option value="opening">Aufmachen (opening)</option>
                <option value="closing">Zumachen (closing)</option>
                <option value="middle">Mittags (middle)</option>
              </select>
            </F>
            <F label="Position"><Input value={form.position_typ} onChange={e => setForm({ ...form, position_typ: e.target.value })} placeholder="barista/koch/service" /></F>
            <F label="Abteilung">
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}>
                <option value="">—</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </F>
            <label className="col-span-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.aktiv} onChange={e => setForm({ ...form, aktiv: e.target.checked })} /> Aktiv</label>
          </div>
          <F label="Inhalt (JSON: categories mit steps[])">
            <Textarea rows={26} value={form.inhalt} onChange={e => setForm({ ...form, inhalt: e.target.value })} />
          </F>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>{pending ? 'Speichere...' : 'Speichern (neue Version)'}</Button>
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
