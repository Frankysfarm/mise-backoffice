'use client';

import { useEffect, useRef, useState } from 'react';
import { getKitchenData, acceptOrder, markFertig, toggleItem, stornoOrder, markItemMissing } from './actions';

type Item = { id: string; name: string; menge: number; notiz: string | null; pick_missing?: boolean | null };
type Order = {
  id: string; bestellnummer: string | null; status: string; kunde_name: string | null;
  kunde_telefon: string | null; kunde_adresse: string | null;
  typ: string | null; gesamtbetrag: number | null; fertig_am: string | null; created_at: string;
  items: Item[];
};
type MenuItem = { id: string; name: string; verfuegbar: boolean };

const PREP_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 45, 60];

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
  const [stornoConfirm, setStornoConfirm] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [activated, setActivated] = useState(false);
  const [autoPrint, setAutoPrint] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Uhr fuer Countdowns
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Polling alle 4s
  useEffect(() => {
    let alive = true;
    async function poll() {
      const r = await getKitchenData(token);
      if (!alive || 'error' in r) return;
      setOrders(r.orders as Order[]);
      setItems(r.items as MenuItem[]);
    }
    const iv = setInterval(poll, 4000);
    return () => { alive = false; clearInterval(iv); };
  }, [token]);

  const neu = orders.filter((o) => o.status === 'neu' || o.status === 'bestätigt');
  const kochen = orders.filter((o) => o.status === 'in_zubereitung');
  const fertig = orders.filter((o) => o.status === 'fertig');
  const soldOutCount = items.filter((i) => !i.verfuegbar).length;
  const ringing = neu.length > 0 ? neu[0] : null; // aelteste neue Order ploppt + klingelt

  // DAUER-ALARM solange eine neue Order wartet (bis angenommen)
  useEffect(() => {
    if (!ringing || !activated) return;
    let stopped = false;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    try { ctx.resume(); } catch { /* noop */ }
    function beep() {
      if (stopped || !ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.setValueAtTime(560, t);
      osc.frequency.linearRampToValueAtTime(1180, t + 0.22);
      osc.frequency.linearRampToValueAtTime(560, t + 0.44);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.75, t + 0.02);
      g.gain.setValueAtTime(0.75, t + 0.42);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.start(t); osc.stop(t + 0.5);
    }
    beep();
    const iv = setInterval(beep, 750);
    return () => { stopped = true; clearInterval(iv); };
  }, [ringing?.id, activated]);

  async function refresh() {
    const r = await getKitchenData(token);
    if (!('error' in r)) { setOrders(r.orders as Order[]); setItems(r.items as MenuItem[]); }
  }
  async function onAccept(orderId: string, prepMin: number) {
    setBusy(orderId); setAcceptingId(null);
    const ord = orders.find((o) => o.id === orderId);
    await acceptOrder(token, orderId, prepMin);
    if (autoPrint && ord) printBon(ord, prepMin);
    await refresh(); setBusy(null);
  }
  async function onFertig(orderId: string) {
    setBusy(orderId);
    await markFertig(token, orderId);
    await refresh(); setBusy(null);
  }
  async function onItemMissing(itemId: string, missing: boolean) {
    setOrders((os) => os.map((o) => ({ ...o, items: (o.items ?? []).map((it) => it.id === itemId ? { ...it, pick_missing: missing } : it) })));
    await markItemMissing(token, itemId, missing);
  }
  async function onStorno(orderId: string) {
    setBusy(orderId); setStornoId(null);
    await stornoOrder(token, orderId);
    await refresh(); setBusy(null);
  }
  async function onToggle(it: MenuItem) {
    await toggleItem(token, it.id, !it.verfuegbar);
    setItems((xs) => xs.map((x) => x.id === it.id ? { ...x, verfuegbar: !x.verfuegbar } : x));
  }
  function buildBon(o: Order, prepMin?: number): string {
    const esc = (s: string) => (s || '').replace(/[<>&]/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' } as any)[m]);
    const lines = (o.items ?? []).map((it) => `<div class="it"><b>${it.menge}×</b> ${esc(it.name)}${it.pick_missing ? ' <b>(FEHLT)</b>' : ''}${it.notiz ? `<br><span class="n">  ${esc(it.notiz)}</span>` : ''}</div>`).join('');
    const typ = o.typ === 'lieferung' ? 'LIEFERUNG' : o.typ === 'abholung' ? 'ABHOLUNG' : 'VOR ORT';
    const d = new Date();
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      @page{size:80mm auto;margin:0}
      *{margin:0;padding:0;box-sizing:border-box}
      body{width:80mm;padding:4mm 3mm;font-family:'Courier New',monospace;color:#000;font-size:13px;line-height:1.35}
      .c{text-align:center}.b{font-weight:800}.big{font-size:17px;font-weight:800}
      hr{border:none;border-top:1px dashed #000;margin:6px 0}
      .it{margin:3px 0;font-size:14px}.n{font-style:italic;font-size:12px}
    </style></head><body>
      <div class="c big">${esc(shopName)}</div>
      <div class="c">Küchen-Bon</div>
      <hr>
      <div class="b" style="font-size:16px">#${(o.bestellnummer || '').slice(-6) || '----'}</div>
      <div>${d.toLocaleDateString('de-DE')} ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
      <div class="b">${typ}</div>
      <hr>
      ${o.kunde_name ? `<div class="b">${esc(o.kunde_name)}</div>` : ''}
      ${o.kunde_telefon ? `<div>Tel: ${esc(o.kunde_telefon)}</div>` : ''}
      ${o.typ === 'lieferung' && o.kunde_adresse ? `<div>${esc(o.kunde_adresse)}</div>` : ''}
      <hr>
      ${lines}
      <hr>
      ${prepMin ? `<div class="c b" style="font-size:15px">FERTIG IN ${prepMin} MIN</div>` : ''}
      <div class="c" style="margin-top:8px">.</div>
    </body></html>`;
  }
  function printBon(o: Order, prepMin?: number) {
    try {
      const f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
      document.body.appendChild(f);
      const doc = f.contentWindow!.document;
      doc.open(); doc.write(buildBon(o, prepMin)); doc.close();
      setTimeout(() => { try { f.contentWindow!.focus(); f.contentWindow!.print(); } catch { /* noop */ } setTimeout(() => { try { document.body.removeChild(f); } catch { /* noop */ } }, 1500); }, 300);
    } catch { /* noop */ }
  }

  function activate() {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new Ctx();
      audioCtxRef.current.resume();
    } catch { /* noop */ }
    setActivated(true);
  }

  // ── Aktivierungs-Overlay (entsperrt Ton, Browser-Pflicht) ──
  if (!activated) {
    return (
      <div onClick={activate} style={{ minHeight: '100vh', background: '#0f1411', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, cursor: 'pointer', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ fontSize: 60 }}>🍕</div>
        <div style={{ fontSize: 26, fontWeight: 800 }}>{shopName} · Küche</div>
        <button onClick={activate} style={{ padding: '20px 40px', borderRadius: 16, border: 'none', background: '#0F9C50', color: '#fff', fontSize: 22, fontWeight: 800, cursor: 'pointer' }}>
          ▶ Bildschirm starten
        </button>
        <div style={{ fontSize: 14, color: '#7d9488', maxWidth: 320, textAlign: 'center' }}>Einmal tippen, damit der Klingel-Ton funktioniert. Danach läuft alles automatisch.</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f1411', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      {/* ── VOLLBILD-POPUP: neue Bestellung (klingelt bis angenommen) ── */}
      {ringing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'kflash .55s steps(1) infinite' }}>
          <style>{'@keyframes kflash{0%{background:rgba(229,72,77,.6)}50%{background:rgba(229,72,77,.05)}100%{background:rgba(229,72,77,.6)}}@keyframes kshake{0%,100%{transform:translateX(0) scale(1)}15%{transform:translateX(-8px) scale(1.03)}30%{transform:translateX(8px) scale(1.03)}45%{transform:translateX(-6px)}60%{transform:translateX(6px)}75%{transform:translateX(-3px)}}@keyframes kblink{0%,49%{opacity:1}50%,100%{opacity:.3}}'}</style>
          <div style={{ width: 'min(580px, 96vw)', background: '#1d2823', borderRadius: 24, padding: 26, boxShadow: '0 0 0 5px #E5484D, 0 24px 90px -10px #000', animation: 'kshake .55s ease-in-out infinite' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 38, animation: 'kblink .7s steps(1) infinite' }}>🔔</span>
              <span style={{ fontSize: 26, fontWeight: 900, color: '#ff5a5e', letterSpacing: '.03em', animation: 'kblink .7s steps(1) infinite' }}>NEUE BESTELLUNG</span>
              {neu.length > 1 && <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: '#9fb3a7' }}>+{neu.length - 1} weitere</span>}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>#{(ringing.bestellnummer || '').slice(-4) || '----'} · {ringing.typ === 'lieferung' ? '🚗 Lieferung' : ringing.typ === 'abholung' ? '🥡 Abholung' : '📍 Vor Ort'}</div>
            <div style={{ margin: '12px 0', maxHeight: '38vh', overflowY: 'auto' }}>
              {(ringing.items ?? []).map((it) => (
                <div key={it.id} style={{ display: 'flex', gap: 10, fontSize: 19, padding: '5px 0' }}>
                  <span style={{ fontWeight: 900, color: '#0F9C50', minWidth: 32 }}>{it.menge}×</span>
                  <span style={{ fontWeight: 700 }}>{it.name}{it.notiz ? <span style={{ color: '#E0A82E', fontSize: 15 }}> · {it.notiz}</span> : null}</span>
                </div>
              ))}
            </div>
            {acceptingId === ringing.id ? (
              <div>
                <div style={{ fontSize: 14, color: '#9fb3a7', marginBottom: 8, fontWeight: 700 }}>In wie viel Minuten fertig?</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {PREP_OPTIONS.map((m) => (
                    <button key={m} onClick={() => onAccept(ringing.id, m)} disabled={!!busy}
                      style={{ flex: '1 0 28%', padding: '20px 0', borderRadius: 14, border: 'none', background: '#0F9C50', color: '#fff', fontWeight: 900, fontSize: 20, cursor: 'pointer' }}>
                      {m} Min
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button onClick={() => setAcceptingId(ringing.id)} disabled={busy === ringing.id}
                style={{ width: '100%', padding: '22px 0', borderRadius: 16, border: 'none', background: '#0F9C50', color: '#fff', fontWeight: 900, fontSize: 24, cursor: 'pointer' }}>
                ✓ ANNEHMEN
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', background: '#16201b', borderBottom: '1px solid #243029' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🍕</span>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800 }}>{shopName}</div>
            <div style={{ fontSize: 12.5, color: '#7d9488' }}>Küche · {orders.length} aktiv</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => setAutoPrint((v) => !v)} title="Bon automatisch drucken beim Annehmen"
            style={{ padding: '11px 14px', borderRadius: 12, fontWeight: 700, fontSize: 14, border: 'none', background: autoPrint ? '#0F9C50' : '#243029', color: '#fff', cursor: 'pointer' }}>
            🖨 Auto-Druck {autoPrint ? 'AN' : 'AUS'}
          </button>
          <button onClick={() => setSoldOutOpen(true)}
            style={{ padding: '11px 18px', borderRadius: 12, fontWeight: 700, fontSize: 15, border: 'none',
              background: soldOutCount > 0 ? '#E5484D' : '#243029', color: '#fff', cursor: 'pointer' }}>
            {soldOutCount > 0 ? `${soldOutCount} ausverkauft` : 'Ausverkauft verwalten'}
          </button>
        </div>
      </div>

      {/* 3 Spalten */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, padding: 16, alignItems: 'start' }}>
        <Column title="NEU" count={neu.length} color="#E0A82E">
          {neu.map((o) => (
            <Card key={o.id} o={o} onStorno={onStorno} stornoConfirm={stornoConfirm} setStornoConfirm={setStornoConfirm} onItemMissing={onItemMissing} onPrint={(ord) => printBon(ord)}>
              <button onClick={() => setAcceptingId(o.id)} disabled={busy === o.id}
                style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: '#0F9C50', color: '#fff', fontWeight: 800, fontSize: 17, cursor: 'pointer' }}>
                ✓ Annehmen
              </button>
            </Card>
          ))}
          {neu.length === 0 && <Empty text="Keine neuen Bestellungen" />}
        </Column>

        <Column title="IN ZUBEREITUNG" count={kochen.length} color="#E07C0B">
          {kochen.map((o) => {
            const left = o.fertig_am ? Math.round((new Date(o.fertig_am).getTime() - now) / 60000) : null;
            const over = left != null && left < 0;
            return (
              <Card key={o.id} o={o} onStorno={onStorno} stornoConfirm={stornoConfirm} setStornoConfirm={setStornoConfirm} onItemMissing={onItemMissing} onPrint={(ord) => printBon(ord)}>
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
            <Card key={o.id} o={o} onStorno={onStorno} stornoConfirm={stornoConfirm} setStornoConfirm={setStornoConfirm} onItemMissing={onItemMissing} onPrint={(ord) => printBon(ord)}>
              <div style={{ textAlign: 'center', padding: '10px 0', color: '#0F9C50', fontWeight: 800, fontSize: 16 }}>✓ Bereit zur Abholung</div>
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
            <div style={{ fontSize: 13, color: '#7d9488', marginBottom: 14 }}>Tippe ein Gericht → ausverkauft (Kunden können es nicht mehr bestellen).</div>
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

function Card({ o, children, onStorno, stornoConfirm, setStornoConfirm, onItemMissing, onPrint }: { o: Order; children: React.ReactNode; onStorno?: (id: string) => void; stornoConfirm?: string | null; setStornoConfirm?: (id: string | null) => void; onItemMissing?: (itemId: string, missing: boolean) => void; onPrint?: (o: Order) => void }) {
  return (
    <div style={{ background: '#1d2823', borderRadius: 16, padding: 15, boxShadow: '0 2px 12px -6px rgba(0,0,0,.5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 17, fontFamily: 'monospace' }}>#{(o.bestellnummer || '').slice(-4) || '----'}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#7d9488', fontWeight: 600 }}>{o.typ === 'lieferung' ? '🚗 Lieferung' : o.typ === 'abholung' ? '🥡 Abholung' : '📍 Vor Ort'}</span>
          {onPrint && <button onClick={() => onPrint(o)} title="Bon drucken" style={{ background: 'none', border: 'none', color: '#9fb3a7', fontSize: 16, cursor: 'pointer', padding: 0 }}>🖨</button>}
        </span>
      </div>
      {(o.kunde_name || o.kunde_telefon) && (
        <div style={{ fontSize: 12.5, color: '#9fb3a7', marginBottom: 8, lineHeight: 1.4 }}>
          {o.kunde_name && <div style={{ fontWeight: 700, color: '#cdddd3' }}>{o.kunde_name}</div>}
          {o.kunde_telefon && <a href={`tel:${o.kunde_telefon}`} style={{ color: '#4aa3ff', textDecoration: 'none' }}>📞 {o.kunde_telefon}</a>}
          {o.typ === 'lieferung' && o.kunde_adresse && <div>📍 {o.kunde_adresse}</div>}
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        {(o.items ?? []).map((it) => (
          <button key={it.id} onClick={() => onItemMissing && onItemMissing(it.id, !it.pick_missing)} disabled={!onItemMissing}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15.5, padding: '5px 7px', width: '100%', textAlign: 'left', borderRadius: 8, border: 'none', cursor: onItemMissing ? 'pointer' : 'default',
              background: it.pick_missing ? '#3a1c1d' : 'transparent', color: it.pick_missing ? '#ff9b9e' : '#fff' }}>
            <span style={{ fontWeight: 800, color: it.pick_missing ? '#ff9b9e' : '#0F9C50', minWidth: 24 }}>{it.menge}×</span>
            <span style={{ fontWeight: 600, textDecoration: it.pick_missing ? 'line-through' : 'none' }}>{it.name}{it.notiz ? <span style={{ color: '#E0A82E', fontSize: 13 }}> · {it.notiz}</span> : null}</span>
            {it.pick_missing && <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 800, color: '#ff9b9e' }}>FEHLT</span>}
          </button>
        ))}
        {(o.items ?? []).length === 0 && <div style={{ color: '#7d9488', fontSize: 14 }}>(keine Positionen)</div>}
      </div>
      {children}
      {onStorno && (
        stornoConfirm === o.id ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => onStorno(o.id)} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: '#E5484D', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Wirklich stornieren</button>
            <button onClick={() => setStornoConfirm(null)} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#243029', color: '#9fb3a7', fontSize: 13, cursor: 'pointer' }}>Nein</button>
          </div>
        ) : (
          <button onClick={() => setStornoConfirm(o.id)} style={{ width: '100%', marginTop: 8, padding: 8, borderRadius: 10, border: 'none', background: 'transparent', color: '#6b7d72', fontSize: 12, cursor: 'pointer' }}>Stornieren</button>
        )
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', color: '#445249', fontSize: 13.5, padding: '30px 0' }}>{text}</div>;
}
