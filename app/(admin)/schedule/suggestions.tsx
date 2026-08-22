'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, Star } from 'lucide-react';
import { validateShift, type ShiftLike } from '@/lib/validation/arbzg';

type Avail = { employee_id: string; weekday: number; start_time: string; end_time: string; typ: 'verfügbar' | 'bevorzugt' | 'gesperrt' };
type Exc = { employee_id: string; datum: string; typ: 'verfügbar' | 'bevorzugt' | 'gesperrt'; grund: string | null };
type Wish = { employee_id: string; datum: string; zeit_von: string | null; zeit_bis: string | null; typ: string | null };
type OtherShift = { employee_id: string; start_zeit: string; end_zeit: string; pause_minuten: number | null };
type Emp = { id: string; vorname: string; nachname: string; rolle?: string | null; geburtsdatum?: string | null; wochenstunden?: number | null };

export type SuggestionScore = {
  employee: Emp;
  score: number;
  reasons: { label: string; kind: 'good' | 'neutral' | 'bad' }[];
  hardBlock: boolean;
};

function timeToMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + (m ?? 0); }
function weekdayMon0(d: Date) { return (d.getDay() + 6) % 7; }

function rankEmployee(
  emp: Emp,
  shift: { datum: string; start: string; end: string; pause_minuten: number },
  avail: Avail[],
  exc: Exc[],
  wishes: Wish[],
  others: OtherShift[],
): SuggestionScore {
  const reasons: SuggestionScore['reasons'] = [];
  let score = 50;
  let hardBlock = false;

  const sMin = timeToMin(shift.start);
  const eMin = timeToMin(shift.end);
  const weekday = weekdayMon0(new Date(shift.datum + 'T00:00:00'));

  // 1) Ausnahme am Datum
  const exception = exc.find(e => e.employee_id === emp.id && e.datum === shift.datum);
  if (exception) {
    if (exception.typ === 'gesperrt') {
      score -= 200;
      hardBlock = true;
      reasons.push({ label: exception.grund ? `Abwesend (${exception.grund})` : 'Abwesend', kind: 'bad' });
    } else {
      score += 15;
      reasons.push({ label: 'Sonder-Verfügbarkeit', kind: 'good' });
    }
  } else {
    // 2) Wochenraster
    const ranges = avail.filter(a => a.employee_id === emp.id && a.weekday === weekday);
    if (ranges.length === 0) {
      score -= 20;
      reasons.push({ label: 'Wochentag nicht hinterlegt', kind: 'neutral' });
    } else {
      const hitsBlock = ranges.some(r => r.typ === 'gesperrt' && timeToMin(r.start_time) < eMin && timeToMin(r.end_time) > sMin);
      if (hitsBlock) {
        score -= 200;
        hardBlock = true;
        reasons.push({ label: 'Zeit gesperrt', kind: 'bad' });
      } else {
        const pos = ranges.filter(r => r.typ !== 'gesperrt').sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time));
        let covered = sMin;
        let anyPref = false;
        for (const r of pos) {
          const rs = timeToMin(r.start_time), re = timeToMin(r.end_time);
          if (rs > covered) break;
          covered = Math.max(covered, re);
          if (r.typ === 'bevorzugt') anyPref = true;
        }
        if (covered >= eMin) {
          if (anyPref) { score += 40; reasons.push({ label: 'Bevorzugt hier', kind: 'good' }); }
          else         { score += 25; reasons.push({ label: 'Verfügbar', kind: 'good' }); }
        } else {
          score -= 10;
          reasons.push({ label: 'Nur teilweise verfügbar', kind: 'neutral' });
        }
      }
    }
  }

  // 3) Wunsch für diesen Tag
  const wish = wishes.find(w => w.employee_id === emp.id && w.datum === shift.datum);
  if (wish) {
    if (wish.zeit_von && wish.zeit_bis) {
      const wsMin = timeToMin(wish.zeit_von), weMin = timeToMin(wish.zeit_bis);
      const overlap = Math.max(0, Math.min(weMin, eMin) - Math.max(wsMin, sMin));
      const wishLen = weMin - wsMin;
      if (overlap > wishLen * 0.7) { score += 25; reasons.push({ label: 'Wunsch passt', kind: 'good' }); }
      else if (overlap > 0)         { score += 10; reasons.push({ label: 'Wunsch überlappt', kind: 'neutral' }); }
    } else {
      score += 10; reasons.push({ label: 'Wunsch diesen Tag', kind: 'good' });
    }
  }

  // 4) ArbZG — prüft Konflikte mit anderen Schichten (Ruhezeit, Tagesarbeit, Minderjährig)
  const shiftStart = new Date(`${shift.datum}T${shift.start}:00`);
  const shiftEnd = new Date(`${shift.datum}T${shift.end}:00`);
  const otherLikes: ShiftLike[] = others
    .filter(o => o.employee_id === emp.id)
    .map(o => ({ start: new Date(o.start_zeit), end: new Date(o.end_zeit), pauseMinutes: o.pause_minuten }));
  const warnings = validateShift(
    { start: shiftStart, end: shiftEnd, pauseMinutes: shift.pause_minuten },
    otherLikes,
    { geburtsdatum: emp.geburtsdatum, wochenstunden: emp.wochenstunden },
  );
  for (const w of warnings) {
    if (w.severity === 'error') { score -= 60; reasons.push({ label: w.message, kind: 'bad' }); hardBlock = true; }
    else if (w.severity === 'warn') { score -= 15; reasons.push({ label: w.message, kind: 'neutral' }); }
  }

  return { employee: emp, score, reasons, hardBlock };
}

