'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Truck, ShoppingBag, MapPin, BellRing, Printer, Check, Maximize, Volume2, VolumeX,
  Undo2, X, UtensilsCrossed, RotateCcw, Bike, AlertTriangle,
} from 'lucide-react';
import { getKitchenData, acceptOrder, markFertig, recallOrder, toggleItem, stornoOrder, markItemMissing } from './actions';

const C = {
  appBg: '#0B0F0D', headerBg: '#121815', laneBg: '#0E1311', card: '#18211C', cardHover: '#1F2A24',
  border: '#26332C', borderStrong: '#2E3D35', t1: '#F4F8F5', t2: '#9DB0A5', t3: '#6B7D72', link: '#5AB0FF',
  neu: '#FFB020', neuTint: '#3A2D0E', zub: '#12B85C', zubTint: '#0E2E1C', fertig: '#22C9C0', fertigTint: '#0C2E2C',
  warn: '#FF4D4F', warnTint: '#3A1517', warnSoft: '#FF8A3D', gold: '#F0BC44', goldTint: '#2E2410', btnHover: '#15CF66',
};
const PREP = [15, 20, 25, 30, 45];
const DEFAULT_PREP = 20;

type Item = { id: string; name: string; menge: number; notiz: string | null; pick_missing?: boolean | null };
type Order = {
  id: string; bestellnummer: string | null; status: string; kunde_name: string | null;
  kunde_telefon: string | null; kunde_adresse: string | null; typ: string | null; gesamtbetrag: number | null;
  fertig_am: string | null; created_at: string; mise_driver_id: string | null; items: Item[];
};
type MenuItem = { id: string; name: string; verfuegbar: boolean };

function typeCfg(typ: string | null) {
  if (typ === 'lieferung') return { label: 'Lieferung', Icon: Truck, color: C.link, tint: '#14233A' };
  if (typ === 'abholung') return { label: 'Abholung', Icon: ShoppingBag, color: C.gold, tint: C.goldTint };
  return { label: 'Vor Ort', Icon: MapPin, color: C.zub, tint: C.zubTint };
}
const fmt = (sec: number) => { const a = Math.abs(sec); return `${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`; };

