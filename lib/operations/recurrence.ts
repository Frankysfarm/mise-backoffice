export type RecurrenceKind = 'daily' | 'weekdays' | 'weekly' | 'monthly_day' | 'monthly_weekday' | 'shift' | 'opening' | 'closing' | 'interval';

export type RecurrenceRule = {
  kind: RecurrenceKind;
  time?: string;
  weekdays?: number[];
  day?: number;
  ordinal?: number;
  weekday?: number;
  interval?: number;
  unit?: 'days' | 'weeks';
};

const BERLIN = 'Europe/Berlin';

function berlinParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: BERLIN, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const weekdays: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { year: Number(value('year')), month: Number(value('month')), day: Number(value('day')), weekday: weekdays[value('weekday')] };
}

function berlinInstant(year: number, month: number, day: number, time = '09:00') {
  const [hour, minute] = time.split(':').map(Number);
  let instant = new Date(Date.UTC(year, month - 1, day, hour - 1, minute));
  for (let index = 0; index < 3; index += 1) {
    const shown = new Intl.DateTimeFormat('en-GB', { timeZone: BERLIN, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant);
    const [shownHour, shownMinute] = shown.split(':').map(Number);
    const difference = (hour * 60 + minute) - (shownHour * 60 + shownMinute);
    if (!difference) break;
    instant = new Date(instant.getTime() + difference * 60_000);
  }
  return instant;
}

export function berlinDateBoundary(date: string, endOfDay = false) {
  const [year, month, day] = date.split('-').map(Number);
  return berlinInstant(year, month, day, endOfDay ? '23:59' : '00:00').toISOString();
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function validateRecurrenceRule(rule: RecurrenceRule) {
  if (!['daily', 'weekdays', 'weekly', 'monthly_day', 'monthly_weekday', 'shift', 'opening', 'closing', 'interval'].includes(rule.kind)) return false;
  if (rule.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.time)) return false;
  if (rule.kind === 'weekdays' && (!rule.weekdays?.length || rule.weekdays.some((day) => day < 1 || day > 7))) return false;
  if (rule.kind === 'weekly' && (!rule.weekday || rule.weekday < 1 || rule.weekday > 7)) return false;
  if (rule.kind === 'monthly_day' && (!rule.day || rule.day < 1 || rule.day > 31)) return false;
  if (rule.kind === 'monthly_weekday' && (!rule.ordinal || rule.ordinal < 1 || rule.ordinal > 5 || !rule.weekday || rule.weekday < 1 || rule.weekday > 7)) return false;
  if (rule.kind === 'interval' && (!rule.interval || rule.interval < 1 || rule.interval > 365 || !['days', 'weeks'].includes(rule.unit ?? ''))) return false;
  return true;
}

export function previewRecurrence(rule: RecurrenceRule, start: Date, count = 5): Date[] {
  if (!validateRecurrenceRule(rule) || ['shift', 'opening', 'closing'].includes(rule.kind)) return [];
  const origin = berlinParts(start);
  const results: Date[] = [];
  for (let offset = 0; offset < 740 && results.length < count; offset += 1) {
    const cursor = new Date(Date.UTC(origin.year, origin.month - 1, origin.day + offset, 12));
    const local = berlinParts(cursor);
    let matches = false;
    if (rule.kind === 'daily') matches = true;
    if (rule.kind === 'weekdays') matches = Boolean(rule.weekdays?.includes(local.weekday));
    if (rule.kind === 'weekly') matches = local.weekday === (rule.weekday ?? origin.weekday);
    if (rule.kind === 'monthly_day') matches = local.day === Math.min(rule.day ?? 1, daysInMonth(local.year, local.month));
    if (rule.kind === 'monthly_weekday') matches = local.weekday === rule.weekday && Math.ceil(local.day / 7) === rule.ordinal;
    if (rule.kind === 'interval') matches = offset % ((rule.interval ?? 1) * (rule.unit === 'weeks' ? 7 : 1)) === 0;
    if (matches) results.push(berlinInstant(local.year, local.month, local.day, rule.time));
  }
  return results;
}

export function recurrenceLabel(rule: RecurrenceRule) {
  const weekday = (day?: number) => ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][(day ?? 1) - 1] ?? 'Mo';
  const weekdayLong = (day?: number) => ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'][(day ?? 1) - 1] ?? 'Montag';
  if (rule.kind === 'daily') return 'Täglich';
  if (rule.kind === 'weekdays') return `Wochentage: ${(rule.weekdays ?? []).map(weekday).join(', ')}`;
  if (rule.kind === 'weekly') return `Wöchentlich am ${weekdayLong(rule.weekday)}`;
  if (rule.kind === 'monthly_day') return `Monatlich am ${rule.day}.`;
  if (rule.kind === 'monthly_weekday') return `Jeden ${rule.ordinal}. ${weekdayLong(rule.weekday)} im Monat`;
  if (rule.kind === 'shift') return 'Pro Schicht';
  if (rule.kind === 'opening') return 'Bei Öffnung';
  if (rule.kind === 'closing') return 'Bei Schließung';
  return `Alle ${rule.interval} ${rule.unit === 'weeks' ? 'Wochen' : 'Tage'}`;
}
