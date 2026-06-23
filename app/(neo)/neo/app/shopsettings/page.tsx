import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import QRCode from 'qrcode';
import { ShopToggle, QrButtons } from './client';
import { Soon } from '../_soon';
import { DomainManager } from './domain-manager';
import { getRegistrar, SERVER_IP } from '@/lib/domains/registrar';
export const dynamic = 'force-dynamic';
export default async function ShopSettings() {
  const emp = await getCurrentEmployee();
  const supabase = createServiceClient();
  const [{ data: t }, { data: loc }] = await Promise.all([
    supabase.from('tenants').select('name, slug, custom_domain, custom_domain_status, custom_domain_error').eq('id', emp?.tenant_id ?? '').maybeSingle(),
    supabase.from('locations').select('id, geschlossen_bis').eq('id', emp?.location_id ?? '').maybeSingle(),
  ]);
  const registrarConfigured = getRegistrar().isConfigured();
  // DB-Status (pending|dns_ok|provisioning|active|error|null) → UI-State
  const rawDom = (t as any)?.custom_domain_status as string | null;
  const domStatus: 'none' | 'pending' | 'active' | 'error' =
    rawDom === 'active' ? 'active' : rawDom === 'error' ? 'error' : ['pending', 'dns_ok', 'provisioning'].includes(rawDom ?? '') ? 'pending' : 'none';
  const slug = t?.slug || '';
  const shopUrl = slug ? `https://mise-gastro.de/biss-app/${slug}` : '';
  const subdomain = slug ? `${slug}.mise-gastro.de` : 'mise-gastro.de';
  const qr = shopUrl ? await QRCode.toDataURL(shopUrl, { width: 180, margin: 1, color: { dark: '#0F172A', light: '#FFFFFF' } }) : '';
  const closed = !!(loc?.geschlossen_bis && new Date(loc.geschlossen_bis) > new Date());
  const online = !closed;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 24, maxWidth: 1180, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        <DomainManager subdomain={subdomain} customDomain={(t as any)?.custom_domain ?? null} status={domStatus} errorMsg={(t as any)?.custom_domain_error ?? null} serverIp={SERVER_IP} registrarConfigured={registrarConfigured} />
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
