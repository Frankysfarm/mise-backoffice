import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

export interface LohnzettelData {
  driverName: string;
  driverId: string;
  locationName: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  deliveriesCount: number;
  totalKm: number;
  totalBase: number;
  totalKmBonus: number;
  totalPeakBonus: number;
  totalRatingBonus: number;
  totalMilestoneBonus: number;
  totalPayout: number;
  avgRating: number | null;
  onTimeRatePct: number | null;
  status: 'draft' | 'approved' | 'paid';
  approvedAt: string | null;
  paidAt: string | null;
  generatedAt: string;
}

const BRAND = '#2d6b45';
const LIGHT = '#f5f2ed';
const MUTED = '#777';
const BORDER = '#e5e0d2';

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', color: '#1a3a2a', backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 2, borderBottomColor: BRAND },
  headerLeft: { flex: 1 },
  title: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: BRAND, marginBottom: 2 },
  subtitle: { fontSize: 10, color: MUTED },
  headerRight: { alignItems: 'flex-end' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, marginBottom: 4 },
  badgeDraft: { backgroundColor: '#f3f4f6' },
  badgeApproved: { backgroundColor: '#dbeafe' },
  badgePaid: { backgroundColor: '#d1fae5' },
  badgeText: { fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.8 },
  badgeTextDraft: { color: '#6b7280' },
  badgeTextApproved: { color: '#1d4ed8' },
  badgeTextPaid: { color: '#065f46' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: BRAND, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  infoGrid: { flexDirection: 'row', gap: 24 },
  infoBlock: { flex: 1, backgroundColor: LIGHT, borderRadius: 4, padding: 10 },
  infoLabel: { fontSize: 7, color: MUTED, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1a3a2a' },
  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 4, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: BRAND, paddingHorizontal: 10, paddingVertical: 6 },
  tableHeaderCell: { flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#fff' },
  tableHeaderCellRight: { flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#fff', textAlign: 'right' },
  tableRow: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: BORDER },
  tableRowAlt: { backgroundColor: LIGHT },
  tableCell: { flex: 1, fontSize: 9, color: '#1a3a2a' },
  tableCellRight: { flex: 1, fontSize: 9, color: '#1a3a2a', textAlign: 'right' },
  tableCellMuted: { flex: 1, fontSize: 9, color: MUTED },
  tableCellRightMuted: { flex: 1, fontSize: 9, color: MUTED, textAlign: 'right' },
  tableCellAccent: { flex: 1, fontSize: 9, color: BRAND },
  totalRow: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 9, backgroundColor: '#ecf5f0', borderTopWidth: 2, borderTopColor: BRAND },
  totalLabel: { flex: 1, fontSize: 11, fontFamily: 'Helvetica-Bold', color: BRAND },
  totalValue: { flex: 1, fontSize: 14, fontFamily: 'Helvetica-Bold', color: BRAND, textAlign: 'right' },
  statsGrid: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, backgroundColor: LIGHT, borderRadius: 4, padding: 8, alignItems: 'center' },
  statValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: BRAND, marginBottom: 2 },
  statLabel: { fontSize: 7, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  footer: { marginTop: 'auto', paddingTop: 16, borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  footerText: { fontSize: 7, color: MUTED },
  footerBrand: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: BRAND },
  separator: { height: 1, backgroundColor: BORDER, marginVertical: 16 },
  noteBox: { borderWidth: 1, borderColor: '#fbbf24', backgroundColor: '#fffbeb', borderRadius: 4, padding: 8, marginBottom: 12 },
  noteText: { fontSize: 8, color: '#92400e' },
});

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtEur(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

const PERIOD_LABELS: Record<string, string> = {
  daily: 'Tagesabrechnung',
  weekly: 'Wochenabrechnung',
  monthly: 'Monatsabrechnung',
  custom: 'Abrechnung',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  approved: 'Freigegeben',
  paid: 'Ausgezahlt',
};

export function LohnzettelDocument({ data }: { data: LohnzettelData }) {
  const periodLabel = PERIOD_LABELS[data.periodType] ?? 'Abrechnung';
  const statusLabel = STATUS_LABELS[data.status] ?? data.status;

  const breakdown = [
    { label: 'Basis-Vergütung', sublabel: `${data.deliveriesCount} Lieferungen`, value: data.totalBase, accent: false },
    { label: 'km-Bonus', sublabel: `${data.totalKm.toFixed(1)} km gesamt`, value: data.totalKmBonus, accent: false },
    { label: 'Spitzenstunden-Bonus', sublabel: 'Peak-Zeiten-Zuschlag', value: data.totalPeakBonus, accent: false },
    { label: 'Rating-Bonus', sublabel: data.avgRating != null ? `Ø ${data.avgRating.toFixed(1)} Sterne` : '—', value: data.totalRatingBonus, accent: false },
    { label: 'Meilenstein-Bonus', sublabel: 'Liefermengen-Boni', value: data.totalMilestoneBonus, accent: false },
  ];

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.title}>{periodLabel}</Text>
            <Text style={s.subtitle}>{data.locationName}</Text>
            <Text style={[s.subtitle, { marginTop: 2 }]}>
              {fmtDate(data.periodStart)} – {fmtDate(data.periodEnd)}
            </Text>
          </View>
          <View style={s.headerRight}>
            <View style={[s.badge, data.status === 'paid' ? s.badgePaid : data.status === 'approved' ? s.badgeApproved : s.badgeDraft]}>
              <Text style={[s.badgeText, data.status === 'paid' ? s.badgeTextPaid : data.status === 'approved' ? s.badgeTextApproved : s.badgeTextDraft]}>
                {statusLabel}
              </Text>
            </View>
            {data.approvedAt && (
              <Text style={[s.subtitle, { fontSize: 7 }]}>Freigegeben: {fmtDate(data.approvedAt)}</Text>
            )}
            {data.paidAt && (
              <Text style={[s.subtitle, { fontSize: 7 }]}>Ausgezahlt: {fmtDate(data.paidAt)}</Text>
            )}
          </View>
        </View>

        {data.status === 'draft' && (
          <View style={s.noteBox}>
            <Text style={s.noteText}>
              Hinweis: Dieser Lohnzettel ist noch ein Entwurf und wurde noch nicht durch einen Vorgesetzten freigegeben.
            </Text>
          </View>
        )}

        {/* Fahrer-Info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Fahrer</Text>
          <View style={s.infoGrid}>
            <View style={s.infoBlock}>
              <Text style={s.infoLabel}>Name</Text>
              <Text style={s.infoValue}>{data.driverName}</Text>
            </View>
            <View style={s.infoBlock}>
              <Text style={s.infoLabel}>Abrechnungszeitraum</Text>
              <Text style={s.infoValue}>{fmtDate(data.periodStart)} – {fmtDate(data.periodEnd)}</Text>
            </View>
          </View>
        </View>

        {/* Leistungs-KPIs */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Leistungsübersicht</Text>
          <View style={s.statsGrid}>
            <View style={s.statBox}>
              <Text style={s.statValue}>{data.deliveriesCount}</Text>
              <Text style={s.statLabel}>Lieferungen</Text>
            </View>
            <View style={s.statBox}>
              <Text style={s.statValue}>{data.totalKm.toFixed(1)} km</Text>
              <Text style={s.statLabel}>Gefahrene Strecke</Text>
            </View>
            {data.avgRating != null && (
              <View style={s.statBox}>
                <Text style={s.statValue}>{data.avgRating.toFixed(1)} ★</Text>
                <Text style={s.statLabel}>Ø Bewertung</Text>
              </View>
            )}
            {data.onTimeRatePct != null && (
              <View style={s.statBox}>
                <Text style={s.statValue}>{data.onTimeRatePct.toFixed(0)}%</Text>
                <Text style={s.statLabel}>Pünktlichkeit</Text>
              </View>
            )}
          </View>
        </View>

        {/* Vergütungsaufschlüsselung */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Vergütungsaufschlüsselung</Text>
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={s.tableHeaderCell}>Position</Text>
              <Text style={s.tableHeaderCell}>Details</Text>
              <Text style={s.tableHeaderCellRight}>Betrag</Text>
            </View>
            {breakdown.map((row, i) => (
              <View key={row.label} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
                <Text style={s.tableCell}>{row.label}</Text>
                <Text style={s.tableCellMuted}>{row.sublabel}</Text>
                <Text style={row.value > 0 ? s.tableCellAccent : s.tableCellRightMuted}>
                  {row.value > 0 ? fmtEur(row.value) : '—'}
                </Text>
              </View>
            ))}
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Gesamt-Vergütung</Text>
              <Text style={{...s.totalLabel, textAlign: 'right'}}>{/* spacer */}</Text>
              <Text style={s.totalValue}>{fmtEur(data.totalPayout)}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <View>
            <Text style={s.footerBrand}>Mise</Text>
            <Text style={s.footerText}>{data.locationName}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.footerText}>Erstellt am {fmtDate(data.generatedAt)}</Text>
            <Text style={[s.footerText, { marginTop: 2 }]}>
              Fahrer-ID: {data.driverId.slice(0, 8).toUpperCase()}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
