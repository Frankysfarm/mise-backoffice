import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

export type PdfShift = {
  id: string;
  start_zeit: string;
  end_zeit: string;
  pause_minuten: number | null;
  position: string | null;
  employee: { vorname?: string; nachname?: string } | null;
  department: { name?: string; farbe?: string } | null;
};

export type SchedulePdfProps = {
  locationName: string;
  weekStart: Date;
  shifts: PdfShift[];
};

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, color: '#1a3a2a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#2d6b45' },
  title: { fontSize: 18, fontWeight: 700 },
  subtitle: { fontSize: 10, color: '#555' },
  grid: { flexDirection: 'row', borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#e5e0d2' },
  cell: { flex: 1, minHeight: 520, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#e5e0d2', padding: 6 },
  dayHeader: { fontSize: 11, fontWeight: 700, marginBottom: 4 },
  dayDate: { fontSize: 8, color: '#888', marginBottom: 6 },
  shift: { borderLeftWidth: 3, borderLeftColor: '#2d6b45', backgroundColor: '#f5f2ed', padding: 4, marginBottom: 4, borderRadius: 2 },
  shiftUnassigned: { borderLeftColor: '#e84040', backgroundColor: '#fdeaea' },
  shiftTime: { fontSize: 8, color: '#666' },
  shiftName: { fontSize: 10, fontWeight: 600, marginTop: 1 },
  shiftMeta: { fontSize: 7, color: '#777' },
  summary: { marginTop: 16, fontSize: 9 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
});

function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }
function fmtTime(d: Date) { return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }
function fmtDate(d: Date) { return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); }

export function SchedulePdfDocument({ locationName, weekStart, shifts }: SchedulePdfProps) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  });

  // Mitarbeiter-Summen berechnen
  const byEmployee = new Map<string, { name: string; minutes: number }>();
  for (const s of shifts) {
    if (!s.employee) continue;
    const name = `${s.employee.vorname ?? ''} ${s.employee.nachname ?? ''}`.trim();
    const start = new Date(s.start_zeit);
    const end = new Date(s.end_zeit);
    const minutes = (end.getTime() - start.getTime()) / 60_000 - (s.pause_minuten ?? 0);
    const cur = byEmployee.get(name) ?? { name, minutes: 0 };
    cur.minutes += minutes;
    byEmployee.set(name, cur);
  }
  const summary = [...byEmployee.values()].sort((a, b) => a.name.localeCompare(b.name));

  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Dienstplan — {locationName}</Text>
            <Text style={styles.subtitle}>
              KW {getWeekNumber(weekStart)} · {fmtDate(weekStart)}–{fmtDate(weekEnd)}
            </Text>
          </View>
          <View>
            <Text style={styles.subtitle}>Erstellt: {new Date().toLocaleString('de-DE')}</Text>
            <Text style={styles.subtitle}>{shifts.length} Schichten</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {days.map((d, i) => {
            const dayShifts = shifts
              .filter(s => sameDay(new Date(s.start_zeit), d))
              .sort((a, b) => a.start_zeit.localeCompare(b.start_zeit));
            return (
              <View key={i} style={styles.cell}>
                <Text style={styles.dayHeader}>{WEEKDAYS[i]}</Text>
                <Text style={styles.dayDate}>{fmtDate(d)}</Text>
                {dayShifts.map(s => {
                  const unassigned = !s.employee;
                  const start = new Date(s.start_zeit);
                  const end = new Date(s.end_zeit);
                  return (
                    <View key={s.id}
                      style={[
                        styles.shift,
                        unassigned ? styles.shiftUnassigned : { borderLeftColor: s.department?.farbe ?? '#2d6b45' },
                      ]}>
                      <Text style={styles.shiftTime}>{fmtTime(start)}–{fmtTime(end)}</Text>
                      <Text style={styles.shiftName}>
                        {unassigned ? '⚠ Unbesetzt' : `${s.employee?.vorname ?? ''} ${s.employee?.nachname ?? ''}`}
                      </Text>
                      {s.position && <Text style={styles.shiftMeta}>{s.position}</Text>}
                      {s.department?.name && <Text style={styles.shiftMeta}>{s.department.name}</Text>}
                    </View>
                  );
                })}
                {dayShifts.length === 0 && <Text style={styles.shiftMeta}>—</Text>}
              </View>
            );
          })}
        </View>

        {summary.length > 0 && (
          <View style={styles.summary}>
            <Text style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Wochenstunden</Text>
            {summary.map(s => (
              <View key={s.name} style={styles.summaryRow}>
                <Text>{s.name}</Text>
                <Text>{(s.minutes / 60).toFixed(1)} h</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}

function getWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}
