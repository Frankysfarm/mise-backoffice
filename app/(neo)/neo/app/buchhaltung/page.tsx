import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import { Soon } from '../_soon';
import { BelegeManager } from './belege';
export const dynamic = 'force-dynamic';
const eur = (n: number) => Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
const EXP = [{ name: 'PDF', bg: '#FEF2F2', color: '#DC2626' }, { name: 'XLS', bg: '#ECFDF5', color: '#047857' }, { name: 'CSV', bg: '#F1F5F9', color: '#475569' }, { name: 'DTV', bg: '#EEF2FF', color: '#4F46E5' }, { name: 'LEX', bg: '#FEF3C7', color: '#B45309' }];
export default async function Buchhaltung() {
  const emp = await getCurrentEmployee();
  const sb = createServiceClient();
  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const sinceDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const [{ data: items }, { data: orders }, { data: belege }] = await Promise.all([
    sb.from('order_items').select('gesamtpreis, mwst_satz, order:customer_orders!inner(tenant_id, status, created_at)').eq('order.tenant_id', emp?.tenant_id ?? '').gte('order.created_at', since).neq('order.status', 'storniert').limit(5000),
    sb.from('customer_orders').select('bestellnummer, created_at, gesamtbetrag, zahlungsart, status, bezahlt').eq('tenant_id', emp?.tenant_id ?? '').gte('created_at', since).order('created_at', { ascending: false }).limit(20),
    sb.from('belege').select('id, datum, haendler, betrag_brutto, mwst_satz, mwst_betrag, netto, kategorie, status, beleg_url').eq('tenant_id', emp?.tenant_id ?? '').gte('datum', sinceDate).order('datum', { ascending: false }).limit(500),
  ]);
  let b7 = 0, b19 = 0;
  for (const it of (items ?? []) as any[]) { let m = Number(it.mwst_satz ?? 19); if (m < 1) m = m * 100; const v = Number(it.gesamtpreis ?? 0); if (m >= 19) b19 += v; else b7 += v; }
  const tax7 = b7 - b7 / 1.07, tax19 = b19 - b19 / 1.19, brutto = b7 + b19, netto = brutto - tax7 - tax19;
  const monat = now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const SUM = [['Umsatz brutto', eur(brutto), '#0F172A', 700], ['Speisen (7%)', eur(b7), '#334155', 600], ['Getränke/vor Ort (19%)', eur(b19), '#334155', 600], ['enthaltene USt 7%', eur(tax7), '#B45309', 600], ['enthaltene USt 19%', eur(tax19), '#1D4ED8', 600]];
  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <span style={{ fontSize: 13, color: '#94A3B8' }}>Jede Bestellung trägt eine eindeutige Bestellnummer.</span>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>{EXP.map((e) => (<Soon key={e.name} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 14px', border: '1px solid #E2E8F0', borderRadius: 10, background: '#fff', cursor: 'pointer' }}><span style={{ width: 24, height: 24, borderRadius: 6, background: e.bg, color: e.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>{e.name}</span><span style={{ fontSize: 13.5, fontWeight: 700, color: '#334155' }}>Export</span></Soon>))}</div>
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
      <BelegeManager belege={(belege ?? []) as any[]} monat={monat} />
    </div>
  );
}
