'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

type Avail = { weekday: number; start_time: string; end_time: string; typ: 'verfügbar' | 'bevorzugt' | 'gesperrt' };
type Exc = { datum: string; typ: 'verfügbar' | 'bevorzugt' | 'gesperrt'; grund: string | null };

export type AvailabilityStatus =
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

export function computeAvailabilityStatus(
  avail: Avail[] | null, exc: Exc[] | null,
  datum: string, startT: string, endT: string,
): AvailabilityStatus {
  if (!avail || !exc) return { kind: 'loading' };
  if (avail.length === 0 && exc.length === 0) return { kind: 'no_data' };

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

  const hitsBlock = ranges.some(r => r.typ === 'gesperrt' && r.s < eMin && r.e > sMin);
  if (hitsBlock) return { kind: 'blocked' };

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

export function isHardBlock(s: AvailabilityStatus) {
  return s.kind === 'blocked' || s.kind === 'exception_block';
}

/** Lädt Verfügbarkeits-Daten für einen Mitarbeiter. Gibt [avail, exc] zurück (null = loading). */
export function useEmployeeAvailability(employeeId: string) {
  const [avail, setAvail] = React.useState<Avail[] | null>(null);
  const [exc, setExc] = React.useState<Exc[] | null>(null);

  React.useEffect(() => {
    if (!employeeId) { setAvail(null); setExc(null); return; }
    let cancelled = false;
    (async () => {
      setAvail(null); setExc(null);
      const sb = createClient();
      const [{ data: a }, { data: e }] = await Promise.all([
        sb.from('employee_availability').select('weekday,start_time,end_time,typ').eq('employee_id', employeeId),
        sb.from('availability_exceptions').select('datum,typ,grund').eq('employee_id', employeeId)
          .gte('datum', new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)),
      ]);
      if (cancelled) return;
      setAvail((a as any) ?? []);
      setExc((e as any) ?? []);
    })();
    return () => { cancelled = true; };
  }, [employeeId]);

  return { avail, exc };
}

export function AvailabilityBanner({ status, employeeName }: { status: AvailabilityStatus; employeeName?: string }) {
  const name = employeeName ?? 'Mitarbeiter';
  const info = React.useMemo(() => {
    switch (status.kind) {
      case 'none':
      case 'loading':
        return null;
      case 'no_data':
        return { variant: 'muted' as const, icon: <AlertTriangle className="h-4 w-4" />, text: `${name} hat noch keine Verfügbarkeit hinterlegt.` };
      case 'covered':
        return {
          variant: status.typ === 'bevorzugt' ? 'secondary' as const : 'accent' as const,
          icon: <CheckCircle2 className="h-4 w-4" />,
          text: status.typ === 'bevorzugt' ? `${name} arbeitet hier bevorzugt ✨` : `${name} ist verfügbar ✓`,
        };
      case 'exception_ok':
        return { variant: 'secondary' as const, icon: <CheckCircle2 className="h-4 w-4" />, text: `${name} hat Sonder-Verfügbarkeit eingetragen` };
      case 'exception_block':
        return { variant: 'destructive' as const, icon: <AlertTriangle className="h-4 w-4" />, text: `${name} ist gesperrt${status.grund ? ` (${status.grund})` : ''}` };
      case 'blocked':
        return { variant: 'destructive' as const, icon: <AlertTriangle className="h-4 w-4" />, text: `${name} hat diesen Zeitraum gesperrt` };
      case 'partial':
        return { variant: 'gold' as const, icon: <AlertTriangle className="h-4 w-4" />, text: `${name} ist nur teilweise verfügbar` };
      case 'outside':
        return { variant: 'gold' as const, icon: <AlertTriangle className="h-4 w-4" />, text: `${name} ist an diesem Wochentag nicht verfügbar` };
    }
  }, [status, name]);

  if (!info) return null;

  const cls =
    info.variant === 'destructive' ? 'border-destructive/40 bg-destructive/10 text-destructive' :
    info.variant === 'gold'        ? 'border-gold/40 bg-gold-soft text-gold' :
    info.variant === 'secondary'   ? 'border-matcha-300 bg-matcha-50 text-matcha-800' :
    info.variant === 'accent'      ? 'border-accent/40 bg-accent/10 text-matcha-800' :
                                     'border-border bg-muted text-muted-foreground';

  return (
    <div className={`col-span-2 flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${cls}`}>
      {status.kind === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : info.icon}
      <span>{info.text}</span>
    </div>
  );
}
