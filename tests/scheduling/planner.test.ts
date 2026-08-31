import { describe, expect, it } from 'vitest';
import { affectedEmployees, evaluateScheduleConflicts, missingTemplateInstances, normalizeAvailabilityState, scoreProposal, type PlannerShift } from '@/lib/scheduling/planner';

const shift: PlannerShift = { id: 'new', employeeId: 'e1', departmentId: 'bar', position: 'Barista', start: '2026-09-01T16:00:00Z', end: '2026-09-01T23:00:00Z', pauseMinutes: 30 };
const employee = { id: 'e1', departmentId: 'kueche', positions: ['Service'], weeklyHours: 8 };

describe('Dienstplan-Domäne', () => {
  it('wendet Vorlagen idempotent und nach Personalbedarf an', () => expect(missingTemplateInstances({ templateSlotId: 'slot', weekStart: '2026-08-31', weekday: 1, headcount: 2, existingKeys: ['slot:2026-08-31:1:1'] })).toEqual(['slot:2026-08-31:1:2']));
  it('akzeptiert nur die drei Verfügbarkeitszustände', () => { expect(normalizeAvailabilityState('moechte')).toBe('moechte'); expect(normalizeAvailabilityState('vielleicht')).toBeNull(); });
  it('bewertet Wünsche, Bereich, Verantwortung und Stunden deterministisch', () => expect(scoreProposal({ availability: 'moechte', qualified: true, sameDepartment: true, assignedHours: 4, weeklyHours: 20, responsibility: 'hauptverantwortung' })).toEqual({ eligible: true, score: 187, reason: 'Wunschschicht · Bereich passt · 4.0 Std. bisher' }));
  it('erkennt Doppelbelegung', () => expect(codes([{ ...shift, id: 'old', start: '2026-09-01T17:00:00Z' }])).toContain('doppelbelegung'));
  it('erkennt fehlenden Bereich und fehlende Position', () => expect(codes()).toEqual(expect.arrayContaining(['bereich', 'qualifikation'])));
  it('erkennt Ruhezeit unter elf Stunden', () => expect(codes([{ ...shift, id: 'old', start: '2026-09-01T08:00:00Z', end: '2026-09-01T10:00:00Z' }])).toContain('ruhezeit'));
  it('unterscheidet Urlaub und Krankheit', () => { expect(codes([], 'urlaub')).toContain('abwesenheit'); expect(codes([], 'krank')).toContain('krankheit'); });
  it('erkennt überschrittene Vertragsstunden', () => expect(codes([{ ...shift, id: 'old', start: '2026-09-02T08:00:00Z', end: '2026-09-02T12:00:00Z' }])).toContain('vertragsstunden'));
  it('prüft Nachtarbeit für Minderjährige nur bei vorhandenem Geburtsdatum', () => expect(evaluateScheduleConflicts({ shift, employee: { ...employee, birthDate: '2010-01-01' }, allShifts: [shift] }).map(c => c.code)).toContain('minderjaehrig_nacht'));
  it('ermittelt bei Veröffentlichungsänderungen nur Betroffene', () => expect(affectedEmployees([{ ...shift, employeeId: 'e1' }], [{ ...shift, employeeId: 'e2' }])).toEqual(['e1', 'e2']));
});

function codes(others: PlannerShift[] = [], absence?: string) {
  return evaluateScheduleConflicts({ shift, employee, allShifts: [shift, ...others], absences: absence ? [{ employeeId: 'e1', date: '2026-09-01', type: absence }] : [] }).map(c => c.code);
}
