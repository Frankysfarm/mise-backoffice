'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toastError, toastSuccess } from '@/components/ui/toaster';

type Dep = { id: string; name: string; location_id: string | null };

export function AssignForm({ employee, departments, locations }: {
  employee: any;
  departments: Dep[];
  locations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [depId, setDepId] = useState<string>(employee.department_id ?? '');
  const [locId, setLocId] = useState<string>(employee.location_id ?? '');
  const [stundenlohn, setStundenlohn] = useState<string>(employee.stundenlohn ?? '');
  const [action, setAction] = useState<'accept' | 'reject' | null>(null);

  const filteredDeps = locId ? departments.filter(d => d.location_id === locId) : departments;

  async function accept() {
    if (!depId) { toastError('Abteilung fehlt'); return; }
    setAction('accept');
    start(async () => {
      const sb = createClient();
      const { error } = await sb.from('employees').update({
        department_id: depId,
        location_id: locId || null,
        stundenlohn: stundenlohn ? Number(stundenlohn) : null,
        status: 'in_training',
        angenommen_am: new Date().toISOString(),
      }).eq('id', employee.id);
      setAction(null);
      if (error) return toastError('Zuweisung fehlgeschlagen', error.message);
      toastSuccess('Angenommen ✓', 'Pflichtmodule werden automatisch zugewiesen.');
      router.push(`/employees/${employee.id}`);
    });
  }

  async function reject() {
    if (!confirm('Bewerbung endgültig ablehnen?')) return;
    setAction('reject');
    start(async () => {
      const { error } = await createClient().from('employees').update({
        status: 'gekündigt', invite_token: null,
      }).eq('id', employee.id);
      setAction(null);
      if (error) return toastError('Ablehnen fehlgeschlagen', error.message);
      toastSuccess('Abgelehnt', 'Bewerbung archiviert.');
      router.push('/applications');
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Standort</Label>
        <select value={locId} onChange={e => { setLocId(e.target.value); setDepId(''); }}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">— wählen —</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div>
        <Label>Abteilung</Label>
        <select value={depId} onChange={e => setDepId(e.target.value)} disabled={!locId}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50">
          <option value="">— wählen —</option>
          {filteredDeps.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {!locId && <p className="mt-1 text-xs text-muted-foreground">Wähle zuerst den Standort.</p>}
      </div>
      <div>
        <Label>Stundenlohn € (optional)</Label>
        <Input type="number" step="0.01" value={stundenlohn} onChange={e => setStundenlohn(e.target.value)} placeholder="14,00" />
      </div>

      <div className="rounded-md border bg-matcha-50 p-3 text-xs text-matcha-800">
        🎓 Mit dem Annehmen bekommt {employee.vorname} automatisch alle Pflicht-Schulungen
        dieser Abteilung. Bevor keine abgeschlossen sind, kann er/sie nicht eingeteilt werden.
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={accept} disabled={pending || !depId} className="flex-1">
          {action === 'accept' ? '...' : '✓ Annehmen & Training starten'}
        </Button>
        <Button variant="outline" onClick={reject} disabled={pending}>
          {action === 'reject' ? '...' : 'Ablehnen'}
        </Button>
      </div>
    </div>
  );
}
