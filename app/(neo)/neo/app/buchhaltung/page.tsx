import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import { BelegeManager } from './belege';
import { KontoauszugManager } from './kontoauszug';
export const dynamic = 'force-dynamic';
const eur = (n: number) => Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
const expGhost = { display: 'flex', alignItems: 'center', gap: 7, height: 42, padding: '0 15px', border: '1px solid #E2E8F0', borderRadius: 10, background: '#fff', color: '#334155', fontSize: 13.5, fontWeight: 700, textDecoration: 'none', cursor: 'pointer' } as const;
export default async function Buchhaltung() {
  const emp = await getCurrentEmployee();
  const sb = createServiceClient();
  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const sinceDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const [{ data: items }, { data: orders }, { data: belege }] = await Promise.all([
    sb.from('order_items').select('gesamtpreis, mwst_satz, order:customer_orders!inner(tenant_id, status, created_at)').eq('order.tenant_id', emp?.tenant_id ?? '').gte('order.created_at', since).neq('order.status', 'storniert').limit(5000),
    sb.from('customer_orders').select('bestellnummer, created_at, gesamtbetrag, zahlungsart, status, bezahlt').eq('tenant_id', emp?.tenant_id ?? '').gte('created_at', since).order('created_at', { ascending: false }).limit(20),
    sb.from('belege').select('id, datum, haendler, rechnungsnummer, zahlungsart, betrag_brutto, mwst_satz, mwst_betrag, netto, kategorie, status, beleg_url').eq('tenant_id', emp?.tenant_id ?? '').or(`datum.gte.${sinceDate},datum.is.null`).order('datum', { ascending: false, nullsFirst: false }).limit(500),
  ]);
  const [{ data: banktx }, { data: belegLinks }] = await Promise.all([
    sb.from('bank_transactions').select('id, buchungstag, betrag, richtung, verwendungszweck, gegenpartei, beleg_id, matched_auto').eq('tenant_id', emp?.tenant_id ?? '').order('buchungstag', { ascending: false }).limit(300),
    sb.from('bank_transactions').select('beleg_id').eq('tenant_id', emp?.tenant_id ?? '').not('beleg_id', 'is', null),
  ]);
  const linkedBelege = new Set((belegLinks ?? []).map((r: any) => r.beleg_id));
  const unmatchedBelege = (belege ?? []).filter((b: any) => !linkedBelege.has(b.id)).length;
  const monatParam = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const expBase = `/api/buchhaltung/export?monat=${monatParam}`;
  let b7 = 0, b19 = 0;
  for (const it of (items ?? []) as any[]) { let m = Number(it.mwst_satz ?? 19); if (m < 1) m = m * 100; const v = Number(it.gesamtpreis ?? 0); if (m >= 19) b19 += v; else b7 += v; }
  const tax7 = b7 - b7 / 1.07, tax19 = b19 - b19 / 1.19, brutto = b7 + b19, netto = brutto - tax7 - tax19;
  const monat = now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const SUM = [['Umsatz brutto', eur(brutto), '#0F172A', 700], ['Speisen (7%)', eur(b7), '#334155', 600], ['Getränke/vor Ort (19%)', eur(b19), '#334155', 600], ['enthaltene USt 7%', eur(tax7), '#B45309', 600], ['enthaltene USt 19%', eur(tax19), '#1D4ED8', 600]];

  // ── #6 KI-Buchhaltungs-Prüfungen (regelbasiert) + GuV ──
  const bl = (belege ?? []) as any[];
  const tx = (banktx ?? []) as any[];
  const ausgabenBrutto = bl.reduce((s, b) => s + Number(b.betrag_brutto || 0), 0);
  const vorsteuer = bl.reduce((s, b) => s + Number(b.mwst_betrag || 0), 0);
  const umsatzUSt = tax7 + tax19;
  const ustZahllast = umsatzUSt - vorsteuer;
  const gewinn = netto - (ausgabenBrutto - vorsteuer);
  const warnings: { level: 'rot' | 'gelb'; text: string }[] = [];
  // Fehlende Belege: Konto-Ausgabe ohne zugeordneten Beleg
  // nur Ausgaben des aktuellen Monats ohne Beleg (konsistent mit der Monats-GuV)
  const fehlBel = tx.filter((t) => t.richtung === 'ausgabe' && !t.beleg_id && (!t.buchungstag || t.buchungstag >= sinceDate));
  if (fehlBel.length) warnings.push({ level: 'rot', text: `${fehlBel.length} Konto-Ausgabe(n) ohne Beleg (${eur(fehlBel.reduce((s, t) => s + Number(t.betrag || 0), 0))}) — Beleg scannen oder zuordnen.` });
  // Doppelte Buchung: gleicher Händler + Betrag + Datum
  const seen = new Map<string, number>();
  for (const b of bl) { const k = `${(b.haendler || '').toLowerCase()}|${b.betrag_brutto}|${b.datum}`; seen.set(k, (seen.get(k) || 0) + 1); }
  const dups = [...seen.values()].filter((n) => n > 1).length;
  if (dups) warnings.push({ level: 'rot', text: `${dups} mögliche Doppelbuchung(en) — gleicher Händler, Betrag & Datum doppelt erfasst.` });
  // Ungewöhnliche Ausgabe: > 3× Median
  if (bl.length >= 4) { const sorted = bl.map((b) => Number(b.betrag_brutto || 0)).sort((a, b) => a - b); const med = sorted[Math.floor(sorted.length / 2)] || 0; const out = bl.filter((b) => med > 0 && Number(b.betrag_brutto) > med * 3); if (out.length) warnings.push({ level: 'gelb', text: `${out.length} ungewöhnlich hohe Ausgabe(n) (über ${eur(med * 3)}) — kurz prüfen.` }); }
  // Falscher Steuersatz (Heuristik): Getränke mit 7% / Wareneinsatz (Speise) mit 19%
  const taxFlags = bl.filter((b) => (b.kategorie === 'Getränke' && Number(b.mwst_satz) === 7) || (b.kategorie === 'Wareneinsatz' && Number(b.mwst_satz) === 19)).length;
  if (taxFlags) warnings.push({ level: 'gelb', text: `${taxFlags} Beleg(e) mit evtl. falschem Steuersatz (Getränke=19%, Lebensmittel meist 7%).` });
  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <span style={{ fontSize: 13, color: '#94A3B8' }}>Jede Bestellung trägt eine eindeutige Bestellnummer.</span>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
          <a href={`${expBase}&format=zip`} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px', borderRadius: 10, background: '#4F46E5', color: '#fff', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>📦 Steuerberater-Paket (ZIP)</a>
          <a href={`${expBase}&format=belege-csv`} style={expGhost}>Belege (CSV)</a>
          <a href={`${expBase}&format=bank-csv`} style={expGhost}>Bank (CSV)</a>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22 }}>
          <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Zusammenfassung · {monat}</h3>
          {SUM.map(([l, v, c, w]: any) => (<div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #F8FAFC' }}><span style={{ fontSize: 13.5, color: '#475569', fontWeight: w }}>{l}</span><span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 14, fontWeight: 700, color: c }}>{v}</span></div>))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 14, marginTop: 6 }}><span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Netto-Umsatz</span><span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: '#047857' }}>{eur(netto)}</span></div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #F1F5F9' }}><h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Transaktionen</h3></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.9fr 0.9fr 1fr 1fr', padding: '11px 22px', background: '#F8FAFC', fontSize: 12, fontWeight: 700, color: '#94A3B8', letterSpacing: '.3px' }}><span>BESTELL-NR.</span><span>DATUM</span><span>BRUTTO</span><span>ZAHLART</span><span>STATUS</span></div>
          {((orders ?? []) as any[]).length === 0 && <div style={{ padding: '24px 22px', color: '#94A3B8', fontSize: 13 }}>Keine Transaktionen diesen Monat.</div>}
          {((orders ?? []) as any[]).map((t, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 0.9fr 0.9fr 1fr 1fr', alignItems: 'center', padding: '14px 22px', borderTop: '1px solid #F1F5F9' }}>
              <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 13, color: '#0F172A' }}>#{String(t.bestellnummer || '').slice(-6) || '------'}</span>
              <span style={{ fontSize: 13, color: '#64748B' }}>{new Date(t.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>
              <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 600, fontSize: 13.5, color: '#334155' }}>{eur(t.gesamtbetrag)}</span>
              <span style={{ fontSize: 13, color: '#475569', textTransform: 'capitalize' }}>{t.zahlungsart || '—'}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: t.bezahlt ? '#047857' : '#B45309', background: t.bezahlt ? '#ECFDF5' : '#FEF3C7', padding: '4px 9px', borderRadius: 999, justifySelf: 'start' }}>{t.bezahlt ? 'Bezahlt' : 'Offen'}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22 }}>
          <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>Gewinn & Steuer · {monat}</h3>
          {[['Netto-Umsatz', eur(netto), '#0F172A', 600], ['− Netto-Ausgaben', '−' + eur(ausgabenBrutto - vorsteuer), '#DC2626', 600], ['Umsatzsteuer', eur(umsatzUSt), '#334155', 600], ['− Vorsteuer (Belege)', '−' + eur(vorsteuer), '#334155', 600]].map(([l, v, c, w]: any) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F8FAFC' }}><span style={{ fontSize: 13.5, color: '#475569', fontWeight: w }}>{l}</span><span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 14, fontWeight: 700, color: c }}>{v}</span></div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 14, marginTop: 4 }}><span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Gewinn (vereinf.)</span><span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: gewinn >= 0 ? '#047857' : '#DC2626' }}>{eur(gewinn)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>USt-Zahllast ans Finanzamt</span><span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 14, fontWeight: 700, color: '#B45309' }}>{eur(ustZahllast)}</span></div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22 }}>
          <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>KI-Prüfung <span style={{ color: '#94A3B8', fontWeight: 500 }}>· Belege & Umsätze</span></h3>
          {warnings.length === 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#047857', fontSize: 13.5, fontWeight: 600, padding: '8px 0' }}><span style={{ fontSize: 18 }}>✅</span>Keine Auffälligkeiten gefunden.</div>}
          {warnings.map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, background: w.level === 'rot' ? '#FEF2F2' : '#FFFBEB', border: `1px solid ${w.level === 'rot' ? '#FECACA' : '#FDE68A'}`, marginBottom: 8 }}>
              <span style={{ fontSize: 15, flexShrink: 0 }}>{w.level === 'rot' ? '🔴' : '🟡'}</span>
              <span style={{ fontSize: 13, color: w.level === 'rot' ? '#991B1B' : '#92400E', fontWeight: 600, lineHeight: 1.4 }}>{w.text}</span>
            </div>
          ))}
        </div>
      </div>
      <BelegeManager belege={(belege ?? []) as any[]} monat={monat} />
      <KontoauszugManager transactions={(banktx ?? []) as any[]} unmatchedBelege={unmatchedBelege} />
    </div>
  );
}
