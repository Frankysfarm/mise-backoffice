'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { ClipboardList } from 'lucide-react';

type Area = { id: string; name: string; location_id: string | null; location: { name: string } | null };

export function AssignForm({ areas, employees, locations }: {
  areas: Area[];
  employees: { id: string; vorname: string; nachname: string }[];
  locations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [locId, setLocId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [empId, setEmpId] = useState('');
  const [notiz, setNotiz] = useState('');

  const filteredAreas = locId ? areas.filter(a => a.location_id === locId) : areas;

  async function submit() {
    if (!areaId) return toastError('Bereich auswählen');
    if (!empId) return toastError('Mitarbeiter auswählen');

    start(async () => {
      const { data, error } = await createClient().from('inventory_sessions').insert({
        area_id: areaId,
        location_id: locId || null,
        assigned_to: empId,
        typ: 'geplant',
        notiz: notiz || null,
      } as any).select('id').single();
      if (error) return toastError('Zuweisung fehlgeschlagen', error.message);
      toastSuccess('Inventur zugewiesen', 'Mitarbeiter sieht die Aufgabe auf der Home-Seite.');
      router.push('/inventory/sessions');
    });
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="rounded-lg bg-matcha-50 p-4 flex items-start gap-3">
          <ClipboardList className="h-5 w-5 text-matcha-700 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-matcha-800">So funktioniert's:</div>
            <div className="text-matcha-700/80 mt-1">
              Du weist einem Mitarbeiter einen Lagerbereich zu. Die Aufgabe erscheint
              automatisch auf dessen Home-Screen in der App. Der Mitarbeiter geht dann Produkt
              für Produkt durch — mit Blind Count, Karton-Zählung und Pflicht-Prüfung.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Standort</Label>
            <select value={locId} onChange={e => { setLocId(e.target.value); setAreaId(''); }}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— alle —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Lagerbereich *</Label>
            <select value={areaId} onChange={e => setAreaId(e.target.value)} required
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— wählen —</option>
              {filteredAreas.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.location?.name ? ` (${(a.location as any).name})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Mitarbeiter *</Label>
            <select value={empId} onChange={e => setEmpId(e.target.value)} required
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— wählen —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.vorname} {e.nachname}</option>)}
            </select>
          </div>
          <div>
            <Label>Notiz (optional)</Label>
            <Input value={notiz} onChange={e => setNotiz(e.target.value)} placeholder="z.B. Monatsinventur April" />
          </div>
        </div>

        <Button onClick={submit} disabled={pending} size="lg" className="w-full md:w-auto">
          {pending ? 'Erstelle...' : 'Inventur zuweisen'}
        </Button>
      </CardContent>
    </Card>
  );
}
