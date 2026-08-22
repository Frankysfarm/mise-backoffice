'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

type Avail = { weekday: number; start_time: string; end_time: string; typ: 'verfügbar' | 'bevorzugt' | 'gesperrt' };
type Exc = { datum: string; typ: 'verfügbar' | 'bevorzugt' | 'gesperrt'; grund: string | null };

type AvailabilityStatus =
  | { kind: 'none' }
  | { kind: 'loading' }
  | { kind: 'no_data' }
  | { kind: 'exception_block'; grund: string | null }
  | { kind: 'exception_ok' }
  | { kind: 'covered'; typ: 'verfügbar' | 'bevorzugt' }
  | { kind: 'partial' }
  | { kind: 'blocked' }
  | { kind: 'outside' };

function timeToMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + (m ?? 0); }
function weekdayMon0(d: Date) { return (d.getDay() + 6) % 7; }

function computeStatus(
  avail: Avail[] | null, exc: Exc[] | null,
  datum: string, startT: string, endT: string,
): AvailabilityStatus {
  if (!avail || !exc) return { kind: 'loading' };
  if (avail.length === 0 && exc.length === 0) return { kind: 'no_data' };

  // Ausnahme am genauen Tag?
  const exception = exc.find(e => e.datum === datum);
  if (exception) {
    if (exception.typ === 'gesperrt') return { kind: 'exception_block', grund: exception.grund };
    return { kind: 'exception_ok' };
  }

  const d = new Date(datum + 'T00:00:00');
  const weekday = weekdayMon0(d);
  const sMin = timeToMin(startT);
  const eMin = timeToMin(endT);
  const ranges = avail.filter(a => a.weekday === weekday).map(a => ({
    s: timeToMin(a.start_time.slice(0, 5)),
    e: timeToMin(a.end_time.slice(0, 5)),
    typ: a.typ,
  }));
  if (ranges.length === 0) return { kind: 'outside' };

  // Blocks (gesperrt) die im Intervall liegen?
  const hitsBlock = ranges.some(r => r.typ === 'gesperrt' && r.s < eMin && r.e > sMin);
  if (hitsBlock) return { kind: 'blocked' };

  // Komplette Abdeckung durch 'verfügbar'/'bevorzugt'?
  const pos = ranges.filter(r => r.typ !== 'gesperrt').sort((a, b) => a.s - b.s);
  let covered = sMin;
  let anyPreferred = false;
  for (const r of pos) {
    if (r.s > covered) break;
    covered = Math.max(covered, r.e);
    if (r.typ === 'bevorzugt') anyPreferred = true;
  }
  if (covered >= eMin) return { kind: 'covered', typ: anyPreferred ? 'bevorzugt' : 'verfügbar' };
  return { kind: 'partial' };
}

function statusBanner(s: AvailabilityStatus, vorname?: string) {
  const name = vorname ?? 'Mitarbeiter';
  switch (s.kind) {
    case 'none':
    case 'loading':
      return null;
    case 'no_data':
      return { variant: 'muted', icon: <AlertTriangle className="h-4 w-4" />, text: `${name} hat noch keine Verfügbarkeit hinterlegt.` };
    case 'covered':
      return { variant: s.typ === 'bevorzugt' ? 'secondary' : 'accent', icon: <CheckCircle2 className="h-4 w-4" />,
        text: s.typ === 'bevorzugt' ? `${name} arbeitet hier bevorzugt ✨` : `${name} ist verfügbar ✓` };
    case 'exception_ok':
      return { variant: 'secondary', icon: <CheckCircle2 className="h-4 w-4" />, text: `${name} hat Sonder-Verfügbarkeit eingetragen` };
    case 'exception_block':
      return { variant: 'destructive', icon: <AlertTriangle className="h-4 w-4" />, text: `${name} ist gesperrt${s.grund ? ` (${s.grund})` : ''}` };
    case 'blocked':
      return { variant: 'destructive', icon: <AlertTriangle className="h-4 w-4" />, text: `${name} hat diesen Zeitraum gesperrt` };
    case 'partial':
      return { variant: 'gold', icon: <AlertTriangle className="h-4 w-4" />, text: `${name} ist nur teilweise verfügbar` };
    case 'outside':
      return { variant: 'gold', icon: <AlertTriangle className="h-4 w-4" />, text: `${name} ist an diesem Wochentag nicht verfügbar` };
  }
}

