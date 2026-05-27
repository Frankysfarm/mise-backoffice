'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toastSuccess, toastError } from '@/components/ui/toaster';

type Location = { id: string; name: string };
type Department = { id: string; name: string };

export function EditEmployeeForm({ employee, locations, departments }: {
  employee: any;
  locations: Location[];
  departments: Department[];
}) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [form, setForm] = useState({
    vorname: employee.vorname ?? '',
    nachname: employee.nachname ?? '',
    email: employee.email ?? '',
    telefon: employee.telefon ?? '',
    rolle: employee.rolle,
    status: employee.status,
    employment_type: employee.employment_type ?? '',
    position_typ: employee.position_typ ?? '',
    stundenlohn: employee.stundenlohn ?? '',
    wochenstunden: employee.wochenstunden ?? '',
    department_id: employee.department?.id ?? '',
    location_id: employee.location?.id ?? '',
    personalnummer: employee.personalnummer ?? '',
  });

  function upd<K extends keyof typeof form>(key: K, val: typeof form[K]) { setForm(f => ({ ...f, [key]: val })); }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const sb = createClient();
      const { error } = await sb.from('employees').update({
        ...form,
        stundenlohn: form.stundenlohn ? Number(form.stundenlohn) : null,
        wochenstunden: form.wochenstunden ? Number(form.wochenstunden) : null,
        employment_type: form.employment_type || null,
        department_id: form.department_id || null,
        location_id: form.location_id || null,
      }).eq('id', employee.id);
      if (error) { toastError('Speichern fehlgeschlagen', error.message); return; }
      toastSuccess('Mitarbeiter gespeichert', `${form.vorname} ${form.nachname} aktualisiert.`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSave} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Personalnummer"><Input value={form.personalnummer} onChange={e => upd('personalnummer', e.target.value)} /></Field>
          <Field label="Rolle">
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.rolle} onChange={e => upd('rolle', e.target.value)}>
              <option value="mitarbeiter">Mitarbeiter</option>
              <option value="teamleiter">Teamleiter</option>
              <option value="manager">Manager</option>
              <option value="backoffice">Backoffice</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <Field label="Vorname"><Input value={form.vorname} onChange={e => upd('vorname', e.target.value)} required /></Field>
          <Field label="Nachname"><Input value={form.nachname} onChange={e => upd('nachname', e.target.value)} required /></Field>
          <Field label="E-Mail"><Input type="email" value={form.email} onChange={e => upd('email', e.target.value)} /></Field>
          <Field label="Telefon"><Input value={form.telefon} onChange={e => upd('telefon', e.target.value)} /></Field>
          <Field label="Status">
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.status} onChange={e => upd('status', e.target.value)}>
              <option value="aktiv">Aktiv</option>
              <option value="inaktiv">Inaktiv</option>
              <option value="pause">Pause</option>
              <option value="gekündigt">Gekündigt</option>
            </select>
          </Field>
          <Field label="Beschäftigung">
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.employment_type} onChange={e => upd('employment_type', e.target.value)}>
              <option value="">—</option>
              <option value="vollzeit">Vollzeit</option>
              <option value="teilzeit">Teilzeit</option>
              <option value="minijob">Minijob</option>
              <option value="werkstudent">Werkstudent</option>
            </select>
          </Field>
          <Field label="Position (Typ)"><Input value={form.position_typ} onChange={e => upd('position_typ', e.target.value)} placeholder="barista, koch, service..." /></Field>
          <Field label="Stundenlohn €"><Input type="number" step="0.01" value={form.stundenlohn} onChange={e => upd('stundenlohn', e.target.value)} /></Field>
          <Field label="Stunden/Woche"><Input type="number" value={form.wochenstunden} onChange={e => upd('wochenstunden', e.target.value)} /></Field>
          <Field label="Standort">
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.location_id} onChange={e => upd('location_id', e.target.value)}>
              <option value="">—</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Abteilung">
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.department_id} onChange={e => upd('department_id', e.target.value)}>
              <option value="">—</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <div className="col-span-full flex items-center gap-3 pt-2">
            <Button type="submit" disabled={isPending}>{isPending ? 'Speichere...' : 'Speichern'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
