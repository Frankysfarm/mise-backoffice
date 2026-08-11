'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toastError, toastSuccess } from '@/components/ui/toaster';

type Department = { id: string; name: string; location_id: string | null };

export function TrialSetupForm({ applicationId, locations, departments, initialLocationId, initialDepartmentId, initialPosition }: {
  applicationId: string;
  locations: { id: string; name: string }[];
  departments: Department[];
  initialLocationId?: string | null;
  initialDepartmentId?: string | null;
  initialPosition?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const [locationId, setLocationId] = useState(initialLocationId ?? '');
  const [departmentId, setDepartmentId] = useState(initialDepartmentId ?? '');
  const filteredDepartments = useMemo(
    () => departments.filter((department) => !locationId || department.location_id === locationId),
    [departments, locationId],
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get('datum') ?? '');
    const startTime = String(form.get('start') ?? '');
    const endTime = String(form.get('ende') ?? '');
    const startAt = new Date(`${date}T${startTime}:00`);
    const endAt = new Date(`${date}T${endTime}:00`);
    startTransition(async () => {
      const response = await fetch(`/api/applications/${applicationId}/trial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          department_id: departmentId,
          start_zeit: startAt.toISOString(),
          end_zeit: endAt.toISOString(),
          position: form.get('position'),
          notiz: form.get('notiz') || undefined,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toastError('Probearbeit konnte nicht geplant werden', data?.error ?? `Fehler ${response.status}`);
        return;
      }
      toastSuccess('Probearbeit geplant', 'Der Kandidat bleibt bis zur Bewertung im Bewerberbereich.');
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
        <p>Diese Schicht ist nur eine Probearbeit. Sie macht die Person noch nicht zum aktiven Mitarbeiter.</p>
      </div>
      <div>
        <Label htmlFor="trial-location">Standort</Label>
        <select
          id="trial-location"
          value={locationId}
          onChange={(event) => { setLocationId(event.target.value); setDepartmentId(''); }}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          required
        >
          <option value="">— wählen —</option>
          {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
        </select>
      </div>
      <div>
        <Label htmlFor="trial-department">Abteilung</Label>
        <select
          id="trial-department"
          value={departmentId}
          onChange={(event) => setDepartmentId(event.target.value)}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50"
          disabled={!locationId}
          required
        >
          <option value="">— wählen —</option>
          {filteredDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>
      </div>
      <div>
        <Label htmlFor="trial-position">Einsatzbereich</Label>
        <Input id="trial-position" name="position" defaultValue={initialPosition ?? ''} placeholder="z. B. Barista, Küche oder Service" required />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div><Label htmlFor="trial-date">Datum</Label><Input id="trial-date" name="datum" type="date" defaultValue={tomorrow} required /></div>
        <div><Label htmlFor="trial-start">Start</Label><Input id="trial-start" name="start" type="time" defaultValue="10:00" required /></div>
        <div><Label htmlFor="trial-end">Ende</Label><Input id="trial-end" name="ende" type="time" defaultValue="13:00" required /></div>
      </div>
      <div>
        <Label htmlFor="trial-note">Hinweis für den Prüfer (optional)</Label>
        <Textarea id="trial-note" name="notiz" rows={3} placeholder="Worauf soll bei dieser Probearbeit besonders geachtet werden?" />
      </div>
      <Button type="submit" disabled={pending || !locationId || !departmentId} className="w-full">
        {pending ? 'Wird geplant…' : 'Probearbeit verbindlich planen'}
      </Button>
    </form>
  );
}
