import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export type TableQrPdfCard = {
  id: string; nummer: string; name: string | null; bereich: string | null; qrDataUrl: string;
};

const styles = StyleSheet.create({
  page: { padding: 28, color: '#111827', fontFamily: 'Helvetica' },
  header: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: '#4f46e5' },
  title: { fontSize: 18, fontWeight: 700 },
  subtitle: { marginTop: 4, color: '#64748b', fontSize: 9 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', minHeight: 335, padding: 18, borderWidth: 1.5, borderColor: '#4f46e5', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sticker: { width: '31%', minHeight: 220, padding: 10 },
  stand: { minHeight: 345 },
  brand: { color: '#4f46e5', fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' },
  name: { marginTop: 4, fontSize: 13, fontWeight: 700 },
  qr: { width: 180, height: 180, marginVertical: 10 },
  qrSticker: { width: 120, height: 120, marginVertical: 7 },
  tableLabel: { color: '#64748b', fontSize: 7, letterSpacing: 2, textTransform: 'uppercase' },
  tableNumber: { marginTop: 2, color: '#312e81', fontSize: 27, fontWeight: 700 },
  area: { marginTop: 3, color: '#64748b', fontSize: 8 },
  hint: { marginTop: 8, color: '#334155', fontSize: 8 },
});

export function TableQrPdfDocument({ brand, cards, design }: { brand: string; cards: TableQrPdfCard[]; design: 'karte' | 'sticker' | 'aufsteller' }) {
  return <Document title={`${brand} Tisch QR-Codes`} author="Mise Gastro Neo">
    <Page size="A4" style={styles.page}>
      <View style={styles.header}><Text style={styles.title}>{brand} · Tischbestellung</Text><Text style={styles.subtitle}>{cards.length} sichere QR-Codes · Vorlage: {design}</Text></View>
      <View style={styles.grid}>{cards.map((card) => <View key={card.id} wrap={false} style={[styles.card, design === 'sticker' ? styles.sticker : {}, design === 'aufsteller' ? styles.stand : {}]}>
        <Text style={styles.brand}>{brand}</Text>{card.name ? <Text style={styles.name}>{card.name}</Text> : null}
        {/* react-pdf's Image has no HTML alt prop. */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={card.qrDataUrl} style={design === 'sticker' ? styles.qrSticker : styles.qr} />
        <Text style={styles.tableLabel}>Tisch</Text><Text style={styles.tableNumber}>{card.nummer}</Text>
        {card.bereich ? <Text style={styles.area}>{card.bereich}</Text> : null}<Text style={styles.hint}>Scannen · bestellen · bezahlen</Text>
      </View>)}</View>
    </Page>
  </Document>;
}
