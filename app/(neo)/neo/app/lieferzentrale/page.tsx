import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import QRCode from 'qrcode';
import { Kanban, CopyBtn, FahrerLiveMap, BatchPanel } from './client';
export const dynamic = 'force-dynamic';
export default async function Lieferzentrale() {
  const emp = await getCurrentEmployee();
  const supabase = createServiceClient();
  const [{ data: loc }, { data: locPos }] = await Promise.all([
    supabase.from('locations').select('id, kitchen_token').eq('id', emp?.location_id ?? '').maybeSingle(),
    supabase.from('locations').select('lat, lng').eq('id', emp?.location_id ?? '').maybeSingle(),
  ]);
  const url = loc?.kitchen_token ? `https://mise-gastro.de/kuche/${loc.kitchen_token}` : '';
  const qr = url ? await QRCode.toDataURL(url, { width: 108, margin: 0, color: { dark: '#0F172A', light: '#FFFFFF' } }) : '';
  const { data: orders } = await supabase
    .from('customer_orders')
    .select('id, bestellnummer, status, typ, gesamtbetrag, zwischensumme, bezahlt, kunde_name, voucher_code, voucher_rabatt, reward_items_count, mise_batch_id, mise_driver_id, created_at, items:order_items(name, menge, einzelpreis, notiz)')
    .eq('location_id', loc?.id ?? '')
    .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs'])
    .order('created_at', { ascending: true })
    .limit(80);
  // Fahrer für diesen Tenant laden
  const { data: driverLinks } = emp?.tenant_id
    ? await supabase.from('mise_driver_tenants').select('driver_id').eq('tenant_id', emp.tenant_id)
    : { data: null };
  const driverIds = (driverLinks ?? []).map((x: any) => x.driver_id as string).filter(Boolean);
  const [driverResult, batchResult] = await Promise.all([
    driverIds.length
      ? supabase.from('mise_drivers').select('id, name, vehicle, state, last_lat, last_lng, last_position_at').in('id', driverIds)
      : { data: null },
    driverIds.length
      ? supabase
          .from('mise_delivery_batches')
          .select('id, state, total_eta_min, accepted_at, picked_up_at, created_at, driver_id, driver:mise_drivers(id, name, vehicle), stops:mise_delivery_batch_stops(id, order_id, sequence, type, address, lat, lng, completed_at, order:customer_orders(bestellnummer, kunde_name, gesamtbetrag))')
          .in('driver_id', driverIds)
          .in('state', ['pending_acceptance', 'assigned', 'at_restaurant', 'picked_up', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(20)
      : { data: null },
  ]);
  const drivers = (driverResult?.data ?? []) as any[];
  const batches = (batchResult?.data ?? []) as any[];
  const list = (orders ?? []) as any[];
  const open = list.length;
  const locationId = loc?.id ?? '';
  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 999, padding: '6px 13px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} /><span style={{ fontSize: 13, fontWeight: 700, color: '#047857' }}>Shop geöffnet · live verbunden</span></span>
          <span style={{ fontSize: 13, color: '#64748B' }}>{open} offene Bestellungen</span>
        </div>
        <span style={{ fontSize: 13, color: '#94A3B8' }}>Verknüpft mit Shop & Backoffice</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, background: 'linear-gradient(120deg,#1E1B4B,#312E81 60%,#4338CA)', borderRadius: 16, padding: '20px 26px', marginBottom: 18, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .5, backgroundImage: 'radial-gradient(circle at 1px 1px,rgba(255,255,255,.1) 1px,transparent 0)', backgroundSize: '22px 22px' }} />
        <div style={{ position: 'relative', flex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 999, padding: '4px 11px', marginBottom: 11 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399' }} /><span style={{ fontSize: 11, fontWeight: 700, color: '#C7D2FE', letterSpacing: '.4px' }}>EIGENES SYSTEM · LIVE VERKNÜPFT</span></div>
          <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-.4px' }}>Lieferzentrale auf dem Tablet öffnen</h3>
          <p style={{ fontSize: 13.5, color: '#C7D2FE', marginTop: 5, marginBottom: 16, maxWidth: 520 }}>Das Küchendisplay läuft als eigenständiges System im Browser — automatisch verbunden mit Shop, Bestellungen & Backoffice. Per Link oder QR-Code auf jedem Gerät starten.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.16)', borderRadius: 10, padding: '9px 14px' }}><span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 13.5, fontWeight: 600, color: '#fff' }}>{url ? url.replace('https://', '') : 'kein Token'}</span></div>
            {url && <CopyBtn url={url} />}
            {url && <a href={url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 7, height: 40, padding: '0 18px', borderRadius: 10, background: '#fff', color: '#312E81', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>Zentrale öffnen</a>}
          </div>
        </div>
        {qr && <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}><div style={{ width: 108, height: 108, background: '#fff', borderRadius: 14, padding: 9, boxShadow: '0 10px 26px rgba(0,0,0,.25)' }}><img src={qr} alt="QR-Code zur Lieferzentrale" width={90} height={90} style={{ display: 'block', width: '100%', height: '100%' }} /></div><span style={{ fontSize: 11.5, fontWeight: 600, color: '#C7D2FE' }}>Scannen zum Öffnen</span></div>}
      </div>
      <FahrerLiveMap initial={drivers} center={{ lat: locPos?.lat ?? null, lng: locPos?.lng ?? null }} locationId={locationId} />
      <BatchPanel initial={batches} locationId={locationId} />
      <Kanban orders={list} locationId={locationId} />
    </div>
  );
}
