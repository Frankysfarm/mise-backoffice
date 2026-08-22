'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { Ban, Plane, HeartPulse, Baby } from 'lucide-react';

type AbsenceKind = 'urlaub' | 'krank' | 'elternzeit' | 'sonstiges';

const KINDS: { id: AbsenceKind; label: string; icon: React.ReactNode }[] = [
  { id: 'urlaub',     label: 'Urlaub',      icon: <Plane className="h-4 w-4" /> },
  { id: 'krank',      label: 'Krank',       icon: <HeartPulse className="h-4 w-4" /> },
  { id: 'elternzeit', label: 'Elternzeit',  icon: <Baby className="h-4 w-4" /> },
  { id: 'sonstiges',  label: 'Sonstiges',   icon: <Ban className="h-4 w-4" /> },
];

export function AbsenceDialog({
  employees, defaultEmployeeId, defaultFrom, triggerLabel = 'Abwesenheit',
}: {
  employees: { id: string; vorname: string; nachname: string }[];
  defaultEmployeeId?: string;
  defaultFrom?: string;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState(defaultEmployeeId ?? '');
  const [kind, setKind] = useState<AbsenceKind>('urlaub');
  const [from, setFrom] = useState(defaultFrom ?? new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(defaultFrom ?? new Date().toISOString().slice(0, 10));
  const [grund, setGrund] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (!employeeId) { setErr('Bitte Mitarbeiter wählen.'); return; }
    if (new Date(to) < new Date(from)) { setErr('Bis-Datum muss nach Von-Datum liegen.'); return; }

    start(async () => {
      const sb = createClient();
      // Alle Tage zwischen from und to generieren und einfügen
      const rows: any[] = [];
      const d = new Date(from + 'T00:00:00');
      const end = new Date(to + 'T00:00:00');
      while (d <= end) {
        rows.push({
          employee_id: employeeId,
          datum: d.toISOString().slice(0, 10),
          typ: 'gesperrt',
          grund: grund || KINDS.find(k => k.id === kind)?.label || kind,
        });
        d.setDate(d.getDate() + 1);
      }

      const { error } = await sb.from('availability_exceptions').upsert(rows, {
        onConflict: 'employee_id,datum',
      });
      if (error) { setErr(error.message); return; }

      toastSuccess('Abwesenheit eingetragen', `${rows.length} Tag(e) für ${employees.find(e => e.id === employeeId)?.vorname} gesperrt.`);
      setOpen(false);
      setGrund('');
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Ban className="h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abwesenheit eintragen</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Mitarbeiter</Label>
            <select
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              required
            >
              <option value="">— wählen —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.vorname} {e.nachname}</option>)}
            </select>
          </div>

          <div className="col-span-2">
            <Label>Grund</Label>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map(k => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${kind === k.id ? 'border-matcha-600 bg-matcha-50 text-matcha-800' : 'hover:bg-muted'}`}
                >
                  {k.icon} {k.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Von</Label>
            <Input type="date" value={from} onChange={e => { setFrom(e.target.value); if (new Date(to) < new Date(e.target.value)) setTo(e.target.value); }} required />
          </div>
          <div>
            <Label>Bis (inkl.)</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} required />
          </div>

          <div className="col-span-2">
            <Label>Notiz (optional)</Label>
            <Input value={grund} onChange={e => setGrund(e.target.value)} placeholder="z.B. 'Attest bis Freitag'" />
          </div>

          {err && <p className="col-span-2 text-sm text-destructive">{err}</p>}

          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button type="submit" disabled={isPending}>{isPending ? '…' : 'Eintragen'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
