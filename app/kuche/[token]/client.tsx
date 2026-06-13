'use client';

import { useEffect, useRef, useState } from 'react';
import { getKitchenData, acceptOrder, markFertig, toggleItem } from './actions';

type Item = { id: string; name: string; menge: number; notiz: string | null };
type Order = {
  id: string; bestellnummer: string | null; status: string; kunde_name: string | null;
  typ: string | null; gesamtbetrag: number | null; fertig_am: string | null; created_at: string;
  items: Item[];
};
type MenuItem = { id: string; name: string; verfuegbar: boolean };

const PREP_OPTIONS = [10, 15, 20, 25, 30];

export default function KitchenMonitor({
  token, shopName, initialOrders, initialItems,
}: {
  token: string; shopName: string; initialOrders: Order[]; initialItems: MenuItem[];
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [soldOutOpen, setSoldOutOpen] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const prevNewCount = useRef(initialOrders.filter((o) => o.status === 'neu').length);

  // Uhr fuer Countdowns
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Polling alle 6s
  useEffect(() => {
    let alive = true;
    async function poll() {
      const r = await getKitchenData(token);
      if (!alive || 'error' in r) return;
      setOrders(r.orders as Order[]);
      setItems(r.items as MenuItem[]);
      const neu = (r.orders as Order[]).filter((o) => o.status === 'neu').length;
      if (neu > prevNewCount.current) { try { new Audio('/sounds/ding.mp3').play().catch(() => {}); } catch {} }
      prevNewCount.current = neu;
    }
    const iv = setInterval(poll, 6000);
    return () => { alive = false; clearInterval(iv); };
  }, [token]);

  async function refresh() {
    const r = await getKitchenData(token);
    if (!('error' in r)) { setOrders(r.orders as Order[]); setItems(r.items as MenuItem[]); }
  }

  async function onAccept(orderId: string, prepMin: number) {
    setBusy(orderId); setAcceptingId(null);
    await acceptOrder(token, orderId, prepMin);
    await refresh(); setBusy(null);
  }
  async function onFertig(orderId: string) {
    setBusy(orderId);
    await markFertig(token, orderId);
    await refresh(); setBusy(null);
  }
  async function onToggle(it: MenuItem) {
    await toggleItem(token, it.id, !it.verfuegbar);
    setItems((xs) => xs.map((x) => x.id === it.id ? { ...x, verfuegbar: !x.verfuegbar } : x));
  }

  const neu = orders.filter((o) => o.status === 'neu' || o.status === 'bestätigt');
  const kochen = orders.filter((o) => o.status === 'in_zubereitung');
  const fertig = orders.filter((o) => o.status === 'fertig');
  const soldOutCount = items.filter((i) => !i.verfuegbar).length;

  return (
    <div style={{ minHeight: '100vh', background: '#0f1411', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', background: '#16201b', borderBottom: '1px solid #243029' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🍕</span>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800 }}>{shopName}</div>
            <div style={{ fontSize: 12.5, color: '#7d9488' }}>Küche · {orders.length} aktiv</div>
          </div>
        </div>
        <button onClick={() => setSoldOutOpen(true)}
          style={{ padding: '11px 18px', borderRadius: 12, fontWeight: 700, fontSize: 15, border: 'none',
            background: soldOutCount > 0 ? '#E5484D' : '#243029', color: '#fff', cursor: 'pointer' }}>
          {soldOutCount > 0 ? `${soldOutCount} ausverkauft` : 'Ausverkauft verwalten'}
        </button>
      </div>

      {/* 3 Spalten */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, padding: 16, alignItems: 'start' }}>
        <Column title="NEU" count={neu.length} color="#E0A82E">
          {neu.map((o) => (
            <Card key={o.id} o={o}>
              {acceptingId === o.id ? (
                <div>
                  <div style={{ fontSize: 13, color: '#9fb3a7', marginBottom: 8, fontWeight: 600 }}>Zubereitungszeit?</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {PREP_OPTIONS.map((m) => (
                      <button key={m} onClick={() => onAccept(o.id, m)} disabled={!!busy}
                        style={{ flex: '1 0 28%', padding: '14px 0', borderRadius: 12, border: 'none', background: '#0F9C50', color: '#fff', fontWeight: 800, fontSize: 17, cursor: 'pointer' }}>
                        {m} Min
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setAcceptingId(null)} style={{ marginTop: 8, width: '100%', padding: 10, borderRadius: 10, border: 'none', background: 'transparent', color: '#7d9488', fontSize: 13, cursor: 'pointer' }}>Abbrechen</button>
                </div>
              ) : (
                <button onClick={() => setAcceptingId(o.id)} disabled={busy === o.id}
                  style={{ width: '100%', padding: '16px 0', borderRadius: 12, border: 'none', background: '#0F9C50', color: '#fff', fontWeight: 800, fontSize: 18, cursor: 'pointer' }}>
                  ✓ Annehmen
                </button>
              )}
            </Card>
          ))}
          {neu.length === 0 && <Empty text="Keine neuen Bestellungen" />}
        </Column>

        <Column title="IN ZUBEREITUNG" count={kochen.length} color="#E07C0B">
          {kochen.map((o) => {
            const left = o.fertig_am ? Math.round((new Date(o.fertig_am).getTime() - now) / 60000) : null;
            const over = left != null && left < 0;
            return (
              <Card key={o.id} o={o}>
                {left != null && (
                  <div style={{ textAlign: 'center', marginBottom: 10, fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: over ? '#E5484D' : '#E07C0B' }}>
                    {over ? `+${Math.abs(left)} Min` : `noch ${left} Min`}
                  </div>
                )}
                <button onClick={() => onFertig(o.id)} disabled={busy === o.id}
                  style={{ width: '100%', padding: '16px 0', borderRadius: 12, border: 'none', background: '#0F9C50', color: '#fff', fontWeight: 800, fontSize: 18, cursor: 'pointer' }}>
                  🍽 Fertig
                </button>
              </Card>
            );
          })}
          {kochen.length === 0 && <Empty text="Nichts in Zubereitung" />}
        </Column>

        <Column title="FERTIG" count={fertig.length} color="#0F9C50">
          {fertig.map((o) => (
            <Card key={o.id} o={o}>
              <div style={{ textAlign: 'center', padding: '10px 0', color: '#0F9C50', fontWeight: 800, fontSize: 16 }}>
                ✓ Bereit zur Abholung
              </div>
            </Card>
          ))}
          {fertig.length === 0 && <Empty text="Nichts fertig" />}
        </Column>
      </div>

      {/* Ausverkauft-Drawer */}
      {soldOutOpen && (
        <div onClick={() => setSoldOutOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(440px, 92vw)', height: '100%', background: '#16201b', padding: 20, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Ausverkauft heute</div>
              <button onClick={() => setSoldOutOpen(false)} style={{ background: 'none', border: 'none', color: '#7d9488', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ fontSize: 13, color: '#7d9488', marginBottom: 14 }}>Tippe ein Gericht → wird als ausverkauft markiert (Kunden können es nicht mehr bestellen).</div>
            {items.map((it) => (
              <button key={it.id} onClick={() => onToggle(it)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 14px', borderRadius: 12, marginBottom: 8, border: 'none', cursor: 'pointer',
                  background: it.verfuegbar ? '#1d2823' : '#3a1c1d', color: it.verfuegbar ? '#fff' : '#ff9b9e' }}>
                <span style={{ fontWeight: 600, fontSize: 15, textDecoration: it.verfuegbar ? 'none' : 'line-through' }}>{it.name}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{it.verfuegbar ? 'verfügbar' : 'AUSVERKAUFT'}</span>
              </button>
            ))}
            {items.length === 0 && <div style={{ color: '#7d9488', fontSize: 14, textAlign: 'center', marginTop: 20 }}>Keine Gerichte gefunden.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Column({ title, count, color, children }: { title: string; count: number; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px 12px' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
        <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '.06em', color: '#cdddd3' }}>{title}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color, background: '#1d2823', borderRadius: 8, padding: '1px 9px' }}>{count}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

function Card({ o, children }: { o: Order; children: React.ReactNode }) {
  return (
    <div style={{ background: '#1d2823', borderRadius: 16, padding: 15, boxShadow: '0 2px 12px -6px rgba(0,0,0,.5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 17, fontFamily: 'monospace' }}>#{(o.bestellnummer || '').slice(-4) || '----'}</span>
        <span style={{ fontSize: 12, color: '#7d9488', fontWeight: 600 }}>{o.typ === 'lieferung' ? '🚗 Lieferung' : o.typ === 'abholung' ? '🥡 Abholung' : '📍 Vor Ort'}</span>
      </div>
      <div style={{ marginBottom: 12 }}>
        {(o.items ?? []).map((it) => (
          <div key={it.id} style={{ display: 'flex', gap: 8, fontSize: 15.5, padding: '3px 0' }}>
            <span style={{ fontWeight: 800, color: '#0F9C50', minWidth: 24 }}>{it.menge}×</span>
            <span style={{ fontWeight: 600 }}>{it.name}{it.notiz ? <span style={{ color: '#E0A82E', fontSize: 13 }}> · {it.notiz}</span> : null}</span>
          </div>
        ))}
        {(o.items ?? []).length === 0 && <div style={{ color: '#7d9488', fontSize: 14 }}>(keine Positionen)</div>}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', color: '#445249', fontSize: 13.5, padding: '30px 0' }}>{text}</div>;
}
