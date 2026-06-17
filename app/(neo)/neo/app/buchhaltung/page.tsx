import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
const eur = (n: number) => Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
export default async function Buchhaltung() {
  const emp = await getCurrentEmployee();
  const supabase = createServiceClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: items } = await supabase.from('order_items').select('gesamtpreis, mwst_satz, order:customer_orders!inner(tenant_id, status, created_at)').eq('order.tenant_id', emp?.tenant_id ?? '').gte('order.created_at', since).neq('order.status', 'storniert').limit(2000);
  let b7 = 0, b19 = 0;
  for (const it of (items ?? []) as any[]) { const m = Number(it.mwst_satz ?? 7); const v = Number(it.gesamtpreis ?? 0); if (m >= 19) b19 += v; else b7 += v; }
  const tax7 = b7 - b7 / 1.07, tax19 = b19 - b19 / 1.19;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22, boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}><div style={{ fontSize: 13, fontWeight: 700, color: '#047857', background: '#ECFDF5', borderRadius: 6, padding: '2px 8px', display: 'inline-block' }}>7 % USt (Speisen)</div><div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 26, fontWeight: 700, marginTop: 12 }}>{eur(b7)}</div><div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>davon USt: {eur(tax7)}</div></div>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22, boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}><div style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8', background: '#EFF6FF', borderRadius: 6, padding: '2px 8px', display: 'inline-block' }}>19 % USt (Getränke/vor Ort)</div><div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 26, fontWeight: 700, marginTop: 12 }}>{eur(b19)}</div><div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>davon USt: {eur(tax19)}</div></div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22, boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}>
        <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Export (letzte 30 Tage)</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{['PDF', 'Excel', 'CSV', 'DATEV', 'Lexoffice'].map((x) => (<button key={x} style={{ height: 38, padding: '0 16px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 600, color: '#334155' }}>{x} exportieren</button>))}</div>
      </div>
    </div>
  );
}
