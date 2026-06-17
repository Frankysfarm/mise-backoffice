import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import QRCode from 'qrcode';
export const dynamic = 'force-dynamic';
export default async function ShopSettings() {
  const emp = await getCurrentEmployee();
  const supabase = createServiceClient();
  const { data: t } = await supabase.from('tenants').select('slug, name').eq('id', emp?.tenant_id ?? '').maybeSingle();
  const shopUrl = t?.slug ? `https://mise-gastro.de/biss-app/${t.slug}` : '';
  const qr = shopUrl ? await QRCode.toDataURL(shopUrl, { width: 170, margin: 1, color: { dark: '#0F172A', light: '#FFFFFF' } }) : '';
  const Card = ({ title, children }: any) => (<div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22, boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}><h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{title}</h3>{children}</div>);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
      <Card title="Deine Shop-Adresse">
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 6 }}>MISE-Shop-URL</div>
        <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 15, fontWeight: 600, color: '#4338CA', wordBreak: 'break-all', background: '#EEF2FF', borderRadius: 10, padding: '10px 12px' }}>{shopUrl || '—'}</div>
        {shopUrl && <a href={shopUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 12, color: '#4F46E5', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Shop öffnen →</a>}
        <div style={{ marginTop: 20, fontSize: 13, color: '#64748B', marginBottom: 6 }}>Eigene Domain</div>
        <div style={{ display: 'flex', gap: 8 }}><input placeholder="z.B. shop.dein-restaurant.de" style={{ flex: 1, height: 38, border: '1px solid #E2E8F0', borderRadius: 10, padding: '0 12px', fontSize: 13 }} /><button style={{ height: 38, padding: '0 14px', borderRadius: 10, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 13, fontWeight: 600 }}>Verbinden</button></div>
      </Card>
      <Card title="QR-Code">
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {qr ? <img src={qr} alt="QR" width={150} height={150} style={{ borderRadius: 12, border: '1px solid #E2E8F0' }} /> : <div style={{ color: '#94A3B8' }}>—</div>}
          <div><p style={{ fontSize: 13, color: '#64748B' }}>Für Flyer, Tisch-Aufsteller oder Schaufenster. Kunde scannt → Shop.</p></div>
        </div>
      </Card>
    </div>
  );
}
