import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import { Soon } from '../_soon';
export const dynamic = 'force-dynamic';
const eur = (n: number) => Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
const CAMP = [{ name: 'E-Mail-Kampagne', desc: 'Newsletter & Angebote', bg: '#EEF2FF', ic: '#4F46E5' }, { name: 'WhatsApp', desc: 'Direkt aufs Handy', bg: '#ECFDF5', ic: '#047857' }, { name: 'SMS', desc: 'Kurz & zuverlässig', bg: '#FEF3C7', ic: '#B45309' }];
export default async function Kunden() {
  const emp = await getCurrentEmployee();
  const sb = createServiceClient();
  const { data } = await sb.from('customer_orders').select('kunde_name, kunde_telefon, kunde_email, gesamtbetrag, created_at').eq('tenant_id', emp?.tenant_id ?? '').neq('status', 'storniert').order('created_at', { ascending: false }).limit(2000);
  const map = new Map<string, any>();
  for (const o of (data ?? []) as any[]) { const k = o.kunde_telefon || o.kunde_name; if (!k) continue; const e = map.get(k) || { name: o.kunde_name || '—', email: o.kunde_email || o.kunde_telefon || '', orders: 0, total: 0 }; e.orders++; e.total += Number(o.gesamtbetrag ?? 0); map.set(k, e); }
  const customers = [...map.values()].sort((a, b) => b.total - a.total);
  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }}>
        {CAMP.map((c) => (<Soon key={c.name} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer', textAlign: 'left', width: '100%' }}><div style={{ width: 42, height: 42, borderRadius: 11, background: c.bg, flexShrink: 0 }} /><div style={{ flex: 1 }}><div style={{ fontSize: 14.5, fontWeight: 700, color: '#0F172A' }}>{c.name}</div><div style={{ fontSize: 12.5, color: '#94A3B8' }}>{c.desc}</div></div><span style={{ fontSize: 10.5, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '2px 7px', borderRadius: 6 }}>Bald</span></Soon>))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 11, padding: '11px 15px', marginBottom: 18 }}><span style={{ fontSize: 13, color: '#92400E', fontWeight: 600 }}>⚠ Marketing wird nur an Kunden mit ausdrücklicher Einwilligung gesendet.</span></div>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #F1F5F9' }}><h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Kunden <span style={{ color: '#94A3B8', fontWeight: 500 }}>· {customers.length}</span></h3></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 0.7fr 0.9fr 1fr', padding: '11px 22px', background: '#F8FAFC', fontSize: 12, fontWeight: 700, color: '#94A3B8', letterSpacing: '.3px' }}><span>KUNDE</span><span>KONTAKT</span><span>BEST.</span><span>UMSATZ</span><span>STATUS</span></div>
        {customers.length === 0 && <div style={{ padding: '24px 22px', color: '#94A3B8', fontSize: 13 }}>Noch keine Kunden.</div>}
        {customers.slice(0, 60).map((c, i) => { const stamm = c.orders >= 3; return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 0.7fr 0.9fr 1fr', alignItems: 'center', padding: '14px 22px', borderTop: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}><div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#A5B4FC,#6366F1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{(c.name || '?').slice(0, 2).toUpperCase()}</div><div style={{ minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{c.name}</div></div></div>
            <span style={{ fontSize: 13, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</span>
            <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#334155' }}>{c.orders}</span>
            <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{eur(c.total)}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: stamm ? '#047857' : '#64748B', background: stamm ? '#ECFDF5' : '#F1F5F9', padding: '4px 10px', borderRadius: 999, justifySelf: 'start' }}>{stamm ? 'Stammkunde' : 'Neukunde'}</span>
          </div>
        ); })}
      </div>
    </div>
  );
}
