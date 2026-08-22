'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, AlertTriangle } from 'lucide-react';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import {
  AvailabilityBanner,
  computeAvailabilityStatus,
  isHardBlock,
  useEmployeeAvailability,
} from './availability-banner';
import { Suggestions } from './suggestions';
import { ApplicationsList } from './applications-list';
import { Megaphone } from 'lucide-react';

export type EditableShift = {
  id: string;
  start_zeit: string;
  end_zeit: string;
  pause_minuten: number | null;
  position: string | null;
  employee_id: string | null;
  department_id: string | null;
  location_id?: string | null;
  typ?: string | null;
  notiz?: string | null;
  offen_fuer_bewerbung?: boolean | null;
};

function isoToTime(iso: string) { return new Date(iso).toTimeString().slice(0, 5); }
function isoToDate(iso: string) { return new Date(iso).toISOString().slice(0, 10); }

export function EditShiftDialog({
  open, onOpenChange, shift,
  employees, departments, locations,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shift: EditableShift | null;
  employees: { id: string; vorname: string; nachname: string }[];
  departments: { id: string; name: string }[];
  locations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState('');
  const [datum, setDatum] = useState('');
  const [startT, setStartT] = useState('07:00');
  const [endT, setEndT] = useState('13:00');
  const [position, setPosition] = useState('');
  const [pause, setPause] = useState('30');
  const [typ, setTyp] = useState('normal');
  const [departmentId, setDepartmentId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [notiz, setNotiz] = useState('');
  const [offenFuerBewerbung, setOffenFuerBewerbung] = useState(false);

  React.useEffect(() => {
    if (!shift) return;
    setEmployeeId(shift.employee_id ?? '');
    setDatum(isoToDate(shift.start_zeit));
    setStartT(isoToTime(shift.start_zeit));
    setEndT(isoToTime(shift.end_zeit));
    setPosition(shift.position ?? '');
    setPause(String(shift.pause_minuten ?? 30));
    setTyp(shift.typ ?? 'normal');
    setDepartmentId(shift.department_id ?? '');
    setLocationId(shift.location_id ?? '');
    setNotiz(shift.notiz ?? '');
    setOffenFuerBewerbung(!!shift.offen_fuer_bewerbung);
    setErr(null);
  }, [shift]);

  const { avail, exc } = useEmployeeAvailability(employeeId);
  const status = employeeId ? computeAvailabilityStatus(avail, exc, datum, startT, endT) : { kind: 'none' as const };

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!shift) return;
    setErr(null);
    if (isHardBlock(status)) {
      if (!confirm('Mitarbeiter hat diesen Zeitraum gesperrt. Trotzdem speichern?')) return;
    }
    const startISO = new Date(`${datum}T${startT}:00`).toISOString();
    const endISO = new Date(`${datum}T${endT}:00`).toISOString();
    start(async () => {
      const { error } = await createClient().from('shifts').update({
        employee_id: employeeId || null,
        department_id: departmentId || null,
        location_id: locationId || null,
        position: position || null,
        pause_minuten: Number(pause) || 0,
        typ: typ || 'normal',
        notiz: notiz || null,
        start_zeit: startISO,
        end_zeit: endISO,
        status: employeeId ? 'bestätigt' : 'geplant',
        // Nur aktiv lassen solange unbesetzt
        offen_fuer_bewerbung: employeeId ? false : offenFuerBewerbung,
      }).eq('id', shift.id);
      if (error) { setErr(error.message); return; }
      toastSuccess('Schicht gespeichert');
      onOpenChange(false);
      router.refresh();
    });
  }

  async function onDelete() {
    if (!shift) return;
    if (!confirm('Diese Schicht wirklich löschen?')) return;
    start(async () => {
      const { error } = await createClient().from('shifts').delete().eq('id', shift.id);
      if (error) { toastError('Löschen fehlgeschlagen', error.message); return; }
      toastSuccess('Schicht gelöscht');
      onOpenChange(false);
      router.refresh();
    });
  }

  const emp = employees.find(e => e.id === employeeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schicht bearbeiten</DialogTitle>
        </DialogHeader>
        {!shift ? null : (
          <form onSubmit={onSave} className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Mitarbeiter (leer = unbesetzt)</Label>
              <select
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">— unbesetzt —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.vorname} {e.nachname}</option>)}
              </select>
            </div>

            <AvailabilityBanner status={status} employeeName={emp?.vorname} />

            {!employeeId && datum && startT && endT && (
              <div className="col-span-2">
                <Suggestions
                  shift={{ datum, start: startT, end: endT, pause_minuten: Number(pause) || 0 }}
                  employees={employees.map(e => ({ id: e.id, vorname: e.vorname, nachname: e.nachname }))}
                  onAssign={(id) => setEmployeeId(id)}
                />
              </div>
            )}

            {/* Bewerbungs-Toggle: nur wenn Schicht (noch) unbesetzt ist */}
            {!employeeId && (
              <div className="col-span-2 rounded-md border bg-matcha-50/60 p-3">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={offenFuerBewerbung}
                    onChange={e => setOffenFuerBewerbung(e.target.checked)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <Megaphone className="h-4 w-4 text-matcha-700" />
                      Für Bewerbung freigeben
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Mitarbeiter sehen diese Schicht in ihrer App und können sich bewerben.
                      Du entscheidest dann wer sie bekommt.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Bewerbungs-Liste: sobald Shift freigegeben war oder Bewerbungen vorliegen */}
            {shift && (offenFuerBewerbung || shift.offen_fuer_bewerbung) && (
              <div className="col-span-2 space-y-1.5">
                <div className="text-sm font-medium">Bewerbungen</div>
                <ApplicationsList shiftId={shift.id} />
              </div>
            )}

            <div><Label>Datum</Label><Input type="date" value={datum} onChange={e => setDatum(e.target.value)} required /></div>
            <div><Label>Position</Label><Input value={position} onChange={e => setPosition(e.target.value)} placeholder="Barista" /></div>
            <div><Label>Start</Label><Input type="time" value={startT} onChange={e => setStartT(e.target.value)} required /></div>
            <div><Label>Ende</Label><Input type="time" value={endT} onChange={e => setEndT(e.target.value)} required /></div>
            <div><Label>Pause (Min.)</Label><Input type="number" value={pause} onChange={e => setPause(e.target.value)} /></div>

            <div>
              <Label>Schicht-Typ</Label>
              <select
                value={typ}
                onChange={e => setTyp(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="normal">Normal</option>
                <option value="einarbeitung">🌱 Einarbeitung</option>
                <option value="probe">🎓 Probeschicht</option>
              </select>
            </div>

            <div>
              <Label>Standort</Label>
              <select
                value={locationId}
                onChange={e => setLocationId(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">—</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>

            <div>
              <Label>Abteilung</Label>
              <select
                value={departmentId}
                onChange={e => setDepartmentId(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">—</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div className="col-span-2">
              <Label>Notiz</Label>
              <Input value={notiz} onChange={e => setNotiz(e.target.value)} placeholder="Optional" />
            </div>

            {err && (
              <p className="col-span-2 flex items-center gap-1.5 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" /> {err}
              </p>
            )}

            <DialogFooter className="col-span-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={onDelete}
                disabled={isPending}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" /> Löschen
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Abbrechen</Button>
                <Button type="submit" disabled={isPending}>{isPending ? '...' : 'Speichern'}</Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
