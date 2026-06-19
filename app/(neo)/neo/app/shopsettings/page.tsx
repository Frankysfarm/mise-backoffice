import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import QRCode from 'qrcode';
import { ShopToggle, QrButtons } from './client';
import { Soon } from '../_soon';
export const dynamic = 'force-dynamic';
export default async function ShopSettings() {
  const emp = await getCurrentEmployee();
  const supabase = createServiceClient();
  const [{ data: t }, { data: loc }] = await Promise.all([
    supabase.from('tenants').select('name, slug').eq('id', emp?.tenant_id ?? '').maybeSingle(),
    supabase.from('locations').select('id, geschlossen_bis').eq('id', emp?.location_id ?? '').maybeSingle(),
  ]);
  const slug = t?.slug || '';
  const shopUrl = slug ? `https://mise-gastro.de/biss-app/${slug}` : '';
  const subdomain = slug ? `${slug}.mise-gastro.de` : 'mise-gastro.de';
  const qr = shopUrl ? await QRCode.toDataURL(shopUrl, { width: 180, margin: 1, color: { dark: '#0F172A', light: '#FFFFFF' } }) : '';
  const closed = !!(loc?.geschlossen_bis && new Date(loc.geschlossen_bis) > new Date());
  const online = !closed;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, maxWidth: 1180, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24 }}>
          <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Shop-Domain</h3>
          <p style={{ fontSize: 13.5, color: '#64748B', marginBottom: 18 }}>Dein Shop läuft auf einer MISE-Subdomain. Eine eigene Domain kannst du jederzeit verbinden.</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#10B981' }} /><div><div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 15, fontWeight: 700, color: '#065F46' }}>{subdomain}</div><div style={{ fontSize: 12, color: '#059669' }}>Aktiv · SSL gesichert</div></div></div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#047857', background: '#fff', border: '1px solid #A7F3D0', padding: '4px 10px', borderRadius: 999 }}>STANDARD</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 7 }}>Eigene Domain verbinden</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input placeholder="z. B. shop.restaurantname.de" style={{ flex: 1, height: 44, border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '0 13px', fontSize: 14 }} />
            <Soon href="/settings/domain" style={{ height: 44, padding: '0 18px', border: 'none', borderRadius: 10, background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Verbinden</Soon>
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24 }}>
          <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Verfügbarkeit</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid #F1F5F9' }}><div><div style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>Shop online</div><div style={{ fontSize: 12.5, color: online ? '#94A3B8' : '#DC2626' }}>{online ? 'Kunden können bestellen' : 'Geschlossen — bis morgen'}</div></div><ShopToggle locId={loc?.id ?? ''} online={online} /></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0' }}><div><div style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>Öffnungszeiten heute</div><div style={{ fontSize: 12.5, color: '#94A3B8' }}>Mo–So · 11:00 – 23:00 Uhr</div></div><Soon href="/settings/restaurant" style={{ fontSize: 13, color: '#4F46E5', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none' }}>Bearbeiten</Soon></div>
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24, textAlign: 'center' }}>
        <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>QR-Code</h3>
        <p style={{ fontSize: 13, color: '#64748B', marginBottom: 18 }}>Führt direkt zu deinem Shop</p>
        <div style={{ width: 180, height: 180, margin: '0 auto 18px', padding: 12, border: '1px solid #E2E8F0', borderRadius: 16 }}>{qr ? <img src={qr} alt="Shop-QR-Code" width={154} height={154} style={{ width: '100%', height: '100%' }} /> : null}</div>
        <div style={{ fontSize: 12.5, color: '#94A3B8', marginBottom: 18 }}>Für Flyer, Tische, Verpackungen & Schaufenster</div>
        {qr && <QrButtons qr={qr} name={slug || 'shop'} />}
      </div>
    </div>
  );
}