export function NewShiftDialog({ employees, departments, locations, defaultDate }: {
  employees: { id: string; vorname: string; nachname: string }[];
  departments: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState('');
  const [datum, setDatum] = useState(defaultDate);
  const [startT, setStartT] = useState('07:00');
  const [endT, setEndT] = useState('13:00');

  const [avail, setAvail] = useState<Avail[] | null>(null);
  const [exc, setExc] = useState<Exc[] | null>(null);

  // Verfügbarkeit laden wenn Mitarbeiter gewählt
  React.useEffect(() => {
    if (!employeeId) { setAvail(null); setExc(null); return; }
    (async () => {
      setAvail(null); setExc(null);
      const sb = createClient();
      const [{ data: a }, { data: e }] = await Promise.all([
        sb.from('employee_availability').select('weekday,start_time,end_time,typ').eq('employee_id', employeeId),
        sb.from('availability_exceptions').select('datum,typ,grund').eq('employee_id', employeeId).gte('datum', new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)),
      ]);
      setAvail((a as any) ?? []);
      setExc((e as any) ?? []);
    })();
  }, [employeeId]);

  const status = employeeId ? computeStatus(avail, exc, datum, startT, endT) : { kind: 'none' as const };
  const banner = statusBanner(status, employees.find(e => e.id === employeeId)?.vorname);
  const isHardBlock = status.kind === 'blocked' || status.kind === 'exception_block';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(null);
    if (isHardBlock) {
      if (!confirm('Mitarbeiter hat diesen Zeitraum gesperrt. Trotzdem anlegen?')) return;
    }
    const fd = new FormData(e.currentTarget);
    const startISO = new Date(`${datum}T${startT}:00`).toISOString();
    const endISO = new Date(`${datum}T${endT}:00`).toISOString();
    start(async () => {
      const { error } = await createClient().from('shifts').insert({
        employee_id: employeeId || null,
        department_id: fd.get('department_id') || null,
        location_id: fd.get('location_id') || null,
        position: fd.get('position') as string || null,
        pause_minuten: Number(fd.get('pause') || 30),
        typ: (fd.get('typ') as string) || 'normal',
        start_zeit: startISO, end_zeit: endISO,
        status: employeeId ? 'bestätigt' : 'geplant',
      });
      if (error) return setErr(error.message);
      setOpen(false); router.refresh();
    });
  }

  const bannerClass =
    banner?.variant === 'destructive' ? 'border-destructive/40 bg-destructive/10 text-destructive' :
    banner?.variant === 'gold'        ? 'border-gold/40 bg-gold-soft text-gold' :
    banner?.variant === 'secondary'   ? 'border-matcha-300 bg-matcha-50 text-matcha-800' :
    banner?.variant === 'accent'      ? 'border-accent/40 bg-accent/10 text-matcha-800' :
                                        'border-border bg-muted text-muted-foreground';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> Neue Schicht</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Neue Schicht anlegen</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Mitarbeiter (optional — leer = unbesetzt)</Label>
            <select value={employeeId} onChange={e => setEmployeeId(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— unbesetzt —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.vorname} {e.nachname}</option>)}
            </select>
          </div>
          {banner && (
            <div className={`col-span-2 flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${bannerClass}`}>
              {status.kind === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : banner.icon}
              <span>{banner.text}</span>
            </div>
          )}
          <div><Label>Datum</Label><Input name="datum" type="date" value={datum} onChange={e => setDatum(e.target.value)} required /></div>
          <div><Label>Position</Label><Input name="position" placeholder="Barista" /></div>
          <div><Label>Start</Label><Input name="start" type="time" value={startT} onChange={e => setStartT(e.target.value)} required /></div>
          <div><Label>Ende</Label><Input name="ende" type="time" value={endT} onChange={e => setEndT(e.target.value)} required /></div>
          <div><Label>Pause (Min.)</Label><Input name="pause" type="number" defaultValue="30" /></div>
          <div className="col-span-2"><Label>Schicht-Typ</Label>
            <select name="typ" defaultValue="normal" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="normal">Normal</option>
              <option value="einarbeitung">🌱 Einarbeitung (betreut)</option>
              <option value="probe">🎓 Probeschicht (wird bewertet)</option>
            </select>
          </div>
          <div><Label>Standort</Label>
            <select name="location_id" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">—</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="col-span-2"><Label>Abteilung</Label>
            <select name="department_id" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">—</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {err && <p className="col-span-2 text-sm text-destructive">{err}</p>}
          <DialogFooter className="col-span-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button type="submit" disabled={isPending}>{isPending ? '...' : 'Anlegen'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
