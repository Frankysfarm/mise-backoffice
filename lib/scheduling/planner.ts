export type AvailabilityState = 'kann' | 'moechte' | 'kann_nicht';
export type ConflictSeverity = 'hinweis' | 'warnung' | 'blocker';

export type PlannerShift = {
  id: string;
  employeeId: string | null;
  departmentId: string | null;
  position: string | null;
  start: string;
  end: string;
  pauseMinutes?: number | null;
};

export type PlannerEmployee = {
  id: string;
  departmentId?: string | null;
  positions?: string[];
  weeklyHours?: number | null;
  birthDate?: string | null;
};

export type PlannerAbsence = { employeeId: string; date: string; type: string };
export type PlannerAvailability = { employeeId: string; shiftId: string; state: AvailabilityState };
export type ScheduleConflict = { code: string; severity: ConflictSeverity; shiftId: string; employeeId: string; text: string };

const blockedAbsence = new Set(['urlaub', 'krank', 'abwesend', 'gesperrt', 'nicht_verfuegbar', 'sick', 'unavailable']);
const hours = (shift: PlannerShift) => (Date.parse(shift.end) - Date.parse(shift.start)) / 3_600_000 - (shift.pauseMinutes ?? 0) / 60;
const date = (value: string) => value.slice(0, 10);

export function normalizeAvailabilityState(value: string): AvailabilityState | null {
  return value === 'kann' || value === 'moechte' || value === 'kann_nicht' ? value : null;
}

export function templateInstanceKey(templateSlotId: string, weekStart: string, weekday: number, occurrence: number) {
  return `${templateSlotId}:${weekStart}:${weekday}:${occurrence}`;
}

export function missingTemplateInstances(input: {
  templateSlotId: string; weekStart: string; weekday: number; headcount: number; existingKeys: string[];
}) {
  const existing = new Set(input.existingKeys);
  return Array.from({ length: Math.max(0, input.headcount) }, (_, index) =>
    templateInstanceKey(input.templateSlotId, input.weekStart, input.weekday, index + 1),
  ).filter((key) => !existing.has(key));
}

export function evaluateScheduleConflicts(input: {
  shift: PlannerShift;
  employee: PlannerEmployee;
  allShifts: PlannerShift[];
  absences?: PlannerAbsence[];
}): ScheduleConflict[] {
  const { shift, employee, allShifts, absences = [] } = input;
  const result: ScheduleConflict[] = [];
  const push = (code: string, severity: ConflictSeverity, text: string) => result.push({ code, severity, shiftId: shift.id, employeeId: employee.id, text });
  const others = allShifts.filter((item) => item.id !== shift.id && item.employeeId === employee.id);
  if (others.some((item) => Date.parse(item.start) < Date.parse(shift.end) && Date.parse(item.end) > Date.parse(shift.start)))
    push('doppelbelegung', 'blocker', 'Doppelbelegung: Eine andere Schicht überschneidet sich.');
  if (shift.departmentId && employee.departmentId !== shift.departmentId)
    push('bereich', 'warnung', 'Der benötigte Bereich ist der Person nicht zugeordnet.');
  if (shift.position && !(employee.positions ?? []).some((position) => position.toLocaleLowerCase('de-DE') === shift.position!.toLocaleLowerCase('de-DE')))
    push('qualifikation', 'blocker', `Die benötigte Position „${shift.position}“ fehlt.`);
  if (others.some((item) => {
    const gap = Date.parse(shift.start) >= Date.parse(item.end)
      ? Date.parse(shift.start) - Date.parse(item.end)
      : Date.parse(item.start) >= Date.parse(shift.end) ? Date.parse(item.start) - Date.parse(shift.end) : Infinity;
    return gap >= 0 && gap < 11 * 3_600_000;
  })) push('ruhezeit', 'blocker', 'Die gesetzliche Ruhezeit von 11 Stunden wird unterschritten.');
  const absence = absences.find((item) => item.employeeId === employee.id && item.date === date(shift.start) && blockedAbsence.has(item.type.toLocaleLowerCase('de-DE')));
  if (absence) push(absence.type.toLocaleLowerCase('de-DE') === 'krank' ? 'krankheit' : 'abwesenheit', 'blocker', absence.type.toLocaleLowerCase('de-DE') === 'krank' ? 'Für diesen Tag ist Krankheit eingetragen.' : 'Für diesen Tag ist Urlaub oder Abwesenheit eingetragen.');
  const weeklyTotal = allShifts.filter((item) => item.employeeId === employee.id).reduce((sum, item) => sum + hours(item), 0);
  if (employee.weeklyHours && weeklyTotal > employee.weeklyHours)
    push('vertragsstunden', 'warnung', `${weeklyTotal.toFixed(1)} Std. geplant bei ${employee.weeklyHours} Vertragsstunden.`);
  if (employee.birthDate && ageAt(employee.birthDate, shift.start) < 18) {
    const berlinStart = Number(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', hour12: false }).format(new Date(shift.start)));
    const berlinEnd = Number(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', hour12: false }).format(new Date(shift.end)));
    const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });
    if (dayFormat.format(new Date(shift.start)) !== dayFormat.format(new Date(shift.end)) || berlinStart < 6 || berlinStart >= 20 || berlinEnd < 6 || berlinEnd > 20) push('minderjaehrig_nacht', 'blocker', 'Minderjährige dürfen nur zwischen 06:00 und 20:00 Uhr arbeiten.');
  }
  return result;
}

export function scoreProposal(input: {
  availability: AvailabilityState | null; qualified: boolean; sameDepartment: boolean;
  assignedHours: number; weeklyHours?: number | null; responsibility?: 'hauptverantwortung' | 'stellvertretung' | null;
}) {
  if (input.availability === 'kann_nicht' || !input.qualified) return { eligible: false, score: -1, reason: 'Nicht einsetzbar: Verfügbarkeit oder Qualifikation passt nicht.' };
  let score = input.availability === 'moechte' ? 140 : input.availability === 'kann' ? 110 : 30;
  if (input.sameDepartment) score += 35;
  if (input.responsibility === 'hauptverantwortung') score += 20;
  if (input.responsibility === 'stellvertretung') score += 12;
  score -= Math.round(input.assignedHours * 2);
  if (input.weeklyHours && input.assignedHours >= input.weeklyHours) score -= 80;
  const reason = `${input.availability === 'moechte' ? 'Wunschschicht' : input.availability === 'kann' ? 'Verfügbarkeit passt' : 'Keine Sperre'} · ${input.sameDepartment ? 'Bereich passt' : 'bereichsübergreifend'} · ${input.assignedHours.toFixed(1)} Std. bisher`;
  return { eligible: true, score, reason };
}

export function affectedEmployees(before: PlannerShift[], after: PlannerShift[]) {
  const previous = new Map(before.map((shift) => [shift.id, shift]));
  const ids = new Set<string>();
  for (const shift of after) {
    const old = previous.get(shift.id);
    if (!old || old.employeeId !== shift.employeeId || old.start !== shift.start || old.end !== shift.end) {
      if (old?.employeeId) ids.add(old.employeeId);
      if (shift.employeeId) ids.add(shift.employeeId);
    }
  }
  return [...ids].sort();
}

function ageAt(birthDate: string, at: string) {
  const birth = new Date(`${birthDate}T00:00:00Z`);
  const ref = new Date(at);
  let age = ref.getUTCFullYear() - birth.getUTCFullYear();
  if (ref.getUTCMonth() < birth.getUTCMonth() || (ref.getUTCMonth() === birth.getUTCMonth() && ref.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}
