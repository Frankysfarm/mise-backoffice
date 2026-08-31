'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { DndContext, type DragEndEvent, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { validateShift, validateWeek, highestSeverity, type ArbZGWarning, type ShiftLike } from '@/lib/validation/arbzg';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { EditShiftDialog } from './edit-shift-dialog';
import { evaluateScheduleConflicts, type PlannerAbsence, type ScheduleConflict } from '@/lib/scheduling/planner';

export type Shift = {
  id: string;
  start_zeit: string;
  end_zeit: string;
  status: string;
  position: string | null;
  pause_minuten: number | null;
  employee_id: string | null;
  department_id: string | null;
  location_id: string | null;
  typ?: string | null;
  notiz?: string | null;
  offen_fuer_bewerbung?: boolean | null;
  employee: { id?: string; vorname?: string; nachname?: string; rolle?: string; geburtsdatum?: string; wochenstunden?: number; department_id?: string | null; position_title?: string | null } | null;
  department: { name?: string; farbe?: string } | null;
  location: { name?: string } | null;
};

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function toDate(s: string) { return new Date(s); }
function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

type AvailabilityResponse = { shift_id: string; state: string; applied: boolean; employee: { vorname: string; nachname: string } | { vorname: string; nachname: string }[] | null };

export function ScheduleWeek({ weekStart, initialShifts, employees, departments, locations, absences, availabilityResponses }: {
  weekStart: Date;
  initialShifts: Shift[];
  employees: { id: string; vorname: string; nachname: string }[];
  departments: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  absences: PlannerAbsence[];
  availabilityResponses: AvailabilityResponse[];
}) {
  const router = useRouter();
  const dndContextId = React.useId();
  const [shifts, setShifts] = React.useState(initialShifts);
  const [editingShift, setEditingShift] = React.useState<Shift | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Server-Daten nachziehen (z.B. nach router.refresh())
  React.useEffect(() => { setShifts(initialShifts); }, [initialShifts]);

  // Realtime-Updates aus anderen Sessions oder Mobile
  useRealtimeTable({
    channel: 'schedule-shifts', table: 'shifts',
    onChange: () => router.refresh(),
  });

  // Warnungen pro Schicht cachen — neu berechnen wenn shifts sich ändern
  const warningsByShift = React.useMemo(() => {
    const map = new Map<string, ArbZGWarning[]>();
    for (const s of shifts) {
      if (!s.employee_id) { map.set(s.id, []); continue; }
      const otherShiftsOfEmp: ShiftLike[] = shifts
        .filter(o => o.id !== s.id && o.employee_id === s.employee_id)
        .map(o => ({ start: toDate(o.start_zeit), end: toDate(o.end_zeit), pauseMinutes: o.pause_minuten }));
      const warnings = validateShift(
        { start: toDate(s.start_zeit), end: toDate(s.end_zeit), pauseMinutes: s.pause_minuten },
        otherShiftsOfEmp,
        { geburtsdatum: s.employee?.geburtsdatum, wochenstunden: s.employee?.wochenstunden },
      );
      map.set(s.id, warnings);
    }
    return map;
  }, [shifts]);

  const conflictsByShift = React.useMemo(() => {
    const plannerShifts = shifts.map(s => ({
      id: s.id, employeeId: s.employee_id, departmentId: s.department_id, position: s.position,
      start: s.start_zeit, end: s.end_zeit, pauseMinutes: s.pause_minuten,
    }));
    return new Map(shifts.map(s => {
      if (!s.employee_id || !s.employee) return [s.id, [] as ScheduleConflict[]] as const;
      return [s.id, evaluateScheduleConflicts({
        shift: plannerShifts.find(item => item.id === s.id)!,
        employee: {
          id: s.employee_id,
          departmentId: s.employee.department_id,
          positions: [s.employee.position_title, s.employee.rolle].filter((value): value is string => Boolean(value)),
          weeklyHours: s.employee.wochenstunden,
          birthDate: s.employee.geburtsdatum,
        },
        allShifts: plannerShifts,
        absences,
      })] as const;
    }));
  }, [absences, shifts]);

  const responsesByShift = React.useMemo(() => {
    const map = new Map<string, AvailabilityResponse[]>();
    for (const response of availabilityResponses) map.set(response.shift_id, [...(map.get(response.shift_id) ?? []), response]);
    return map;
  }, [availabilityResponses]);

  // Wochenstunden-Check pro Employee
  const weekWarningsByEmp = React.useMemo(() => {
    const byEmp = new Map<string, Shift[]>();
    for (const s of shifts) {
      if (!s.employee_id) continue;
      const arr = byEmp.get(s.employee_id) ?? [];
      arr.push(s);
      byEmp.set(s.employee_id, arr);
    }
    const result = new Map<string, ArbZGWarning[]>();
    for (const [empId, arr] of byEmp) {
      const w = validateWeek(
        arr.map(s => ({ start: toDate(s.start_zeit), end: toDate(s.end_zeit), pauseMinutes: s.pause_minuten })),
        { geburtsdatum: arr[0].employee?.geburtsdatum, wochenstunden: arr[0].employee?.wochenstunden },
        weekStart,
      );
      if (w.length) result.set(empId, w);
    }
    return result;
  }, [shifts, weekStart]);

  const days = React.useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
    }), [weekStart]);

  function shiftsFor(d: Date) {
    return shifts.filter(s => sameDay(toDate(s.start_zeit), d))
      .sort((a, b) => a.start_zeit.localeCompare(b.start_zeit));
  }

  async function onDragEnd(ev: DragEndEvent) {
    const shiftId = ev.active?.id as string | undefined;
    const overId = ev.over?.id as string | undefined; // format "day-YYYY-MM-DD"
    if (!shiftId || !overId) return;

    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return;
    const targetIso = overId.replace(/^day-/, '');
    const currentIso = shift.start_zeit.slice(0, 10);
    if (targetIso === currentIso) return;

    // Uhrzeit beibehalten, nur Datum verschieben
    const start = toDate(shift.start_zeit);
    const end = toDate(shift.end_zeit);
    const durationMs = end.getTime() - start.getTime();
    const [y, m, d] = targetIso.split('-').map(Number);
    const newStart = new Date(start);
    newStart.setFullYear(y, m - 1, d);
    const newEnd = new Date(newStart.getTime() + durationMs);

    // Optimistisch
    setShifts(rs => rs.map(r => r.id === shiftId
      ? { ...r, start_zeit: newStart.toISOString(), end_zeit: newEnd.toISOString() }
      : r,
    ));

    const { error } = await createClient().from('shifts').update({
      start_zeit: newStart.toISOString(),
      end_zeit: newEnd.toISOString(),
    }).eq('id', shiftId);

    if (error) {
      toastError('Verschieben fehlgeschlagen', error.message);
      // Rollback
      setShifts(initialShifts);
      router.refresh();
    } else {
      toastSuccess('Schicht verschoben', `Auf ${new Date(targetIso).toLocaleDateString('de-DE')}.`);
    }
  }

  return (
    <DndContext id={dndContextId} sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-7 divide-x">
        {days.map(d => (
          <Day
            key={isoDate(d)}
            date={d}
            shifts={shiftsFor(d)}
            warningsByShift={warningsByShift}
            conflictsByShift={conflictsByShift}
            responsesByShift={responsesByShift}
            onEdit={setEditingShift}
          />
        ))}
      </div>

      <EditShiftDialog
        open={editingShift !== null}
        onOpenChange={(open) => { if (!open) setEditingShift(null); }}
        shift={editingShift}
        employees={employees}
        departments={departments}
        locations={locations}
      />

      {weekWarningsByEmp.size > 0 && (
        <div className="border-t p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" /> ArbZG-Wochen-Warnungen
          </div>
          <ul className="space-y-1 text-xs">
            {[...weekWarningsByEmp.entries()].map(([empId, warns]) => {
              const emp = shifts.find(s => s.employee_id === empId)?.employee;
              return warns.map((w, i) => (
                <li key={`${empId}-${i}`} className="text-destructive">
                  {emp?.vorname} {emp?.nachname}: {w.message}
                </li>
              ));
            })}
          </ul>
        </div>
      )}
    </DndContext>
  );
}

