import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { AnalyticsExportData } from '@/lib/delivery/analytics-export';

const BRAND  = '#2d6b45';
const LIGHT  = '#f5f2ed';
const MUTED  = '#777';
const BORDER = '#e5e0d2';

const s = StyleSheet.create({
  page:    { padding: 36, fontSize: 9, fontFamily: 'Helvetica', color: '#1a1a1a', backgroundColor: '#fff' },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: BRAND },
  title:   { fontSize: 18, fontFamily: 'Helvetica-Bold', color: BRAND, marginBottom: 2 },
  subtitle:{ fontSize: 9, color: MUTED },
  metaRight:{ alignItems: 'flex-end' },
  metaLabel:{ fontSize: 7, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaVal:  { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1a1a1a' },

  section:      { marginBottom: 14 },
  sectionTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: BRAND, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },

  summaryGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryBox:   { width: '22%', backgroundColor: LIGHT, borderRadius: 4, padding: 8 },
  summaryVal:   { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#1a1a1a', marginBottom: 2 },
  summaryLabel: { fontSize: 7, color: MUTED },

  table:       { borderWidth: 1, borderColor: BORDER, borderRadius: 3, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: BRAND, paddingHorizontal: 8, paddingVertical: 5 },
  thCell:      { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#fff', flex: 1 },
  thRight:     { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#fff', flex: 1, textAlign: 'right' },
  tableRow:    { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 4, borderTopWidth: 1, borderTopColor: BORDER },
  rowAlt:      { backgroundColor: LIGHT },
  tdCell:      { fontSize: 8, color: '#1a1a1a', flex: 1 },
  tdRight:     { fontSize: 8, color: '#1a1a1a', flex: 1, textAlign: 'right' },
  tdMuted:     { fontSize: 8, color: MUTED,     flex: 1, textAlign: 'right' },
  tdGreen:     { fontSize: 8, color: '#065f46', flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  tdRed:       { fontSize: 8, color: '#991b1b', flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold' },

  footer:      { position: 'absolute', bottom: 28, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 6 },
  footerBrand: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: BRAND },
  footerText:  { fontSize: 7, color: MUTED },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(v: number | null) {
  if (v == null) return '—';
  return `${v.toFixed(1)} %`;
}
function fmtMin(v: number | null) {
  if (v == null) return '—';
  const m = Math.floor(v);
  const sec = Math.round((v - m) * 60);
  return `${m}:${String(sec).padStart(2, '0')} Min`;
}
function fmtEur(v: number | null) {
  if (v == null) return '—';
  return `€ ${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00Z');
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
}
function fmtDateShort(iso: string) {
  const d = new Date(iso + 'T00:00:00Z');
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ─── Document ─────────────────────────────────────────────────────────────────

export function AnalyticsDocument({ data }: { data: AnalyticsExportData }) {
  const { summary: sm, snapshots } = data;

  return (
    <Document
      title={`Delivery Analytics – ${data.locationName} – ${data.from}`}
      author="Mise"
    >
      {/* ── Page 1: Summary ─────────────────────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Delivery Analytics Report</Text>
            <Text style={s.subtitle}>{data.locationName}</Text>
            <Text style={[s.subtitle, { marginTop: 2 }]}>
              Zeitraum: {fmtDate(data.from)} – {fmtDate(data.to)}
            </Text>
          </View>
          <View style={s.metaRight}>
            <Text style={s.metaLabel}>Erstellt am</Text>
            <Text style={s.metaVal}>
              {new Date(data.generatedAt).toLocaleString('de-DE', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </Text>
            <Text style={[s.metaLabel, { marginTop: 6 }]}>Tage mit Daten</Text>
            <Text style={s.metaVal}>{sm.totalDays}</Text>
          </View>
        </View>

        {/* KPI-Übersicht */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Periode-Zusammenfassung</Text>
          <View style={s.summaryGrid}>
            <View style={s.summaryBox}>
              <Text style={s.summaryVal}>{sm.totalOrders.toLocaleString('de-DE')}</Text>
              <Text style={s.summaryLabel}>Gesamt-Bestellungen</Text>
            </View>
            <View style={s.summaryBox}>
              <Text style={s.summaryVal}>{sm.totalDeliveries.toLocaleString('de-DE')}</Text>
              <Text style={s.summaryLabel}>Abgeschl. Lieferungen</Text>
            </View>
            <View style={s.summaryBox}>
              <Text style={s.summaryVal}>{fmtPct(sm.avgDeliveryRate)}</Text>
              <Text style={s.summaryLabel}>Ø Lieferrate</Text>
            </View>
            <View style={s.summaryBox}>
              <Text style={s.summaryVal}>{fmtMin(sm.avgDeliveryMin)}</Text>
              <Text style={s.summaryLabel}>Ø Lieferzeit</Text>
            </View>
            <View style={s.summaryBox}>
              <Text style={s.summaryVal}>{fmtPct(sm.avgSlaCompliancePct)}</Text>
              <Text style={s.summaryLabel}>Ø SLA-Einhaltung</Text>
            </View>
            <View style={s.summaryBox}>
              <Text style={s.summaryVal}>{fmtPct(sm.avgCancellationRate)}</Text>
              <Text style={s.summaryLabel}>Ø Stornoquote</Text>
            </View>
            <View style={s.summaryBox}>
              <Text style={s.summaryVal}>{fmtEur(sm.totalRevenueEur)}</Text>
              <Text style={s.summaryLabel}>Umsatz Lieferungen</Text>
            </View>
            <View style={s.summaryBox}>
              <Text style={s.summaryVal}>{sm.totalCancelled.toLocaleString('de-DE')}</Text>
              <Text style={s.summaryLabel}>Stornierte Bestellungen</Text>
            </View>
          </View>
        </View>

        {/* Tages-Tabelle (erste 30 Einträge auf Seite 1) */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Tages-Übersicht</Text>
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.thCell, { flex: 0.7 }]}>Datum</Text>
              <Text style={s.thRight}>Liefer.</Text>
              <Text style={s.thRight}>Abgesch.</Text>
              <Text style={s.thRight}>Lieferrate</Text>
              <Text style={s.thRight}>SLA</Text>
              <Text style={s.thRight}>Ø Zeit</Text>
              <Text style={s.thRight}>Umsatz</Text>
              <Text style={[s.thRight, { flex: 0.6 }]}>Fahrer</Text>
            </View>
            {snapshots.map((r, i) => {
              const slaOk = r.slaCompliancePct != null && r.slaCompliancePct >= 90;
              const slaWarn = r.slaCompliancePct != null && r.slaCompliancePct < 75;
              return (
                <View key={r.analyticsDate} style={[s.tableRow, i % 2 === 1 ? s.rowAlt : {}]}>
                  <Text style={[s.tdCell, { flex: 0.7 }]}>{fmtDateShort(r.analyticsDate)}</Text>
                  <Text style={s.tdRight}>{r.deliveryOrders}</Text>
                  <Text style={s.tdRight}>{r.completedDeliveries}</Text>
                  <Text style={s.tdRight}>{fmtPct(r.deliveryRate)}</Text>
                  <Text style={slaOk ? s.tdGreen : slaWarn ? s.tdRed : s.tdRight}>
                    {fmtPct(r.slaCompliancePct)}
                  </Text>
                  <Text style={s.tdRight}>{fmtMin(r.avgDeliveryMin)}</Text>
                  <Text style={s.tdRight}>{fmtEur(r.totalRevenueEur)}</Text>
                  <Text style={[s.tdRight, { flex: 0.6 }]}>{r.activeDrivers}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <View>
            <Text style={s.footerBrand}>Mise</Text>
            <Text style={s.footerText}>{data.locationName}</Text>
          </View>
          <Text style={s.footerText} render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `Seite ${pageNumber} von ${totalPages}`
          } />
        </View>
      </Page>
    </Document>
  );
}
