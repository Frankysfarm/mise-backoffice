import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

export type HaccpData = {
  locationName: string;
  month: string; // "YYYY-MM"
  equipment: {
    id: string;
    name: string;
    kategorie: string | null;
    logs: { date: string; messung: string; ok: boolean; by: string | null }[];
  }[];
  cleaning: {
    date: string;
    zone: string;
    task: string;
    by: string;
    time: string;
  }[];
  checkups: {
    date: string;
    template: string;
    tasksTotal: number;
    tasksDone: number;
    by: string;
    photoCount: number;
  }[];
};

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 9, color: '#1a3a2a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: '#2d6b45', marginBottom: 12 },
  h1: { fontSize: 18, fontWeight: 700 },
  subtitle: { fontSize: 9, color: '#555', marginTop: 2 },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#1a3a2a', marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#d4a843' },
  row: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  cellHead: { fontSize: 8, fontWeight: 700, color: '#666', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#ccc' },
  muted: { color: '#888', fontStyle: 'italic' },
  equipName: { fontWeight: 700, marginTop: 8 },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, fontSize: 7, color: '#999', textAlign: 'center', paddingTop: 6, borderTopWidth: 0.5, borderTopColor: '#ddd' },
});

export function HaccpPdfDocument({ locationName, month, equipment, cleaning, checkups }: HaccpData) {
  const [year, monthNum] = month.split('-');
  const monthName = new Date(Number(year), Number(monthNum) - 1, 1)
    .toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>HACCP-Dokumentation</Text>
            <Text style={styles.subtitle}>{locationName} · {monthName}</Text>
          </View>
          <View>
            <Text style={styles.subtitle}>Erstellt: {new Date().toLocaleString('de-DE')}</Text>
            <Text style={styles.subtitle}>Nach EU-Verordnung 852/2004</Text>
          </View>
        </View>

        {/* EQUIPMENT-LOGS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Temperatur-Kontrollen & Gerätewartung</Text>
          {equipment.length === 0 ? (
            <Text style={styles.muted}>Keine Einträge im Zeitraum.</Text>
          ) : equipment.map(eq => (
            <View key={eq.id}>
              <Text style={styles.equipName}>{eq.name} {eq.kategorie ? `(${eq.kategorie})` : ''}</Text>
              {eq.logs.length === 0 ? (
                <Text style={styles.muted}>  Keine Einträge</Text>
              ) : (
                <>
                  <View style={styles.row}>
                    <Text style={[styles.cellHead, { width: 70 }]}>Datum</Text>
                    <Text style={[styles.cellHead, { width: 140 }]}>Messung / Befund</Text>
                    <Text style={[styles.cellHead, { width: 40 }]}>OK</Text>
                    <Text style={[styles.cellHead, { flex: 1 }]}>Erfasst von</Text>
                  </View>
                  {eq.logs.map((l, i) => (
                    <View key={i} style={styles.row}>
                      <Text style={{ width: 70 }}>{new Date(l.date).toLocaleDateString('de-DE')}</Text>
                      <Text style={{ width: 140 }}>{l.messung}</Text>
                      <Text style={{ width: 40, color: l.ok ? '#2d6b45' : '#e84040', fontWeight: 700 }}>{l.ok ? '✓' : '✗'}</Text>
                      <Text style={{ flex: 1 }}>{l.by ?? '—'}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          ))}
        </View>

        {/* CLEANING */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Reinigungsnachweise</Text>
          {cleaning.length === 0 ? (
            <Text style={styles.muted}>Keine Einträge im Zeitraum.</Text>
          ) : (
            <>
              <View style={styles.row}>
                <Text style={[styles.cellHead, { width: 70 }]}>Datum</Text>
                <Text style={[styles.cellHead, { width: 50 }]}>Uhrzeit</Text>
                <Text style={[styles.cellHead, { width: 90 }]}>Zone</Text>
                <Text style={[styles.cellHead, { flex: 1 }]}>Aufgabe</Text>
                <Text style={[styles.cellHead, { width: 100 }]}>Erledigt von</Text>
              </View>
              {cleaning.map((c, i) => (
                <View key={i} style={styles.row}>
                  <Text style={{ width: 70 }}>{new Date(c.date).toLocaleDateString('de-DE')}</Text>
                  <Text style={{ width: 50 }}>{c.time}</Text>
                  <Text style={{ width: 90 }}>{c.zone}</Text>
                  <Text style={{ flex: 1 }}>{c.task}</Text>
                  <Text style={{ width: 100 }}>{c.by}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* CHECKUPS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Tages-Check-ups (Eigenkontrolle)</Text>
          {checkups.length === 0 ? (
            <Text style={styles.muted}>Keine Einträge im Zeitraum.</Text>
          ) : (
            <>
              <View style={styles.row}>
                <Text style={[styles.cellHead, { width: 70 }]}>Datum</Text>
                <Text style={[styles.cellHead, { flex: 1 }]}>Check-up</Text>
                <Text style={[styles.cellHead, { width: 60 }]}>Aufgaben</Text>
                <Text style={[styles.cellHead, { width: 60 }]}>Fotos</Text>
                <Text style={[styles.cellHead, { width: 100 }]}>Durch</Text>
              </View>
              {checkups.map((c, i) => (
                <View key={i} style={styles.row}>
                  <Text style={{ width: 70 }}>{new Date(c.date).toLocaleDateString('de-DE')}</Text>
                  <Text style={{ flex: 1 }}>{c.template}</Text>
                  <Text style={{ width: 60, color: c.tasksDone === c.tasksTotal ? '#2d6b45' : '#d4a843', fontWeight: 700 }}>
                    {c.tasksDone}/{c.tasksTotal}
                  </Text>
                  <Text style={{ width: 60 }}>{c.photoCount}</Text>
                  <Text style={{ width: 100 }}>{c.by}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        <Text style={styles.footer}>
          HACCP-Bericht · {locationName} · {monthName} · Generiert durch FoodFlow Operations
        </Text>
      </Page>
    </Document>
  );
}
