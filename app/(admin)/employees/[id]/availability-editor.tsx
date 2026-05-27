'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dateDE } from '@/lib/utils';

type Avail = { id: string; weekday: number; start_time: string; end_time: string; typ: 'verfügbar' | 'bevorzugt' | 'gesperrt'; notiz: string | null };
type Exc   = { id: string; datum: string; typ: 'verfügbar' | 'bevorzugt' | 'gesperrt'; start_time: string | null; end_time: string | null; grund: string | null };

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06–22

export function AvailabilityEditor({ employeeId, availabilities, exceptions }: {
  employeeId: string;
  availabilities: Avail[];
  exceptions: Exc[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [entries, setEntries] = useState(availabilities);
  const [exc, setExc] = useState(exceptions);

  function entriesFor(day: number, hour: number) {
    return entries.filter(e => e.weekday === day &&
      parseInt(e.start_time.slice(0, 2)) <= hour &&
      parseInt(e.end_time.slice(0, 2)) > hour);
  }

  async function addRange(day: number, hour: number) {
    const existing = entriesFor(day, hour)[0];
    if (existing) {
      // Zyklus: verfügbar → bevorzugt → gesperrt → löschen
      const cycle: Record<string, 'verfügbar' | 'bevorzugt' | 'gesperrt' | null> = {
        verfügbar: 'bevorzugt', bevorzugt: 'gesperrt', gesperrt: null,
      };
      const next = cycle[existing.typ];
      start(async () => {
        const sb = createClient();
        if (next === null) {
          await sb.from('employee_availability').delete().eq('id', existing.id);
          setEntries(es => es.filter(e => e.id !== existing.id));
        } else {
          await sb.from('employee_availability').update({ typ: next }).eq('id', existing.id);
          setEntries(es => es.map(e => e.id === existing.id ? { ...e, typ: next } : e));
        }
      });
    } else {
      start(async () => {
        const sb = createClient();
        const { data, error } = await sb.from('employee_availability').insert({
          employee_id: employeeId, weekday: day,
          start_time: `${String(hour).padStart(2, '0')}:00:00`,
          end_time: `${String(hour + 1).padStart(2, '0')}:00:00`,
          typ: 'verfügbar',
        }).select('*').single();
        if (error) { toastError('Speichern fehlgeschlagen', error.message); return; }
        setEntries(es => [...es, data as Avail]);
      });
    }
  }

  async function addException(fd: FormData) {
    start(async () => {
      const { error } = await createClient().from('availability_exceptions').insert({
        employee_id: employeeId,
        datum: fd.get('datum'),
        typ: fd.get('typ'),
        grund: fd.get('grund') || null,
      });
      if (error) return toastError('Ausnahme speichern fehlgeschlagen', error.message);
      toastSuccess('Ausnahme eingetragen');
      router.refresh();
    });
  }

  async function deleteException(id: string) {
    start(async () => {
      await createClient().from('availability_exceptions').delete().eq('id', id);
      setExc(es => es.filter(e => e.id !== id));
    });
  }

  const typColor = (t: string) => t === 'bevorzugt' ? 'bg-matcha-700 hover:bg-matcha-800'
    : t === 'verfügbar' ? 'bg-matcha-400 hover:bg-matcha-500'
    : 'bg-destructive hover:bg-destructive/80';

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-display font-semibold">Wochen-Raster</h3>
              <p className="text-xs text-muted-foreground">
                Klick: verfügbar → bevorzugt → gesperrt → löschen.
                <span className="ml-2 inline-block h-3 w-3 rounded bg-matcha-400" /> verfügbar ·
                <span className="ml-2 inline-block h-3 w-3 rounded bg-matcha-700" /> bevorzugt ·
                <span className="ml-2 inline-block h-3 w-3 rounded bg-destructive" /> gesperrt
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid min-w-[640px] grid-cols-[auto_repeat(7,1fr)] gap-px bg-border">
              <div className="bg-card p-2 text-xs font-semibold">Uhr</div>
              {DAYS.map((d, i) => <div key={i} className="bg-card p-2 text-center text-xs font-semibold">{d}</div>)}

              {HOURS.map(h => (
                <>
                  <div key={`h-${h}`} className="bg-card px-2 py-1 text-right font-mono text-[10px] text-muted-foreground">
                    {String(h).padStart(2, '0')}:00
                  </div>
                  {DAYS.map((_, day) => {
                    const es = entriesFor(day, h);
                    const e = es[0];
                    return (
                      <button key={`${day}-${h}`} onClick={() => addRange(day, h)} disabled={pending}
                        className={cn('h-7 transition', e ? typColor(e.typ) + ' text-white' : 'bg-card hover:bg-muted')}
                        title={e ? e.typ : 'klicken zum Hinzufügen'}
                      />
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 font-display font-semibold">Ausnahmen (Urlaub, Krank, Sonder-Verfügbarkeit)</h3>
          <form action={addException} className="mb-4 flex flex-wrap items-end gap-2">
            <div className="flex-none"><Label>Datum</Label><Input name="datum" type="date" required /></div>
            <div className="flex-none"><Label>Typ</Label>
              <select name="typ" required className="h-10 rounded-md border bg-background px-3 text-sm">
                <option value="gesperrt">🚫 gesperrt (Urlaub/Krank)</option>
                <option value="verfügbar">✓ zusätzlich verfügbar</option>
              </select>
            </div>
            <div className="flex-1 min-w-[160px]"><Label>Grund (optional)</Label><Input name="grund" placeholder="Urlaub, Arzt, ..." /></div>
            <Button type="submit" disabled={pending}><Plus className="h-4 w-4" /> Eintragen</Button>
          </form>

          {exc.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Ausnahmen.</p>
          ) : (
            <ul className="divide-y">
              {exc.sort((a, b) => a.datum.localeCompare(b.datum)).map(e => (
                <li key={e.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Badge variant={e.typ === 'gesperrt' ? 'destructive' : 'secondary'}>
                      {e.typ === 'gesperrt' ? '🚫' : '✓'} {e.typ}
                    </Badge>
                    <span className="text-sm font-medium">{dateDE(e.datum)}</span>
                    {e.grund && <span className="text-sm text-muted-foreground">— {e.grund}</span>}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => deleteException(e.id)} disabled={pending}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
