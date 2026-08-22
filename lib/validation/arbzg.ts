// Arbeitszeitgesetz-Validator (Deutschland).
// Pure Function — keine Side-Effects, keine Abhängigkeit von DOM/DB.
//
// Regeln (vereinfacht):
//   §3  Max 8h Werktag, max 10h bei Ausgleich innerhalb 24 Wochen
//   §4  Ruhepause: 30 Min bei 6–9h, 45 Min bei >9h
//   §5  Mindestruhezeit zwischen Schichten: 11 Stunden
//   §6  Nachtarbeit — hier nicht modelliert
//   §21a (JArbSchG): Jugendliche (<18) → max 8h/Tag, 40h/Woche, 12h Ruhezeit, keine Nachtarbeit
//
// Bewusst ausgelassen: 6-Monats-Ausgleich, Sonntagsarbeit, Nachtzuschläge.

export type Severity = 'info' | 'warn' | 'error';
export type ArbZGWarning = { severity: Severity; code: string; message: string };

export type ShiftLike = {
  start: Date;
  end: Date;
  pauseMinutes?: number | null;
};

export type EmployeeContext = {
  geburtsdatum?: string | null;   // YYYY-MM-DD
  wochenstunden?: number | null;
};

export function validateShift(
  shift: ShiftLike,
  otherShifts: ShiftLike[],
  employee?: EmployeeContext,
): ArbZGWarning[] {
  const warnings: ArbZGWarning[] = [];
  const minderjährig = isMinor(employee?.geburtsdatum ?? null, shift.start);

  const grossMin = Math.round((shift.end.getTime() - shift.start.getTime()) / 60_000);
  const pauseMin = shift.pauseMinutes ?? 0;
  const workMin = grossMin - pauseMin;
  const workH = workMin / 60;

  // §3 Max-Tagesarbeitszeit
  const maxH = minderjährig ? 8 : 10;
  if (workH > maxH) {
    warnings.push({
      severity: 'error',
      code: 'arbzg_max_tagesarbeitszeit',
      message: `Max ${maxH}h Tagesarbeitszeit überschritten (${workH.toFixed(1)}h geplant)${minderjährig ? ' — Minderjährig!' : ''}.`,
    });
  } else if (!minderjährig && workH > 8) {
    warnings.push({
      severity: 'warn',
      code: 'arbzg_8h_plus',
      message: `>8h Arbeitszeit (${workH.toFixed(1)}h) — Ausgleich innerhalb 24 Wochen nötig.`,
    });
  }

  // §4 Pausen
  const requiredPause = workH > 9 ? 45 : workH > 6 ? 30 : 0;
  if (requiredPause > 0 && pauseMin < requiredPause) {
    warnings.push({
      severity: 'error',
      code: 'arbzg_pause',
      message: `Pause zu kurz: ${pauseMin} Min. geplant, ${requiredPause} Min. nötig bei ${workH.toFixed(1)}h.`,
    });
  }

  // §5 Ruhezeit zwischen Schichten
  const requiredRestH = minderjährig ? 12 : 11;
  for (const other of otherShifts) {
    const gap = minGap(shift, other);
    if (gap === null) continue;
    if (gap.hours < requiredRestH) {
      warnings.push({
        severity: 'error',
        code: 'arbzg_ruhezeit',
        message: `Nur ${gap.hours.toFixed(1)}h Ruhezeit zur ${gap.direction === 'before' ? 'vorherigen' : 'nächsten'} Schicht (${requiredRestH}h gefordert${minderjährig ? ', JArbSchG' : ''}).`,
      });
    }
  }

  // JArbSchG Nachtarbeit
  if (minderjährig) {
    const startH = shift.start.getHours();
    const endH = shift.end.getHours() + (shift.end.getDate() !== shift.start.getDate() ? 24 : 0);
    if (startH < 6 || endH > 20) {
      warnings.push({
        severity: 'error',
        code: 'jarbschg_zeitraum',
        message: 'Minderjährige: Arbeit nur zwischen 06:00 und 20:00 erlaubt.',
      });
    }
  }

  return warnings;
}

// Summiert Wochenstunden (Mo–So) und warnt.
export function validateWeek(
  shifts: ShiftLike[],
  employee?: EmployeeContext,
  weekStart?: Date,
): ArbZGWarning[] {
  const warnings: ArbZGWarning[] = [];
  const minderjährig = isMinor(employee?.geburtsdatum ?? null, weekStart ?? new Date());

  let totalMin = 0;
  for (const s of shifts) {
    const g = (s.end.getTime() - s.start.getTime()) / 60_000;
    totalMin += g - (s.pauseMinutes ?? 0);
  }
  const totalH = totalMin / 60;
  const maxWeekH = minderjährig ? 40 : 48;
  if (totalH > maxWeekH) {
    warnings.push({
      severity: 'error',
      code: 'arbzg_wochenstunden',
      message: `${totalH.toFixed(1)}h in der Woche geplant — max ${maxWeekH}h erlaubt${minderjährig ? ' (JArbSchG)' : ''}.`,
    });
  }

  const vertraglich = employee?.wochenstunden;
  if (vertraglich && totalH > vertraglich * 1.2) {
    warnings.push({
      severity: 'warn',
      code: 'ueber_vertrag',
      message: `${totalH.toFixed(1)}h geplant, ${vertraglich}h vertraglich — >20% Mehrarbeit.`,
    });
  }

  return warnings;
}

function minGap(a: ShiftLike, b: ShiftLike): { hours: number; direction: 'before' | 'after' } | null {
  // a = neue Schicht, b = andere. "before" = b endet VOR a startet.
  if (b.end <= a.start) {
    const gap = (a.start.getTime() - b.end.getTime()) / 3_600_000;
    return { hours: gap, direction: 'before' };
  }
  if (b.start >= a.end) {
    const gap = (b.start.getTime() - a.end.getTime()) / 3_600_000;
    return { hours: gap, direction: 'after' };
  }
  // Overlap
  return { hours: -1, direction: 'before' };
}

function isMinor(geburtsdatum: string | null, ref: Date): boolean {
  if (!geburtsdatum) return false;
  const b = new Date(geburtsdatum);
  const age = (ref.getTime() - b.getTime()) / (365.25 * 86_400_000);
  return age < 18;
}

export function highestSeverity(warnings: ArbZGWarning[]): Severity | null {
  if (warnings.some(w => w.severity === 'error')) return 'error';
  if (warnings.some(w => w.severity === 'warn')) return 'warn';
  if (warnings.some(w => w.severity === 'info')) return 'info';
  return null;
}
