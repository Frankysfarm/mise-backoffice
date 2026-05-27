'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function NewEmployeeForm({ locations, departments }: { locations: { id: string; name: string }[]; departments: { id: string; name: string }[] }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(null);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, any> = Object.fromEntries(fd);
    for (const k of ['stundenlohn', 'wochenstunden']) payload[k] = payload[k] ? Number(payload[k]) : null;
    for (const k of ['employment_type', 'department_id', 'location_id', 'position_typ']) if (!payload[k]) payload[k] = null;
    start(async () => {
      const { data, error } = await createClient().from('employees').insert(payload).select('id').single();
      if (error) return setErr(error.message);
      router.push(`/employees/${data!.id}`);
    });
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <F label="Personalnummer"><Input name="personalnummer" placeholder="P105" /></F>
          <F label="Rolle">
            <select name="rolle" defaultValue="mitarbeiter" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <optgroup label="Hierarchie">
                <option value="mitarbeiter">Mitarbeiter</option>
                <option value="teamleiter">Teamleiter</option>
                <option value="manager">Manager</option>
                <option value="backoffice">Backoffice</option>
                <option value="admin">Admin</option>
              </optgroup>
              <optgroup label="Service-Rollen (Restaurant)">
                <option value="server">Service / Kellner</option>
                <option value="bartender">Bartender</option>
                <option value="cook">Koch</option>
                <option value="dishwasher">Spüler</option>
              </optgroup>
            </select>
          </F>
          <F label="Vorname"><Input name="vorname" required /></F>
          <F label="Nachname"><Input name="nachname" required /></F>
          <F label="E-Mail"><Input name="email" type="email" /></F>
          <F label="Telefon"><Input name="telefon" /></F>
          <F label="Eintrittsdatum"><Input name="eintrittsdatum" type="date" /></F>
          <F label="Beschäftigung">
            <select name="employment_type" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">—</option>
              <option value="vollzeit">Vollzeit</option>
              <option value="teilzeit">Teilzeit</option>
              <option value="minijob">Minijob</option>
              <option value="werkstudent">Werkstudent</option>
            </select>
          </F>
          <F label="Position (Typ)"><Input name="position_typ" placeholder="barista" /></F>
          <F label="Stundenlohn €"><Input name="stundenlohn" type="number" step="0.01" /></F>
          <F label="Stunden/Woche"><Input name="wochenstunden" type="number" /></F>
          <F label="Standort">
            <select name="location_id" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">—</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </F>
          <F label="Abteilung">
            <select name="department_id" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">—</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </F>
          <div className="col-span-full flex items-center gap-3 pt-2">
            <Button type="submit" disabled={isPending}>{isPending ? 'Lege an...' : 'Anlegen'}</Button>
            {err && <span className="text-sm text-destructive">{err}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
