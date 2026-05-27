'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { Plus, Zap } from 'lucide-react';

type Zone = { id: string; name: string; icon: string | null };
type Emp = { id: string; vorname: string; nachname: string };

export function AssignCleaningForm({ zones, employees, date }: {
  zones: Zone[]; employees: Emp[]; date: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [zoneId, setZoneId] = useState('');
  const [empId, setEmpId] = useState('');
  const [phase, setPhase] = useState<'morning' | 'evening' | 'weekly'>('morning');

  async function assign() {
    if (!zoneId) return toastError('Zone wählen');
    start(async () => {
      const { error } = await createClient().from('cleaning_assignments').insert({
        zone_id: zoneId,
        employee_id: empId || null,
        datum: date,
        phase,
        status: 'geplant',
      } as any);
      if (error) return toastError('Zuweisung fehlgeschlagen', error.message);
      toastSuccess('Zone zugewiesen');
      setZoneId(''); setEmpId('');
      router.refresh();
    });
  }

  async function autoAssignAll() {
    if (employees.length === 0 || zones.length === 0) return toastError('Keine Mitarbeiter oder Zonen');
    start(async () => {
      const sb = createClient();
      const rows = zones.flatMap((z, i) => {
        const emp = employees[i % employees.length];
        return [
          { zone_id: z.id, employee_id: emp.id, datum: date, phase: 'morning', status: 'geplant' },
          { zone_id: z.id, employee_id: emp.id, datum: date, phase: 'evening', status: 'geplant' },
        ];
      });
      const { error } = await sb.from('cleaning_assignments').insert(rows as any[]);
      if (error) return toastError('Auto-Zuweisung fehlgeschlagen', error.message);
      toastSuccess('Alle Zonen zugewiesen', `${rows.length} Einträge für ${date}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Zone zuweisen</span>
          <Button size="sm" variant="outline" onClick={autoAssignAll} disabled={pending}>
            <Zap className="h-4 w-4" /> Auto-Verteilung (alle Zonen × Morgens+Abends)
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5 items-end">
          <div>
            <Label>Zone</Label>
            <select value={zoneId} onChange={e => setZoneId(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— wählen —</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.icon} {z.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Mitarbeiter (optional)</Label>
            <select value={empId} onChange={e => setEmpId(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— offen —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.vorname} {e.nachname}</option>)}
            </select>
          </div>
          <div>
            <Label>Phase</Label>
            <select value={phase} onChange={e => setPhase(e.target.value as any)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="morning">☀️ Morgens</option>
              <option value="evening">🌙 Abends</option>
              <option value="weekly">📅 Wöchentlich</option>
            </select>
          </div>
          <Button onClick={assign} disabled={pending}>
            <Plus className="h-4 w-4" /> Zuweisen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