export function Suggestions({
  shift, employees, onAssign,
}: {
  shift: { datum: string; start: string; end: string; pause_minuten: number };
  employees: Emp[];
  onAssign: (empId: string) => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [scores, setScores] = React.useState<SuggestionScore[]>([]);
  const [showAll, setShowAll] = React.useState(false);

  React.useEffect(() => {
    if (!shift.datum || !shift.start || !shift.end || employees.length === 0) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const sb = createClient();
      const weekStart = new Date(shift.datum + 'T00:00:00'); weekStart.setDate(weekStart.getDate() - 7);
      const weekEnd = new Date(shift.datum + 'T00:00:00'); weekEnd.setDate(weekEnd.getDate() + 14);

      const empIds = employees.map(e => e.id);
      const [
        { data: fullEmps }, { data: avail }, { data: exc }, { data: wishes }, { data: others },
      ] = await Promise.all([
        sb.from('employees').select('id,vorname,nachname,rolle,geburtsdatum,wochenstunden').in('id', empIds),
        sb.from('employee_availability').select('employee_id,weekday,start_time,end_time,typ'),
        sb.from('availability_exceptions').select('employee_id,datum,typ,grund').eq('datum', shift.datum),
        sb.from('shift_wishes').select('employee_id,datum,zeit_von,zeit_bis,typ').eq('datum', shift.datum),
        sb.from('shifts').select('employee_id,start_zeit,end_zeit,pause_minuten')
          .gte('start_zeit', weekStart.toISOString()).lt('start_zeit', weekEnd.toISOString())
          .not('employee_id', 'is', null),
      ]);
      if (cancelled) return;

      const empMap = new Map<string, Emp>();
      for (const e of (fullEmps as Emp[] | null) ?? []) empMap.set(e.id, e);

      const ranked = employees.map(e => empMap.get(e.id) ?? e).map(emp =>
        rankEmployee(emp, shift,
          (avail ?? []) as Avail[],
          (exc ?? []) as Exc[],
          (wishes ?? []) as Wish[],
          (others ?? []) as OtherShift[],
        ),
      ).sort((a, b) => b.score - a.score);

      setScores(ranked);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [shift.datum, shift.start, shift.end, shift.pause_minuten, employees]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Vorschläge werden berechnet …
      </div>
    );
  }

  const visible = showAll ? scores : scores.filter(s => !s.hardBlock).slice(0, 5);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-matcha-700">
        <Sparkles className="h-3.5 w-3.5" /> Vorschläge
      </div>
      {visible.length === 0 ? (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Keine geeigneten Mitarbeiter gefunden.
        </div>
      ) : (
        visible.map((s, i) => (
          <div
            key={s.employee.id}
            className={`flex items-start justify-between gap-2 rounded-md border p-2 text-xs ${s.hardBlock ? 'border-destructive/30 bg-destructive/5' : 'bg-card'}`}
          >
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                {i === 0 && !s.hardBlock && <Star className="h-3 w-3 fill-gold text-gold" />}
                <span className="font-medium">{s.employee.vorname} {s.employee.nachname}</span>
                <span className="text-[10px] text-muted-foreground">({s.score})</span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {s.reasons.slice(0, 3).map((r, j) => (
                  <span
                    key={j}
                    className={
                      r.kind === 'good' ? 'text-matcha-700' :
                      r.kind === 'bad'  ? 'text-destructive' :
                                          'text-muted-foreground'
                    }
                  >
                    {r.kind === 'good' ? <CheckCircle2 className="inline h-3 w-3" /> :
                     r.kind === 'bad'  ? <AlertTriangle className="inline h-3 w-3" /> : null}
                    {' '}{r.label}{j < 2 && j < s.reasons.length - 1 ? ' · ' : ''}
                  </span>
                ))}
              </div>
            </div>
            <Button
              size="sm"
              variant={s.hardBlock ? 'outline' : 'secondary'}
              onClick={() => onAssign(s.employee.id)}
              type="button"
            >
              {s.hardBlock ? 'Trotzdem' : 'Zuweisen'}
            </Button>
          </div>
        ))
      )}
      {!showAll && scores.length > visible.length && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          + {scores.length - visible.length} weitere anzeigen (inkl. Blocker)
        </button>
      )}
    </div>
  );
}