function Day({ date, shifts, warningsByShift, conflictsByShift, responsesByShift, onEdit }: {
  date: Date;
  shifts: Shift[];
  warningsByShift: Map<string, ArbZGWarning[]>;
  conflictsByShift: Map<string, ScheduleConflict[]>;
  responsesByShift: Map<string, AvailabilityResponse[]>;
  onEdit: (shift: Shift) => void;
}) {
  const iso = isoDate(date);
  const weekdayIdx = (date.getDay() + 6) % 7;
  const { setNodeRef, isOver } = useDroppable({ id: `day-${iso}` });
  const today = sameDay(date, new Date());

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[360px] p-2 transition-colors',
        today && 'bg-matcha-50/40',
        isOver && 'bg-matcha-100/80 ring-2 ring-matcha-600 ring-inset',
      )}
    >
      <div className="mb-2 flex items-baseline gap-2">
        <div className={cn('font-display text-lg font-bold', today && 'text-matcha-700')}>
          {WEEKDAYS[weekdayIdx]}
        </div>
        <div className="text-xs text-muted-foreground">{date.getDate()}.{date.getMonth() + 1}.</div>
      </div>
      <div className="space-y-1.5">
        {shifts.map(s => (
          <DraggableShift key={s.id} s={s} warnings={warningsByShift.get(s.id) ?? []} conflicts={conflictsByShift.get(s.id) ?? []} responses={responsesByShift.get(s.id) ?? []} onEdit={onEdit} />
        ))}
        {shifts.length === 0 && (
          <div className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
            Hier ablegen
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableShift({ s, warnings, conflicts, responses, onEdit }: {
  s: Shift;
  warnings: ArbZGWarning[];
  conflicts: ScheduleConflict[];
  responses: AvailabilityResponse[];
  onEdit: (shift: Shift) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: s.id });
  const start = toDate(s.start_zeit);
  const end = toDate(s.end_zeit);
  const fmt = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const color = s.department?.farbe ?? '#2d6b45';
  const unassigned = !s.employee_id;
  const severity = conflicts.some(conflict => conflict.severity === 'blocker') ? 'error' : conflicts.length ? 'warn' : highestSeverity(warnings);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
      className={cn(
        'group cursor-grab active:cursor-grabbing rounded-md border-l-4 bg-card p-2 text-xs shadow-subtle',
        isDragging && 'opacity-50 ring-2 ring-primary',
        unassigned && 'border-destructive bg-destructive/5',
        severity === 'error' && 'ring-1 ring-destructive',
        severity === 'warn' && 'ring-1 ring-gold',
      )}
      title={[...conflicts.map(conflict => conflict.text), ...warnings.map(w => w.message)].join('\n')}
    >
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] text-muted-foreground">{fmt(start)}–{fmt(end)}</div>
        <div className="flex items-center gap-1">
          {severity && (
            <AlertTriangle className={cn('h-3 w-3', severity === 'error' ? 'text-destructive' : 'text-gold')} />
          )}
          <button
            type="button"
            aria-label={`Schicht von ${unassigned ? 'Unbesetzt' : `${s.employee?.vorname ?? ''} ${s.employee?.nachname ?? ''}`} bearbeiten`}
            className="rounded p-1 text-muted-foreground opacity-70 transition hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); onEdit(s); }}
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="font-medium" style={!unassigned ? { color } : undefined}>
        {unassigned ? '⚠ Unbesetzt' : `${s.employee?.vorname ?? ''} ${s.employee?.nachname ?? ''}`}
      </div>
      {s.position && <div className="text-[10px] text-muted-foreground">{s.position}</div>}
      {s.department?.name && <div className="text-[10px] text-muted-foreground">{s.department.name}</div>}
      {warnings.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {warnings.slice(0, 2).map((w, i) => (
            <div key={i} className={cn('text-[10px] leading-tight', w.severity === 'error' ? 'text-destructive' : 'text-gold-700')}>
              · {w.message}
            </div>
          ))}
        </div>
      )}
      {conflicts.length > 0 && <div className="mt-1 space-y-0.5">{conflicts.slice(0, 3).map(conflict => <div key={conflict.code} className={cn('text-[10px] leading-tight', conflict.severity === 'blocker' ? 'text-destructive' : 'text-gold-700')}>· Konflikt: {conflict.text}</div>)}</div>}
      {responses.length > 0 && <div className="mt-1 border-t pt-1 text-[10px] text-sky-700">{responses.map(response => { const employee = Array.isArray(response.employee) ? response.employee[0] : response.employee; return <div key={`${response.shift_id}-${employee?.vorname}-${employee?.nachname}`}>{employee?.vorname} {employee?.nachname}: {response.state === 'moechte' ? 'möchte' : response.state === 'kann_nicht' ? 'kann nicht' : 'kann'}</div>; })}</div>}
    </div>
  );
}