export default function KitchenMonitor({
  token, shopName, initialOrders, initialItems, logoUrl, brandColor,
}: {
  token: string; shopName: string; initialOrders: Order[]; initialItems: MenuItem[]; logoUrl: string | null; brandColor: string | null;
}) {
  const brand = brandColor || C.zub;
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [soldOutOpen, setSoldOutOpen] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [pickTime, setPickTime] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [stornoConfirm, setStornoConfirm] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [activated, setActivated] = useState(false);
  const [muted, setMuted] = useState(false);
  const [autoPrint, setAutoPrint] = useState(true);
  const [toast, setToast] = useState<{ text: string; undo: () => void } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pendingMissing = useRef<Set<string>>(new Set());

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    let alive = true;
    async function poll() {
      const r = await getKitchenData(token);
      if (!alive || 'error' in r) return;
      const fresh = r.orders as Order[];
      // lokale pending "fehlt"-Edits bewahren (Polling ueberschreibt sonst)
      for (const o of fresh) for (const it of (o.items ?? [])) if (pendingMissing.current.has(it.id)) it.pick_missing = true;
      setOrders(fresh); setItems(r.items as MenuItem[]);
    }
    const iv = setInterval(poll, 4000);
    return () => { alive = false; clearInterval(iv); };
  }, [token]);

  const neu = orders.filter((o) => o.status === 'neu' || o.status === 'bestätigt')
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  const kochen = orders.filter((o) => o.status === 'in_zubereitung')
    .sort((a, b) => (a.fertig_am ? +new Date(a.fertig_am) : Infinity) - (b.fertig_am ? +new Date(b.fertig_am) : Infinity));
  const fertig = orders.filter((o) => o.status === 'fertig');
  const soldOutCount = items.filter((i) => !i.verfuegbar).length;
  const ringing = neu.length > 0 ? neu[0] : null;

  // All-Day-Counts (aggregiert ueber alle aktiven Orders)
  const allDay = (() => {
    const m = new Map<string, number>();
    for (const o of orders) for (const it of (o.items ?? [])) m.set(it.name, (m.get(it.name) ?? 0) + it.menge);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  })();

  // Alarm (mutebar): heult solange neue Order wartet
  useEffect(() => {
    if (!ringing || !activated || muted) return;
    let stopped = false; const ctx = audioCtxRef.current; if (!ctx) return;
    try { ctx.resume(); } catch { /* noop */ }
    function beep() {
      if (stopped || !ctx) return; const t = ctx.currentTime;
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sawtooth'; o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(560, t); o.frequency.linearRampToValueAtTime(1180, t + 0.22); o.frequency.linearRampToValueAtTime(560, t + 0.44);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.02); g.gain.setValueAtTime(0.7, t + 0.42); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.start(t); o.stop(t + 0.5);
    }
    beep(); const iv = setInterval(beep, 850);
    return () => { stopped = true; clearInterval(iv); };
  }, [ringing?.id, activated, muted]);

  async function refresh() { const r = await getKitchenData(token); if (!('error' in r)) { setOrders(r.orders as Order[]); setItems(r.items as MenuItem[]); } }
  function showToast(text: string, undo: () => void) { setToast({ text, undo }); setTimeout(() => setToast((t) => (t && t.text === text ? null : t)), 5000); }

  async function onAccept(orderId: string, prepMin: number) {
    setBusy(orderId); setAcceptingId(null); setPickTime(null);
    const ord = orders.find((o) => o.id === orderId);
    await acceptOrder(token, orderId, prepMin);
    if (autoPrint && ord) printBon(ord, prepMin);
    await refresh(); setBusy(null);
  }
  async function onFertig(orderId: string) {
    setBusy(orderId); await markFertig(token, orderId); await refresh(); setBusy(null);
    showToast('Als fertig markiert', async () => { await recallOrder(token, orderId); refresh(); });
  }
  async function onRecall(orderId: string) { setBusy(orderId); await recallOrder(token, orderId); await refresh(); setBusy(null); }
  async function onStorno(orderId: string) { setBusy(orderId); setStornoConfirm(null); await stornoOrder(token, orderId); await refresh(); setBusy(null); }
  async function onItemMissing(itemId: string, missing: boolean) {
    if (missing) pendingMissing.current.add(itemId); else pendingMissing.current.delete(itemId);
    setOrders((os) => os.map((o) => ({ ...o, items: (o.items ?? []).map((it) => it.id === itemId ? { ...it, pick_missing: missing } : it) })));
    await markItemMissing(token, itemId, missing);
    if (missing) showToast('Gericht als fehlt markiert', () => onItemMissing(itemId, false));
  }
  async function onToggle(it: MenuItem) { await toggleItem(token, it.id, !it.verfuegbar); setItems((xs) => xs.map((x) => x.id === it.id ? { ...x, verfuegbar: !x.verfuegbar } : x)); }

  function buildBon(o: Order, prepMin?: number): string {
    const esc = (s: string) => (s || '').replace(/[<>&]/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' } as any)[m]);
    const lines = (o.items ?? []).map((it) => `<div class="it"><b>${it.menge}×</b> ${esc(it.name)}${it.pick_missing ? ' <b>(FEHLT)</b>' : ''}${it.notiz ? `<br><span class="n">  ${esc(it.notiz)}</span>` : ''}</div>`).join('');
    const d = new Date();
    return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:80mm auto;margin:0}*{margin:0;padding:0;box-sizing:border-box}body{width:80mm;padding:4mm 3mm;font-family:'Courier New',monospace;color:#000;font-size:13px;line-height:1.35}.c{text-align:center}.b{font-weight:800}.big{font-size:17px;font-weight:800}hr{border:none;border-top:1px dashed #000;margin:6px 0}.it{margin:3px 0;font-size:14px}.n{font-style:italic;font-size:12px}</style></head><body>
      <div class="c big">${esc(shopName)}</div><div class="c">Küchen-Bon</div><hr>
      <div class="b" style="font-size:16px">#${(o.bestellnummer || '').slice(-6) || '----'}</div>
      <div>${d.toLocaleDateString('de-DE')} ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
      <div class="b">${typeCfg(o.typ).label.toUpperCase()}</div><hr>
      ${o.kunde_name ? `<div class="b">${esc(o.kunde_name)}</div>` : ''}${o.kunde_telefon ? `<div>Tel: ${esc(o.kunde_telefon)}</div>` : ''}${o.typ === 'lieferung' && o.kunde_adresse ? `<div>${esc(o.kunde_adresse)}</div>` : ''}<hr>
      ${lines}<hr>${prepMin ? `<div class="c b" style="font-size:15px">FERTIG IN ${prepMin} MIN</div>` : ''}<div class="c" style="margin-top:8px">.</div></body></html>`;
  }
  function printBon(o: Order, prepMin?: number) {
    try {
      const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
      const doc = f.contentWindow!.document; doc.open(); doc.write(buildBon(o, prepMin)); doc.close();
      setTimeout(() => { try { f.contentWindow!.focus(); f.contentWindow!.print(); } catch { /* noop */ } setTimeout(() => { try { document.body.removeChild(f); } catch { /* noop */ } }, 1500); }, 300);
    } catch { /* noop */ }
  }
  function activate() { try { const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext; audioCtxRef.current = new Ctx(); audioCtxRef.current!.resume(); } catch { /* noop */ } setActivated(true); }

  if (!activated) {
    return (
      <div onClick={activate} style={{ minHeight: '100vh', background: `radial-gradient(120% 80% at 50% -10%, ${brand}22, ${C.appBg} 60%)`, color: C.t1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, cursor: 'pointer', fontFamily: 'system-ui, sans-serif' }}>
        {logoUrl ? <img src={logoUrl} alt="" style={{ height: 80, borderRadius: 16 }} /> : <UtensilsCrossed size={72} color={brand} />}
        <div style={{ fontSize: 30, fontWeight: 800 }}>{shopName}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.t3, letterSpacing: '.12em' }}>mise · KÜCHE</div>
        <button onClick={activate} style={{ padding: '22px 48px', borderRadius: 16, border: 'none', background: brand, color: '#fff', fontSize: 22, fontWeight: 800, cursor: 'pointer', boxShadow: `0 12px 40px -8px ${brand}88` }}>▶ Bildschirm starten</button>
        <div style={{ fontSize: 14, color: C.t3, maxWidth: 340, textAlign: 'center' }}>Einmal tippen, damit der Klingel-Ton funktioniert. Danach läuft alles automatisch.</div>
      </div>
    );
  }

  const sharedCardProps = { onStorno, stornoConfirm, setStornoConfirm, onItemMissing, onPrint: (ord: Order) => printBon(ord) };

  return (
    <div style={{ minHeight: '100vh', background: C.appBg, color: C.t1, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ height: 3, background: brand }} />
      {/* ALARM-POPUP */}
      {ringing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(11,15,13,.82)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'kvig 1.2s ease-in-out infinite' }}>
          <style>{'@keyframes kvig{0%,100%{box-shadow:inset 0 0 160px 30px rgba(255,77,79,.18)}50%{box-shadow:inset 0 0 220px 60px rgba(255,77,79,.42)}}@keyframes kin{from{transform:scale(.92);opacity:.4}to{transform:scale(1);opacity:1}}@keyframes kpul{0%,100%{opacity:1}50%{opacity:.5}}'}</style>
          <div style={{ width: 'min(640px, 94vw)', background: C.card, borderRadius: 24, padding: 28, boxShadow: `0 0 0 3px ${C.warn}, 0 30px 90px -10px #000`, animation: 'kin .22s cubic-bezier(.2,.8,.2,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <BellRing size={34} color={C.warn} style={{ animation: 'kpul .8s ease-in-out infinite' }} />
              <span style={{ fontSize: 32, fontWeight: 900, color: '#FF6B6D' }}>NEUE BESTELLUNG</span>
              {neu.length > 1 && <span style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 800, color: C.t2, background: C.laneBg, padding: '5px 12px', borderRadius: 999 }}>+{neu.length - 1} weitere</span>}
              <button onClick={() => setMuted((m) => !m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted ? C.warn : C.t2, marginLeft: neu.length > 1 ? 8 : 'auto' }}>{muted ? <VolumeX size={26} /> : <Volume2 size={26} />}</button>
            </div>
            <CardHead o={ringing} big />
            <div style={{ margin: '14px 0', maxHeight: '36vh', overflowY: 'auto' }}>
              {(ringing.items ?? []).map((it) => (
                <div key={it.id} style={{ display: 'flex', gap: 10, fontSize: 22, padding: '6px 0' }}>
                  <span style={{ fontWeight: 900, color: C.zub, minWidth: 34 }}>{it.menge}×</span>
                  <span style={{ fontWeight: 700 }}>{it.name}{it.notiz ? <span style={{ color: C.gold, fontSize: 16 }}> · {it.notiz}</span> : null}</span>
                </div>
              ))}
            </div>
            {acceptingId === ringing.id ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {PREP.map((m) => (
                  <button key={m} onClick={() => onAccept(ringing.id, m)} disabled={!!busy} style={{ flex: '1 0 30%', padding: '20px 0', borderRadius: 14, border: 'none', background: C.zub, color: '#fff', fontWeight: 900, fontSize: 21, cursor: 'pointer' }}>{m} Min</button>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => onAccept(ringing.id, DEFAULT_PREP)} disabled={busy === ringing.id} style={{ flex: 1, padding: '24px 0', borderRadius: 16, border: 'none', background: C.zub, color: '#fff', fontWeight: 900, fontSize: 24, cursor: 'pointer' }}>✓ ANNEHMEN · {DEFAULT_PREP} Min</button>
                <button onClick={() => setAcceptingId(ringing.id)} style={{ padding: '0 22px', borderRadius: 16, border: `1px solid ${C.borderStrong}`, background: C.laneBg, color: C.t2, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>andere<br />Zeit</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: C.headerBg, borderBottom: `1px solid ${C.border}`, gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {logoUrl ? <img src={logoUrl} alt="" style={{ height: 36, borderRadius: 8 }} /> : <UtensilsCrossed size={28} color={brand} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, whiteSpace: 'nowrap' }}>{shopName}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.t2 }}>Küche · {orders.length} aktiv</div>
          </div>
        </div>
        {/* All-Day-Counts */}
        <div style={{ display: 'flex', gap: 8, flex: 1, overflowX: 'auto', justifyContent: 'center' }}>
          {allDay.map(([name, n]) => (
            <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.laneBg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '6px 11px', whiteSpace: 'nowrap', fontSize: 13.5 }}>
              <b style={{ color: brand, fontSize: 16 }}>{n}×</b><span style={{ color: C.t2 }}>{name}</span>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: C.t1 }}>{new Date(now).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
          <IconBtn on={() => setMuted((m) => !m)} active={!muted}>{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</IconBtn>
          <IconBtn on={() => setAutoPrint((v) => !v)} active={autoPrint}><Printer size={20} /></IconBtn>
          <button onClick={() => setSoldOutOpen(true)} style={{ padding: '11px 16px', borderRadius: 12, fontWeight: 700, fontSize: 14, border: 'none', background: soldOutCount > 0 ? C.warn : C.border, color: '#fff', cursor: 'pointer' }}>{soldOutCount > 0 ? `${soldOutCount} ausverkauft` : 'Ausverkauft'}</button>
          <IconBtn on={() => { try { document.documentElement.requestFullscreen(); } catch { /* noop */ } }}><Maximize size={20} /></IconBtn>
        </div>
      </div>

      {/* SPALTEN */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, padding: 16, alignItems: 'start' }}>
        <Column title="NEU" count={neu.length} color={C.neu}>
          {neu.map((o) => (
            <Card key={o.id} o={o} now={now} {...sharedCardProps}>
              <button onClick={() => onAccept(o.id, DEFAULT_PREP)} disabled={busy === o.id} style={{ width: '100%', padding: '18px 0', borderRadius: 14, border: 'none', background: C.zub, color: '#fff', fontWeight: 800, fontSize: 19, cursor: 'pointer' }}>✓ Annehmen · {DEFAULT_PREP} Min</button>
            </Card>
          ))}
          {neu.length === 0 && <Empty text="Keine neuen Bestellungen" />}
        </Column>
        <Column title="IN ZUBEREITUNG" count={kochen.length} color={C.zub}>
          {kochen.map((o) => (
            <Card key={o.id} o={o} now={now} {...sharedCardProps}>
              <button onClick={() => onFertig(o.id)} disabled={busy === o.id} style={{ width: '100%', padding: '18px 0', borderRadius: 14, border: 'none', background: C.zub, color: '#fff', fontWeight: 800, fontSize: 19, cursor: 'pointer' }}>🍽 Fertig</button>
            </Card>
          ))}
          {kochen.length === 0 && <Empty text="Nichts in Zubereitung" />}
        </Column>
        <Column title="FERTIG" count={fertig.length} color={C.fertig}>
          {fertig.map((o) => (
            <Card key={o.id} o={o} now={now} {...sharedCardProps}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, textAlign: 'center', padding: '12px 0', color: C.fertig, fontWeight: 800, fontSize: 15, background: C.fertigTint, borderRadius: 12 }}>{o.mise_driver_id ? '🚗 Fahrer zugewiesen' : '✓ Bereit'}</div>
                <button onClick={() => onRecall(o.id)} title="Zurück in Zubereitung" style={{ padding: '0 14px', borderRadius: 12, border: `1px solid ${C.borderStrong}`, background: 'transparent', color: C.t2, cursor: 'pointer' }}><RotateCcw size={18} /></button>
              </div>
            </Card>
          ))}
          {fertig.length === 0 && <Empty text="Nichts fertig" />}
        </Column>
      </div>

      {/* Undo-Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 90, display: 'flex', alignItems: 'center', gap: 14, background: C.card, border: `1px solid ${C.borderStrong}`, borderRadius: 14, padding: '12px 18px', boxShadow: '0 10px 40px -10px #000' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{toast.text}</span>
          <button onClick={() => { toast.undo(); setToast(null); }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.zub, border: 'none', color: '#fff', borderRadius: 10, padding: '8px 14px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}><Undo2 size={16} /> Rückgängig</button>
        </div>
      )}

      {/* Ausverkauft-Drawer */}
      {soldOutOpen && (
        <div onClick={() => setSoldOutOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(460px, 92vw)', height: '100%', background: C.headerBg, padding: 20, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 19, fontWeight: 800 }}>Ausverkauft heute</div>
              <button onClick={() => setSoldOutOpen(false)} style={{ background: 'none', border: 'none', color: C.t2, cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <div style={{ fontSize: 14, color: C.t2, marginBottom: 14 }}>Tippe ein Gericht → ausverkauft (verschwindet sofort aus der Kunden-Speisekarte).</div>
            {items.map((it) => (
              <button key={it.id} onClick={() => onToggle(it)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 16px', borderRadius: 12, marginBottom: 8, border: 'none', cursor: 'pointer', background: it.verfuegbar ? C.card : C.warnTint, color: it.verfuegbar ? C.t1 : '#ff9b9e' }}>
                <span style={{ fontWeight: 600, fontSize: 16, textDecoration: it.verfuegbar ? 'none' : 'line-through' }}>{it.name}</span>
                <span style={{ fontSize: 13, fontWeight: 800 }}>{it.verfuegbar ? 'verfügbar' : 'AUSVERKAUFT'}</span>
              </button>
            ))}
            {items.length === 0 && <div style={{ color: C.t3, fontSize: 14, textAlign: 'center', marginTop: 20 }}>Keine Gerichte gefunden.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({ on, active, children }: { on: () => void; active?: boolean; children: React.ReactNode }) {
  return <button onClick={on} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 12, border: 'none', cursor: 'pointer', background: active ? C.zub : C.border, color: '#fff' }}>{children}</button>;
}
function Column({ title, count, color, children }: { title: string; count: number; color: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.laneBg, borderRadius: 20, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 6px 12px' }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
        <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '.08em', color: C.t1 }}>{title}</span>
        <span style={{ fontSize: 15, fontWeight: 800, color, background: C.card, borderRadius: 9, padding: '2px 11px' }}>{count}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  );
}
function CardHead({ o, big }: { o: Order; big?: boolean }) {
  const tc = typeCfg(o.typ);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontWeight: 800, fontSize: big ? 26 : 28, fontFamily: 'monospace', letterSpacing: '-.01em' }}>#{(o.bestellnummer || '').slice(-4) || '----'}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: tc.tint, color: tc.color, borderRadius: 999, padding: '4px 11px', fontSize: 13.5, fontWeight: 700 }}><tc.Icon size={15} /> {tc.label}</span>
    </div>
  );
}
function Card({ o, now, children, onStorno, stornoConfirm, setStornoConfirm, onItemMissing, onPrint }: {
  o: Order; now: number; children: React.ReactNode; onStorno?: (id: string) => void; stornoConfirm?: string | null;
  setStornoConfirm?: (id: string | null) => void; onItemMissing?: (itemId: string, missing: boolean) => void; onPrint?: (o: Order) => void;
}) {
  const tc = typeCfg(o.typ);
  // Timer: in Zubereitung = Countdown zu fertig_am, sonst Alter seit Eingang
  let sec = 0; let mode: 'count' | 'age' = 'age';
  if (o.status === 'in_zubereitung' && o.fertig_am) { sec = Math.round((new Date(o.fertig_am).getTime() - now) / 1000); mode = 'count'; }
  else { sec = Math.round((now - new Date(o.created_at).getTime()) / 1000); mode = 'age'; }
  const over = mode === 'count' && sec < 0;
  const soon = mode === 'count' && sec >= 0 && sec <= 180;
  const oldAge = mode === 'age' && sec > 600;
  const tColor = over ? C.warn : soon ? C.warnSoft : oldAge ? C.warnSoft : o.status === 'in_zubereitung' ? C.zub : C.neu;
  const edge = o.status === 'neu' || o.status === 'bestätigt' ? C.neu : o.status === 'in_zubereitung' ? C.zub : C.fertig;
  return (
    <div style={{ background: C.card, borderRadius: 18, padding: 18, borderLeft: `5px solid ${edge}`, border: `1px solid ${C.borderStrong}`, borderLeftWidth: 5, boxShadow: '0 4px 16px -6px rgba(0,0,0,.6)', animation: over ? 'kpul 1.2s ease-in-out infinite' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 28, fontFamily: 'monospace' }}>#{(o.bestellnummer || '').slice(-4) || '----'}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: tc.tint, color: tc.color, borderRadius: 999, padding: '4px 10px', fontSize: 13, fontWeight: 700 }}><tc.Icon size={14} /> {tc.label}</span>
          {onPrint && <button onClick={() => onPrint(o)} title="Bon drucken" style={{ display: 'flex', width: 36, height: 36, alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: C.t3, cursor: 'pointer' }}><Printer size={18} /></button>}
        </div>
      </div>
      {(o.kunde_name || o.kunde_telefon) && (
        <div style={{ fontSize: 14.5, color: C.t2, marginBottom: 8, lineHeight: 1.4 }}>
          {o.kunde_name && <span style={{ fontWeight: 700, color: C.t1 }}>{o.kunde_name}</span>}
          {o.kunde_telefon && <a href={`tel:${o.kunde_telefon}`} style={{ color: C.link, textDecoration: 'none', marginLeft: 8 }}>{o.kunde_telefon}</a>}
          {o.typ === 'lieferung' && o.kunde_adresse && <div style={{ fontSize: 14 }}>{o.kunde_adresse}</div>}
        </div>
      )}
      <div style={{ margin: '6px 0 12px' }}>
        {(o.items ?? []).map((it) => (
          <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 20, padding: '6px 0', color: it.pick_missing ? '#ff9b9e' : C.t1 }}>
            <span style={{ fontWeight: 900, color: it.pick_missing ? '#ff9b9e' : C.zub, minWidth: 30 }}>{it.menge}×</span>
            <span style={{ fontWeight: 700, textDecoration: it.pick_missing ? 'line-through' : 'none', flex: 1 }}>{it.name}</span>
            {onItemMissing && <button onClick={() => onItemMissing(it.id, !it.pick_missing)} title="fehlt" style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: it.pick_missing ? C.warnTint : 'transparent', color: it.pick_missing ? '#ff9b9e' : C.t3, cursor: 'pointer', flexShrink: 0 }}><AlertTriangle size={15} /></button>}
          </div>
        ))}
        {(o.items ?? []).flatMap((it) => it.notiz ? [<div key={it.id + 'n'} style={{ background: C.goldTint, color: C.gold, borderRadius: 8, padding: '4px 9px', fontSize: 14, fontWeight: 600, marginTop: 2 }}>{it.name}: {it.notiz}</div>] : [])}
      </div>
      <div style={{ textAlign: 'center', marginBottom: 12, fontSize: 40, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: tColor }}>
        {mode === 'count' ? (over ? `+${fmt(sec)}` : fmt(sec)) : fmt(sec)}
        <span style={{ fontSize: 13, fontWeight: 600, color: C.t3, marginLeft: 8 }}>{mode === 'count' ? (over ? 'überfällig' : 'bis fertig') : 'seit Eingang'}</span>
      </div>
      {children}
      {onStorno && (stornoConfirm === o.id ? (
        <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
          <button onClick={() => setStornoConfirm && setStornoConfirm(null)} style={{ flex: 1, padding: 14, borderRadius: 10, border: 'none', background: C.border, color: C.t2, fontSize: 14, cursor: 'pointer' }}>Nein</button>
          <button onClick={() => onStorno(o.id)} style={{ flex: 1, padding: 14, borderRadius: 10, border: 'none', background: C.warn, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Stornieren</button>
        </div>
      ) : (
        <button onClick={() => setStornoConfirm && setStornoConfirm(o.id)} style={{ width: '100%', marginTop: 8, padding: 8, borderRadius: 10, border: 'none', background: 'transparent', color: C.t3, fontSize: 13, cursor: 'pointer' }}>Stornieren</button>
      ))}
    </div>
  );
}
function Empty({ text }: { text: string }) { return <div style={{ textAlign: 'center', color: '#3a463e', fontSize: 14, padding: '30px 0' }}>{text}</div>; }
