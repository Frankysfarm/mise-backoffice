import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import { Soon } from '../_soon';
import { LoyaltyEditor, VoucherManager } from './client';
export const dynamic = 'force-dynamic';
const IDEAS = ['Happy Hour', '2-für-1 Pizza', 'Gratis Lieferung ab 30€', 'Studenten-Rabatt', 'Mittagsangebot', 'Wochenend-Special'];
export default async function Aktionen() {
  const emp = await getCurrentEmployee();
  const sb = createServiceClient();
  const { data: t } = await sb.from('tenants').select('id, storefront_settings').eq('id', emp?.tenant_id ?? '').maybeSingle();
  const loyalty = ((t?.storefront_settings as any)?.loyalty ?? {}) as { enabled?: boolean; target_stamps?: number; reward_title?: string; reward_text?: string };
  const { data: vouchers } = await sb.from('vouchers').select('id, code, typ, wert, min_bestellwert, beschreibung, gueltig_bis, aktiv, nutzungen_aktuell, nutzungen_max').eq('tenant_id', t?.id ?? '').order('created_at', { ascending: false });
  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 38, height: 38, borderRadius: 10, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>🎁</div><h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Kostenloses Produkt</h3></div><span style={{ fontSize: 11, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '3px 9px', borderRadius: 999 }}>Bald</span></div>
          <p style={{ fontSize: 13.5, color: '#64748B', marginBottom: 14 }}>Jeder Kunde erhält bei seiner Bestellung ein Gratis-Produkt.</p>
          <Soon href="/loyalty" style={{ width: '100%', height: 44, border: '1.5px solid #E2E8F0', borderRadius: 10, background: '#fff', fontSize: 14, color: '#475569', fontWeight: 600, cursor: 'pointer', textAlign: 'left', paddingLeft: 12 }}>Gratis-Produkt festlegen…</Soon>
        </div>
        <LoyaltyEditor tenantId={t?.id ?? ''} current={loyalty} />
      </div>
      <VoucherManager vouchers={(vouchers ?? []) as any[]} />
      <div style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', letterSpacing: '.3px', marginBottom: 10 }}>WEITERE AKTIONS-IDEEN</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>{IDEAS.map((p) => (<Soon key={p} href="/loyalty" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer' }}><span style={{ color: '#4F46E5' }}>+</span>{p}</Soon>))}</div>
    </div>
  );
}
