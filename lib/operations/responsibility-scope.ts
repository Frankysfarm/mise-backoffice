export type ResponsibilitySchedule = {
  valid_from: string;
  valid_until: string | null;
  weekday_scope: number[];
  shift_start: string | null;
  shift_end: string | null;
};

type BerlinScheduleMoment = {
  date: string;
  weekday: number;
  time: string;
  previousDate: string;
  previousWeekday: number;
};

export function berlinScheduleMoment(now = new Date()): BerlinScheduleMoment {
  const date = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(now);
  const weekdayName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin', weekday: 'short',
  }).format(now);
  const weekday = ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[weekdayName];
  const previous = new Date(`${date}T12:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return {
    date, weekday, time,
    previousDate: previous.toISOString().slice(0, 10),
    previousWeekday: weekday === 1 ? 7 : weekday - 1,
  };
}

export function isResponsibilityScheduleActive(
  schedule: ResponsibilitySchedule,
  moment = berlinScheduleMoment(),
): boolean {
  const start = schedule.shift_start?.slice(0, 5) ?? null;
  const end = schedule.shift_end?.slice(0, 5) ?? null;
  const overnightContinuation = Boolean(start && end && start > end && moment.time <= end);
  const effectiveDate = overnightContinuation ? moment.previousDate : moment.date;
  const effectiveWeekday = overnightContinuation ? moment.previousWeekday : moment.weekday;
  if (schedule.valid_from > effectiveDate || (schedule.valid_until && schedule.valid_until < effectiveDate)) return false;
  if (!schedule.weekday_scope.includes(effectiveWeekday)) return false;
  if (!start && !end) return true;
  if (start && !end) return moment.time >= start;
  if (!start && end) return moment.time <= end;
  if (start! <= end!) return moment.time >= start! && moment.time <= end!;
  return moment.time >= start! || overnightContinuation;
}
