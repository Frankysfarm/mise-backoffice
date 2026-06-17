import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createClient } from '@/lib/supabase/server';
import QRCode from 'qrcode';
export const dynamic = 'force-dynamic';

const COLS = [
  { label: 'Neu', match: ['neu', 'bestätigt'], color: '#F59E0B', bg: '#FEF3C7' },
  { label: 'In Vorbereitung', match: ['in_zubereitung'], color: '#4F46E5', bg: '#EEF2FF' },
  { label: 'Bereit', match: ['fertig'], color: '#10B981', bg: '#ECFDF5' },
  { label: 'Unterwegs', match: ['unterwegs'], color: '#1D4ED8', bg: '#EFF6FF' },
];

export default async function Lieferzentrale() {
  const emp = await getCurrentEmployee();
  const supabase = await createClient();
  const { data: loc } = await supabase.from('locations').select('id, kitchen_token, name').eq('id', emp?.location_id ?? '').maybeSingle();
  const url = loc?.kitchen_token ? `https://mise-gastro.de/kuche/${loc.kitchen_token}` : '';
  const qr = url ? await QRCode.toDataURL(url, { width: 150, margin: 1, color: { dark: '#0F172A', light: '#FFFFFF' } }) : '';
  const { data: orders } = await supabase.from('customer_orders')
    .select('id, bestellnummer, status, typ, gesamtbetrag, kunde_name, items:order_items(name, menge)')
    .eq('location_id', loc?.id ?? '').in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs'])
    .order('created_at', { ascending: true }).limit(60);
  const list = (orders ?? []) as any[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Banner: Link + QR */}
      <div style={{ background: 'linear-gradient(135deg,#312E81,#4338CA)', borderRadius: 18, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontFamily: "'Space Grotesk'", fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-.4px' }}>Lieferzentrale auf dem Tablet öffnen</h3>
          <p style={{ color: '#C7D2FE', fontSize: 13.5, marginTop: 6, marginBottom: 14, maxWidth: 520 }}>Eigenständiges Küchen-Display — auf einem Tablet in der Küche öffnen. Bestellungen poppen auf, klingeln, werden angenommen + an Fahrer übergeben.</p>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 10, padding: '10px 16px', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none', fontFamily: "'Space Grotesk'" }}>🔗 {url.replace('https://', '')}</a>
          ) : (
            <span style={{ color: '#FCA5A5', fontSize: 13 }}>Kein Küchen-Token für diesen Standort.</span>
          )}
        </div>
        {qr && <div style={{ background: '#fff', borderRadius: 14, padding: 10, flexShrink: 0 }}><img src={qr} alt="QR" width={130} height={130} style={{ display: 'block' }} /></div>}
      </div>
      {/* 4 Status-Spalten */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, alignItems: 'start' }}>
        {COLS.map((col) => {
          const cards = list.filter((o) => col.match.includes(o.status));
          return (
            <div key={col.label} style={{ background: '#F8FAFC', borderRadius: 14, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 12px' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: col.color }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{col.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: col.color, background: col.bg, borderRadius: 999, padding: '1px 8px' }}>{cards.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cards.map((o) => (
                  <div key={o.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 14 }}>#{String(o.bestellnummer || '').slice(-4) || '----'}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>{o.typ === 'lieferung' ? '🚗 Lieferung' : o.typ === 'abholung' ? '🥡 Abholung' : '📍 Vor Ort'}</span>
                    </div>
                    {o.kunde_name && <div style={{ fontSize: 12.5, color: '#475569', marginBottom: 4 }}>{o.kunde_name}</div>}
                    {(o.items ?? []).slice(0, 4).map((it: any, i: number) => (
                      <div key={i} style={{ fontSize: 12.5, color: '#334155' }}><b style={{ color: '#4F46E5' }}>{it.menge}×</b> {it.name}</div>
                    ))}
                    <div style={{ marginTop: 6, fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{Number(o.gesamtbetrag ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</div>
                  </div>
                ))}
                {cards.length === 0 && <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '16px 0' }}>—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
