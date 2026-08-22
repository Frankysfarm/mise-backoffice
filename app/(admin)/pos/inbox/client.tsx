'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Bell, BellOff, Bike, Car, Check, ChefHat, Clock, MapPin, Package,
  Phone, Truck, User, UserCheck, Users, Volume2, VolumeX, X,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { createClient as createBrowserSupabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { ChatModal } from './ChatModal';
import { NewOrderOverlay } from './NewOrderOverlay';

interface OrderItem {
  id: string;
  name: string;
  menge: number;
  einzelpreis: number;
  extras: Array<{ name?: string; preis?: number }> | null;
  notiz: string | null;
}

interface Order {
  id: string;
  bestellnummer: string;
  typ: 'lieferung' | 'abholung' | 'vor_ort';
  status: 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert' | 'abgeholt' | 'storniert';
  kunde_name: string;
  kunde_telefon: string | null;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_stadt: string | null;
  kunde_notiz: string | null;
  gesamtbetrag: number;
  bestellt_am: string;
  bestaetigt_am: string | null;
  zubereitung_start: string | null;
  fertig_am: string | null;
  fahrer_id: string | null;
  geschaetzte_lieferung_min: number | null;
  eta: string | null;
  order_items: OrderItem[] | null;
}

interface Driver {
  id: string;
  vorname: string | null;
  nachname: string | null;
  fahrzeug_praeferenz: 'bike' | 'auto' | 'fuss' | null;
  driver_status: {
    ist_online: boolean | null;
    fahrzeug: string | null;
    aktueller_batch_id: string | null;
    last_update: string | null;
  } | null;
}

interface Props {
  tenantName: string;
  tenantSlug: string;
  locationId: string;
  locationName: string;
  stripeReady: boolean;
  initialOrders: Order[];
  drivers: Driver[];
}

const STATUS_LABEL: Record<string, string> = {
  neu: 'Neu',
  bestätigt: 'Bestätigt',
  in_zubereitung: 'In Zubereitung',
  fertig: 'Fertig',
  unterwegs: 'Unterwegs',
};

const TYP_LABEL: Record<string, string> = {
  lieferung: 'Lieferung',
  abholung: 'Abholung',
  vor_ort: 'Vor Ort',
};

const TYP_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  lieferung: Bike,
  abholung: Package,
  vor_ort: User,
};

const VEHICLE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  bike: Bike,
  auto: Car,
  fuss: User,
};

const ETA_PRESETS = [15, 20, 30, 45, 60];

function playBing(volume: number = 0.8) {
  // Kombination: tiefer Bass-Puls (durchdringt Küchen-Lärm) + heller Akkord
  // Dazu: Vibration auf iPad falls verfügbar
  try {
    const Ctx = (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)!;
    const ctx = new Ctx();
    const baseGain = Math.max(0.05, Math.min(1, volume));
    const ping = (freq: number, when: number, dur: number, type: OscillatorType = 'sine', gainMul: number = 1) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = type;
      gain.gain.setValueAtTime(0, ctx.currentTime + when);
      gain.gain.linearRampToValueAtTime(baseGain * gainMul, ctx.currentTime + when + 0.01);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + when + dur);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + dur);
    };
    // Erste Sequenz: Bass-Puls + heller Akkord
    ping(200, 0, 0.25, 'square', 0.6);
    ping(880, 0.05, 0.15);
    ping(1320, 0.20, 0.15);
    ping(1760, 0.35, 0.20);
    // Wiederholung nach 1,5 Sek (für Kuechen-Lärm)
    ping(200, 1.5, 0.25, 'square', 0.6);
    ping(880, 1.55, 0.15);
    ping(1320, 1.70, 0.15);
    ping(1760, 1.85, 0.20);
  } catch (e) { console.warn('Sound failed', e); }
  // Haptic Feedback (Tablet/iPhone)
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      (navigator as Navigator & { vibrate: (p: number[]) => void }).vibrate([200, 100, 200, 100, 400]);
    }
  } catch {}
}

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec} Sek`;
  if (sec < 3600) return `${Math.floor(sec / 60)} Min`;
  return `${Math.floor(sec / 3600)} Std`;
}

function timeUntil(iso: string): { label: string; overdue: boolean } {
  const sec = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  if (sec <= 0) {
    const overdueMin = Math.abs(Math.floor(sec / 60));
    return { label: overdueMin > 0 ? `${overdueMin} Min überfällig` : 'jetzt', overdue: true };
  }
  if (sec < 60) return { label: `in ${sec} Sek`, overdue: false };
  return { label: `in ${Math.floor(sec / 60)} Min`, overdue: false };
}

function driverName(d: Driver | undefined): string {
  if (!d) return 'Fahrer';
  return [d.vorname, d.nachname].filter(Boolean).join(' ') || 'Fahrer';
}

export function OrderInboxClient({ tenantName, locationId, locationName, stripeReady, initialOrders, drivers }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [soundOn, setSoundOn] = useState<boolean>(() => {
    // Default = AN. Wird in /pos/settings konfiguriert (Sektion "UI / Sound").
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage?.getItem('mise.inbox.sound');
    if (stored === '0') return false;
    return true;
  });
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [etaEditing, setEtaEditing] = useState<string | null>(null);
  const [driverPickerFor, setDriverPickerFor] = useState<string | null>(null);
  const [undoBanner, setUndoBanner] = useState<{ id: string; bestellnummer: string } | null>(null);
  const [acceptingOrder, setAcceptingOrder] = useState<Order | null>(null);
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null);
  const [chatOrder, setChatOrder] = useState<Order | null>(null);
  const [dismissedNewIds, setDismissedNewIds] = useState<Set<string>>(new Set());
  const [printPreview, setPrintPreview] = useState<Order | null>(null);
  const [autoStarPrint, setAutoStarPrint] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage?.getItem('mise.inbox.autoStar') === '1';
  });
  const [viewMode, setViewMode] = useState<'alle' | 'kueche'>(() => {
    if (typeof window === 'undefined') return 'alle';
    return (localStorage.getItem('mise-inbox-view-mode') as 'alle' | 'kueche') || 'alle';
  });
  const knownIdsRef = useRef(new Set(initialOrders.map((o) => o.id)));
  const lastBingRef = useRef<number>(0);
  const ringerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('mise-inbox-view-mode', viewMode);
  }, [viewMode]);

  function ageMin(o: Order): number {
    const ref = o.zubereitung_start ?? o.bestaetigt_am ?? o.bestellt_am;
    return Math.floor((now - new Date(ref).getTime()) / 60000);
  }

  function escalationClass(o: Order): string {
    const min = ageMin(o);
    if (min < 5) return '';
    if (min < 10) return 'bg-yellow-50 border-yellow-400';
    return 'bg-red-50 border-red-500 animate-[pulse_2s_ease-in-out_infinite]';
  }

  const driverById = new Map(drivers.map((d) => [d.id, d]));
  const onlineDrivers = drivers.filter((d) => d.driver_status?.ist_online);
  const fahrendeDriverIds = new Set(orders.filter((o) => o.status === 'unterwegs' && o.fahrer_id).map((o) => o.fahrer_id!));
  const verfuegbareDrivers = onlineDrivers.filter((d) => !fahrendeDriverIds.has(d.id));

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPushPermission(Notification.permission);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  // Klingelt durchgehend solange es unbearbeitete (status='neu') Bestellungen gibt
  // — stoppt sobald alle angenommen oder abgelehnt sind. Erste Pinkette
  // braucht eine User-Interaktion (AudioContext-Policy auf iPad/Safari).
  const neuCount = orders.filter((o) => o.status === 'neu').length;
  useEffect(() => {
    if (ringerIntervalRef.current) {
      clearInterval(ringerIntervalRef.current);
      ringerIntervalRef.current = null;
    }
    if (!soundOn || neuCount === 0) return;
    // sofort einmal pingen
    playBing();
    ringerIntervalRef.current = setInterval(() => {
      if (!document.hidden) playBing();
    }, 4000);
    return () => {
      if (ringerIntervalRef.current) {
        clearInterval(ringerIntervalRef.current);
        ringerIntervalRef.current = null;
      }
    };
  }, [neuCount, soundOn]);

  useEffect(() => {
    const sb = createBrowserSupabase();
    const channel = sb
      .channel(`inbox-${locationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'customer_orders', filter: `location_id=eq.${locationId}` },
        (payload: { new: Order }) => {
          const o = payload.new;
          if (knownIdsRef.current.has(o.id)) return;
          knownIdsRef.current.add(o.id);
          setOrders((prev) => [o, ...prev]);
          // KEIN Auto-Print-Popup mehr bei neuer Bestellung — Print kommt nach Annehmen
          // (Wolt-Style: erst entscheiden, dann ans System geben)
          // Ton wird via Loop-Effect (neuCount-basiert) gesteuert
          if (pushPermission === 'granted') {
            new Notification(`Neue Bestellung #${o.bestellnummer}`, {
              body: `${TYP_LABEL[o.typ]} · ${o.kunde_name} · ${Number(o.gesamtbetrag).toFixed(2)}€`,
              tag: o.id,
              requireInteraction: true,
            });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `location_id=eq.${locationId}` },
        (payload: { new: Order }) => {
          const o = payload.new;
          setOrders((prev) =>
            prev.map((p) => (p.id === o.id ? { ...p, ...o } : p))
              .filter((p) => !['geliefert', 'abgeholt', 'storniert'].includes(p.status)),
          );
        },
      )
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [locationId, soundOn, pushPermission]);


  // ─── Star-Print + Bon-HTML ───────────────────────────────────────
  function buildBonHTML(o: Order): string {
    const items = (o.order_items ?? []).map((it) => {
      const extras = Array.isArray(it.extras)
        ? it.extras.filter((e) => e && (e.name || e.preis)).map((e) => `&nbsp;&nbsp;+ ${e.name ?? ''}${e.preis ? ` (${Number(e.preis).toFixed(2)}€)` : ''}`).join('<br/>')
        : '';
      const notiz = it.notiz ? `<br/>&nbsp;&nbsp;<i>${escapeHtml(it.notiz)}</i>` : '';
      return `<tr><td>${it.menge}× ${escapeHtml(it.name)}${extras ? '<br/>' + extras : ''}${notiz}</td><td style="text-align:right">${(Number(it.einzelpreis) * it.menge).toFixed(2)}€</td></tr>`;
    }).join('');
    const dt = new Date(o.bestellt_am).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
    const typLabel = o.typ === 'lieferung' ? 'LIEFERUNG' : o.typ === 'abholung' ? 'ABHOLUNG' : 'VOR ORT';
    const adresse = o.kunde_adresse ? `${escapeHtml(o.kunde_adresse)}, ${escapeHtml(o.kunde_plz ?? '')} ${escapeHtml(o.kunde_stadt ?? '')}` : '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
      body{font-family:-apple-system,monospace;font-size:12px;color:#000;margin:0;padding:8px;width:300px;}
      h1{font-size:16px;font-weight:900;text-align:center;margin:4px 0;}
      .small{font-size:10px;color:#444;}
      table{width:100%;border-collapse:collapse;}
      td{padding:3px 0;vertical-align:top;}
      hr{border:none;border-top:1px dashed #000;margin:6px 0;}
      .total{font-size:14px;font-weight:900;}
    </style></head><body>
      <h1>${escapeHtml(tenantName)}</h1>
      <div class="small" style="text-align:center">${escapeHtml(locationName)}</div>
      <hr/>
      <div><b>${typLabel}</b> · Bon #${escapeHtml(o.bestellnummer)}</div>
      <div class="small">${dt}</div>
      <div><b>${escapeHtml(o.kunde_name)}</b>${o.kunde_telefon ? ' · ' + escapeHtml(o.kunde_telefon) : ''}</div>
      ${adresse ? `<div class="small">${adresse}</div>` : ''}
      ${o.kunde_notiz ? `<div style="margin-top:4px"><i>${escapeHtml(o.kunde_notiz)}</i></div>` : ''}
      <hr/>
      <table>${items}</table>
      <hr/>
      <table><tr><td class="total">SUMME</td><td class="total" style="text-align:right">${Number(o.gesamtbetrag).toFixed(2)}€</td></tr></table>
      <hr/>
      <div style="text-align:center" class="small">Vielen Dank!</div>
    </body></html>`;
  }

  function escapeHtml(s: string | null | undefined): string {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] as string));
  }

  function sendToStarPrinter(o: Order) {
    const html = buildBonHTML(o);
    const b64 = typeof btoa === 'function'
      ? btoa(unescape(encodeURIComponent(html)))
      : Buffer.from(html, 'utf-8').toString('base64');
    const url = `starpassprnt://v1/print/nopreview?html=${encodeURIComponent(b64)}&back=${encodeURIComponent('mise-pos://')}`;
    window.location.href = url;
  }

  function airPrint(o: Order) {
    const html = buildBonHTML(o);
    const w = window.open('', '_blank', 'width=400,height=600');
    if (!w) { alert('Pop-up blockiert. Bitte Pop-ups erlauben.'); return; }
    w.document.open();
    w.document.write(html + '<script>setTimeout(function(){window.print();window.close();},400)<\/script>');
    w.document.close();
  }

  function toggleAutoStar() {
    const next = !autoStarPrint;
    setAutoStarPrint(next);
    window.localStorage?.setItem('mise.inbox.autoStar', next ? '1' : '0');
  }

  async function askPushPermission() {
    if (typeof Notification === 'undefined') return;
    const p = await Notification.requestPermission();
    setPushPermission(p);
  }

  async function patchOrder(id: string, patch: Record<string, unknown>) {
    setBusy(id);
    try {
      const r = await fetch(`/api/pos/orders/${id}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        alert((e as { error?: string }).error || 'Fehler');
      }
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(id: string, status: string, reason?: string) {
    return patchOrder(id, { status, reason });
  }
  async function assignDriver(orderId: string, fahrerId: string | null) {
    setDriverPickerFor(null);
    return patchOrder(orderId, { fahrer_id: fahrerId });
  }
  async function setEta(orderId: string, minutes: number) {
    setEtaEditing(null);
    return patchOrder(orderId, { eta_min: minutes });
  }

  async function confirmAccept(order: Order, minutes: number) {
    setAcceptingOrder(null);
    setBusy(order.id);
    try {
      await fetch(`/api/pos/orders/${order.id}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'bestätigt', eta_min: minutes }),
      });
      // Silent Auto-Print nach Annehmen wenn aktiviert
      if (autoStarPrint) {
        setTimeout(() => sendToStarPrinter(order), 600);
      }
    } finally {
      setBusy(null);
    }
  }

  async function confirmReject(order: Order, reason: string) {
    setRejectingOrder(null);
    await setStatus(order.id, 'storniert', reason);
    setUndoBanner({ id: order.id, bestellnummer: order.bestellnummer });
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoBanner(null), 10000);
  }

  async function undoReject() {
    if (!undoBanner) return;
    setUndoBanner(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    // Setzt Status zurück auf "neu" — DB muss das erlauben (Bestellung war noch nicht in Küche)
    await fetch(`/api/pos/orders/${undoBanner.id}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'neu' }),
    });
  }

  // Sortierung: ÄLTESTE Bestellung zuerst (Küche soll als nächstes ranlassen)
  const sortByAge = (a: Order, b: Order) => {
    const aRef = a.zubereitung_start ?? a.bestaetigt_am ?? a.bestellt_am;
    const bRef = b.zubereitung_start ?? b.bestaetigt_am ?? b.bestellt_am;
    return new Date(aRef).getTime() - new Date(bRef).getTime();
  };

  const allGroups = {
    neu: orders.filter((o) => o.status === 'neu').sort(sortByAge),
    bestätigt: orders.filter((o) => o.status === 'bestätigt').sort(sortByAge),
    in_zubereitung: orders.filter((o) => o.status === 'in_zubereitung').sort(sortByAge),
    fertig: orders.filter((o) => o.status === 'fertig').sort(sortByAge),
    unterwegs: orders.filter((o) => o.status === 'unterwegs').sort(sortByAge),
  };
  // Küchen-Modus: NUR Bestätigt + In Zubereitung (das was Köche kochen müssen)
  const groupedByStatus = viewMode === 'kueche'
    ? { bestätigt: allGroups.bestätigt, in_zubereitung: allGroups.in_zubereitung }
    : allGroups;

  return (
    <div className="space-y-6">
      {/* UNDO-TOAST nach Ablehnen */}
      {undoBanner && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-zinc-900 text-white shadow-2xl border-2 border-red-500 px-5 py-4 flex items-center gap-4 max-w-md">
          <X className="h-6 w-6 text-red-400 shrink-0" />
          <div className="flex-1">
            <div className="font-display font-black text-base">Bestellung #{undoBanner.bestellnummer} abgelehnt</div>
            <div className="text-xs text-zinc-300">10 Sek Zeit zum Rückgängig machen</div>
          </div>
          <button onClick={undoReject}
            className="px-4 py-2 rounded-xl bg-white text-zinc-900 font-display font-black text-sm active:scale-95">
            RÜCKGÄNGIG
          </button>
        </div>
      )}

      <PageHeader
        title="🔔 Bestelleingang"
        description={`${tenantName} · ${locationName} — Live-Übersicht aller offenen Bestellungen`}
      />

      {/* STRIPE-NOT-READY-BANNER */}
      {!stripeReady && (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 flex items-start gap-3">
          <X className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-display font-black text-red-900 text-base">
              Online-Zahlung noch nicht aktiv
            </h3>
            <p className="text-sm text-red-800 mt-0.5">
              Stripe-Konto ist noch nicht verbunden. Online-Bestellungen kommen rein,
              aber Geld landet nicht auf deinem Konto. <a href="/settings/stripe" className="underline font-bold">Jetzt verbinden →</a>
            </p>
          </div>
        </div>
      )}

      {/* MODUS-TOGGLE — wichtig für Küche */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('alle')}
          className={cn('flex-1 rounded-xl px-4 py-3 text-base font-display font-black transition active:scale-[0.98]',
            viewMode === 'alle' ? 'bg-zinc-900 text-white shadow-lg' : 'bg-white border-2 border-zinc-300 text-zinc-700')}
        >
          📋 Alle Bestellungen
        </button>
        <button
          onClick={() => setViewMode('kueche')}
          className={cn('flex-1 rounded-xl px-4 py-3 text-base font-display font-black transition active:scale-[0.98]',
            viewMode === 'kueche' ? 'bg-orange-600 text-white shadow-lg' : 'bg-white border-2 border-zinc-300 text-zinc-700')}
        >
          👨‍🍳 Küchen-Modus (nur kochen)
        </button>
      </div>

      {/* TOOLBAR — Push-Notification optional, Sound steckt in /pos/settings */}
      <div className="rounded-2xl border-2 border-zinc-200 bg-white p-4 flex flex-wrap items-center gap-3">
        {pushPermission !== 'granted' && (
          <button
            onClick={askPushPermission}
            className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold border-2',
              pushPermission === 'denied' ? 'bg-red-50 border-red-300 text-red-900'
                : 'bg-zinc-50 border-zinc-300 text-zinc-700')}
          >
            <BellOff className="h-4 w-4" />
            Push {pushPermission === 'denied' ? 'BLOCKIERT' : 'aktivieren'}
          </button>
        )}
        <div className="ml-auto flex items-center gap-3 text-xs text-zinc-600">
          {soundOn ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
              <Volume2 className="h-3.5 w-3.5" /> Ton an
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-zinc-500 font-bold">
              <VolumeX className="h-3.5 w-3.5" /> Ton aus
            </span>
          )}
          <span className="font-mono">
            {orders.length} offen
          </span>
        </div>
      </div>

      {/* FAHRER-LEISTE */}
      <div className="rounded-2xl border-2 border-zinc-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-zinc-700" />
          <h3 className="font-display font-black text-sm">Fahrer aktiv</h3>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
            {onlineDrivers.length} online
          </span>
          <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
            {fahrendeDriverIds.size} unterwegs
          </span>
          <span className="ml-auto text-xs font-bold text-zinc-600">
            {verfuegbareDrivers.length} verfügbar
          </span>
        </div>
        {drivers.length === 0 ? (
          <div className="text-xs text-zinc-500 italic">
            Noch keine Fahrer angelegt. <a href="/drivers" className="text-blue-700 underline font-bold">Fahrer hinzufügen →</a>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {drivers.map((d) => {
              const online = d.driver_status?.ist_online;
              const fahrend = fahrendeDriverIds.has(d.id);
              const Vehicle = VEHICLE_ICON[d.fahrzeug_praeferenz ?? 'bike'] ?? Bike;
              return (
                <div key={d.id}
                  className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border',
                    !online && 'bg-zinc-50 border-zinc-200 text-zinc-400',
                    online && !fahrend && 'bg-emerald-50 border-emerald-300 text-emerald-900',
                    online && fahrend && 'bg-orange-50 border-orange-300 text-orange-900')}
                >
                  <Vehicle className="h-3 w-3" />
                  {driverName(d)}
                  {fahrend && <Truck className="h-3 w-3 animate-pulse" />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BESTELLUNGEN */}
      {orders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
          <Bell className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
          <h3 className="font-display text-lg font-black text-zinc-700">Keine offenen Bestellungen</h3>
          <p className="text-sm text-zinc-500 mt-1">Sobald ein Kunde bestellt, erscheint hier eine Karte mit Ton-Signal.</p>
        </div>
      ) : (
        <div className={cn('grid grid-cols-1 gap-4',
          viewMode === 'kueche' ? 'lg:grid-cols-2' : 'lg:grid-cols-5')}>
          {(Object.keys(groupedByStatus) as Array<keyof typeof groupedByStatus>).map((statusKey) => (
            <div key={statusKey} className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-display font-black text-sm text-zinc-700 uppercase tracking-wider">
                  {STATUS_LABEL[statusKey]}
                </h3>
                <span className="text-xs font-bold text-zinc-500">{groupedByStatus[statusKey].length}</span>
              </div>
              {groupedByStatus[statusKey].map((o) => {
                const Icon = TYP_ICON[o.typ] ?? Package;
                const ageSec = Math.floor((now - new Date(o.bestellt_am).getTime()) / 1000);
                const isUrgent = o.status === 'neu' && ageSec > 60;
                const driver = o.fahrer_id ? driverById.get(o.fahrer_id) : undefined;
                const etaInfo = o.eta ? timeUntil(o.eta) : null;

                const escalation = (o.status === 'bestätigt' || o.status === 'in_zubereitung') ? escalationClass(o) : '';
                const headerBg =
                  o.status === 'neu' ? 'bg-amber-500 text-white' :
                  o.status === 'bestätigt' ? 'bg-blue-600 text-white' :
                  o.status === 'in_zubereitung' ? 'bg-orange-600 text-white' :
                  o.status === 'fertig' ? 'bg-emerald-600 text-white' :
                  o.status === 'unterwegs' ? 'bg-purple-600 text-white' :
                  'bg-zinc-700 text-white';
                return (
                  <div key={o.id} className={cn('rounded-3xl border-2 bg-white overflow-hidden shadow-md transition-all',
                    o.status === 'neu' && 'border-amber-500 ring-4 ring-amber-300/40 animate-[pulse_2s_ease-in-out_infinite]',
                    o.status === 'bestätigt' && 'border-blue-400',
                    o.status === 'in_zubereitung' && 'border-orange-400',
                    o.status === 'fertig' && 'border-emerald-400',
                    o.status === 'unterwegs' && 'border-purple-400',
                    isUrgent && 'border-red-500 ring-4 ring-red-400/60',
                    escalation)}
                  >
                    {/* WOLT-STYLE HEADER mit Status-Banner */}
                    <div className={cn('px-4 py-3 flex items-center gap-2', headerBg)}>
                      <Icon className="h-5 w-5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-black text-base leading-tight uppercase tracking-wide">
                          {STATUS_LABEL[o.status] ?? o.status}
                        </div>
                        <div className="text-[11px] opacity-90 font-mono">
                          #{o.bestellnummer} · {TYP_LABEL[o.typ]}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-display font-black text-lg leading-none">
                          {Number(o.gesamtbetrag).toFixed(2)}€
                        </div>
                        <div className="text-[10px] opacity-90 inline-flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />{timeAgo(o.bestellt_am)}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-display font-black text-xl leading-tight">{o.kunde_name}</div>
                          {o.kunde_telefon && (
                            <a href={`tel:${o.kunde_telefon}`} className="text-sm text-blue-700 inline-flex items-center gap-1 mt-0.5 font-medium">
                              <Phone className="h-3.5 w-3.5" />{o.kunde_telefon}
                            </a>
                          )}
                        </div>
                        <button
                          onClick={() => setChatOrder(o)}
                          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-matcha-700 text-white text-sm font-bold hover:bg-matcha-800 shadow active:scale-95"
                          aria-label="Chat mit Kunden"
                        >
                          <span aria-hidden>💬</span> Chat
                        </button>
                      </div>

                      {o.typ === 'lieferung' && o.kunde_adresse && (
                        <div className="text-xs text-zinc-700 leading-relaxed">
                          <MapPin className="h-3 w-3 inline mr-1 text-zinc-500" />
                          {o.kunde_adresse}, {o.kunde_plz} {o.kunde_stadt}
                        </div>
                      )}

                      {o.kunde_notiz && (
                        <div className="text-xs bg-yellow-50 border border-yellow-200 rounded-lg px-2 py-1.5 text-yellow-900">
                          📝 {o.kunde_notiz}
                        </div>
                      )}

                      {/* ITEMS — was muss gekocht werden */}
                      {o.order_items && o.order_items.length > 0 && (
                        <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-2 space-y-1">
                          {o.order_items.map((item) => (
                            <div key={item.id} className="text-sm">
                              <div className="flex items-baseline gap-2">
                                <span className="font-display font-black text-zinc-900 shrink-0">
                                  {item.menge}×
                                </span>
                                <span className="font-bold text-zinc-900 leading-tight">
                                  {item.name}
                                </span>
                              </div>
                              {Array.isArray(item.extras) && item.extras.length > 0 && (
                                <ul className="ml-7 text-xs text-zinc-600 leading-tight">
                                  {item.extras.map((ex, idx) => (
                                    <li key={idx}>+ {ex?.name ?? ''}</li>
                                  ))}
                                </ul>
                              )}
                              {item.notiz && (
                                <div className="ml-7 text-xs bg-yellow-100 text-yellow-900 rounded px-1.5 py-0.5 mt-0.5 font-bold">
                                  📝 {item.notiz}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="text-lg font-display font-black text-zinc-900">
                        {Number(o.gesamtbetrag).toFixed(2)} €
                      </div>

                      {/* ETA + FAHRER (immer sichtbar wenn gesetzt, editierbar wenn typ=lieferung) */}
                      {(o.typ === 'lieferung' || o.eta || driver) && (
                        <div className="space-y-1.5 pt-1.5 border-t border-zinc-100">
                          {/* ETA */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs">
                              <Clock className="h-3 w-3 text-zinc-500" />
                              {etaInfo ? (
                                <span className={cn('font-bold', etaInfo.overdue ? 'text-red-700' : 'text-zinc-900')}>
                                  ETA: {etaInfo.label}
                                </span>
                              ) : o.geschaetzte_lieferung_min ? (
                                <span className="font-bold text-zinc-900">{o.geschaetzte_lieferung_min} Min</span>
                              ) : (
                                <span className="text-zinc-400 italic">keine ETA</span>
                              )}
                            </div>
                            {o.typ === 'lieferung' && (
                              <button onClick={() => setEtaEditing(etaEditing === o.id ? null : o.id)}
                                className="text-[10px] font-bold text-blue-700 hover:underline">
                                {etaInfo ? 'ändern' : 'setzen'}
                              </button>
                            )}
                          </div>
                          {etaEditing === o.id && (
                            <div className="flex flex-wrap gap-1 bg-blue-50 p-1.5 rounded-lg">
                              {ETA_PRESETS.map((m) => (
                                <button key={m} onClick={() => setEta(o.id, m)} disabled={busy === o.id}
                                  className="px-2 py-1 rounded bg-white border border-blue-300 text-xs font-bold hover:bg-blue-100 disabled:opacity-50">
                                  {m} Min
                                </button>
                              ))}
                            </div>
                          )}

                          {/* FAHRER */}
                          {o.typ === 'lieferung' && (
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 text-xs">
                                <UserCheck className="h-3 w-3 text-zinc-500" />
                                {driver ? (
                                  <span className="font-bold text-purple-900">{driverName(driver)}</span>
                                ) : (
                                  <span className="text-zinc-400 italic">kein Fahrer</span>
                                )}
                              </div>
                              <button onClick={() => setDriverPickerFor(driverPickerFor === o.id ? null : o.id)}
                                className="text-[10px] font-bold text-blue-700 hover:underline">
                                {driver ? 'wechseln' : 'zuweisen'}
                              </button>
                            </div>
                          )}
                          {driverPickerFor === o.id && (
                            <div className="bg-blue-50 p-1.5 rounded-lg space-y-1">
                              {drivers.length === 0 ? (
                                <div className="text-[10px] text-zinc-600">Keine Fahrer vorhanden</div>
                              ) : (
                                drivers.map((d) => {
                                  const isOnline = d.driver_status?.ist_online;
                                  const isFahrend = fahrendeDriverIds.has(d.id);
                                  return (
                                    <button key={d.id} onClick={() => assignDriver(o.id, d.id)} disabled={busy === o.id}
                                      className={cn('w-full text-left px-2 py-1 rounded text-xs font-bold flex items-center gap-1.5 disabled:opacity-50',
                                        isOnline ? 'bg-white hover:bg-emerald-50' : 'bg-zinc-100 text-zinc-500')}>
                                      <span className={cn('h-1.5 w-1.5 rounded-full',
                                        isOnline && !isFahrend && 'bg-emerald-500',
                                        isOnline && isFahrend && 'bg-orange-500',
                                        !isOnline && 'bg-zinc-300')} />
                                      {driverName(d)}
                                      {isFahrend && <span className="text-[9px] text-orange-700">unterwegs</span>}
                                      {!isOnline && <span className="text-[9px] text-zinc-400">offline</span>}
                                    </button>
                                  );
                                })
                              )}
                              {driver && (
                                <button onClick={() => assignDriver(o.id, null)} disabled={busy === o.id}
                                  className="w-full text-left px-2 py-1 rounded text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
                                  ✕ Zuweisung entfernen
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* STATUS-BUTTONS */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {o.status === 'neu' && (
                          <>
                            <button onClick={() => setAcceptingOrder(o)} disabled={busy === o.id}
                              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-4 rounded-xl bg-emerald-600 text-white text-base font-black hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.97] shadow-lg shadow-emerald-600/30">
                              <Check className="h-5 w-5" />Annehmen
                            </button>
                            <button onClick={() => setRejectingOrder(o)} disabled={busy === o.id}
                              className="inline-flex items-center justify-center gap-2 px-3 py-4 rounded-xl border-2 border-red-300 text-red-700 text-base font-black hover:bg-red-50 disabled:opacity-50 active:scale-[0.97]">
                              <X className="h-5 w-5" />Ablehnen
                            </button>
                          </>
                        )}
                        {o.status === 'bestätigt' && (
                          <button onClick={() => setStatus(o.id, 'in_zubereitung')} disabled={busy === o.id}
                            className="w-full inline-flex items-center justify-center gap-1 px-3 py-3 rounded-xl bg-orange-600 text-white text-base font-black hover:bg-orange-700 disabled:opacity-50 active:scale-[0.97]">
                            <ChefHat className="h-3.5 w-3.5" />In Zubereitung
                          </button>
                        )}
                        {o.status === 'in_zubereitung' && (
                          <button onClick={() => setStatus(o.id, 'fertig')} disabled={busy === o.id}
                            className="w-full inline-flex items-center justify-center gap-1 px-3 py-3 rounded-xl bg-emerald-600 text-white text-base font-black hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.97]">
                            <Check className="h-3.5 w-3.5" />Fertig
                          </button>
                        )}
                        {o.status === 'fertig' && o.typ === 'lieferung' && (
                          <button onClick={() => setStatus(o.id, 'unterwegs')} disabled={busy === o.id || !o.fahrer_id}
                            title={!o.fahrer_id ? 'Erst Fahrer zuweisen' : ''}
                            className="w-full inline-flex items-center justify-center gap-1 px-3 py-3 rounded-xl bg-purple-600 text-white text-base font-black hover:bg-purple-700 disabled:opacity-50 active:scale-[0.97]">
                            <Truck className="h-3.5 w-3.5" />
                            {o.fahrer_id ? 'Fahrer unterwegs' : 'Erst Fahrer zuweisen'}
                          </button>
                        )}
                        {o.status === 'fertig' && o.typ === 'abholung' && (
                          <button onClick={() => setStatus(o.id, 'abgeholt')} disabled={busy === o.id}
                            className="w-full inline-flex items-center justify-center gap-1 px-3 py-3 rounded-xl bg-zinc-700 text-white text-base font-black hover:bg-zinc-800 disabled:opacity-50 active:scale-[0.97]">
                            <Package className="h-3.5 w-3.5" />Abgeholt
                          </button>
                        )}
                        {o.status === 'unterwegs' && (
                          <button onClick={() => setStatus(o.id, 'geliefert')} disabled={busy === o.id}
                            className="w-full inline-flex items-center justify-center gap-1 px-3 py-3 rounded-xl bg-zinc-700 text-white text-base font-black hover:bg-zinc-800 disabled:opacity-50 active:scale-[0.97]">
                            <Check className="h-3.5 w-3.5" />Geliefert
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {groupedByStatus[statusKey].length === 0 && (
                <div className="rounded-2xl border-2 border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-400">—</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Auto-Print-Modal bei neuer Bestellung ─── */}
      {printPreview && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-3">
          <div className="bg-white w-full max-w-md rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom">
            <div className="bg-amber-500 text-white px-5 py-3 flex items-center gap-3">
              <Bell className="h-5 w-5 animate-pulse" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Neue Bestellung</p>
                <p className="font-display text-lg font-black truncate">#{printPreview.bestellnummer} · {printPreview.kunde_name}</p>
              </div>
              <button onClick={() => setPrintPreview(null)} className="p-2 -mr-2 hover:bg-white/15 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 max-h-[40vh] overflow-y-auto bg-zinc-50">
              <div className="font-mono text-xs space-y-1">
                {(printPreview.order_items ?? []).map((it) => (
                  <div key={it.id} className="flex gap-2">
                    <span className="font-bold">{it.menge}×</span>
                    <span className="flex-1">{it.name}</span>
                    <span>{(Number(it.einzelpreis) * it.menge).toFixed(2)}€</span>
                  </div>
                ))}
                <div className="flex pt-2 mt-2 border-t font-black text-sm">
                  <span className="flex-1">SUMME</span>
                  <span>{Number(printPreview.gesamtbetrag).toFixed(2)}€</span>
                </div>
              </div>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2 bg-white border-t">
              <button onClick={() => { sendToStarPrinter(printPreview); setTimeout(() => setPrintPreview(null), 500); }}
                className="px-3 py-3 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 active:scale-[0.97]">
                ⭐️ Star drucken
              </button>
              <button onClick={() => { airPrint(printPreview); }}
                className="px-3 py-3 rounded-xl bg-zinc-200 text-zinc-800 font-bold hover:bg-zinc-300 active:scale-[0.97]">
                AirPrint
              </button>
            </div>
            <label className="flex items-center gap-2 px-4 py-2.5 bg-zinc-50 border-t text-xs cursor-pointer">
              <input type="checkbox" checked={autoStarPrint} onChange={toggleAutoStar} className="w-4 h-4" />
              <span className="flex-1 text-zinc-700">Bei jeder neuen Bestellung automatisch an Star senden</span>
            </label>
          </div>
        </div>
      )}

      {acceptingOrder && (
        <AcceptModal
          order={acceptingOrder}
          onCancel={() => setAcceptingOrder(null)}
          onConfirm={(min) => confirmAccept(acceptingOrder, min)}
        />
      )}

      {rejectingOrder && (
        <RejectModal
          order={rejectingOrder}
          onCancel={() => setRejectingOrder(null)}
          onConfirm={(reason) => confirmReject(rejectingOrder, reason)}
        />
      )}

      {chatOrder && (
        <ChatModal
          orderId={chatOrder.id}
          customerName={chatOrder.kunde_name}
          bestellnummer={chatOrder.bestellnummer}
          onClose={() => setChatOrder(null)}
        />
      )}

      {/* Wolt-Style Fullscreen-Takeover für die älteste unbearbeitete Bestellung */}
      {(() => {
        if (acceptingOrder || rejectingOrder) return null;
        const nextNew = orders
          .filter((o) => o.status === 'neu' && !dismissedNewIds.has(o.id))
          .sort((a, b) => new Date(a.bestellt_am).getTime() - new Date(b.bestellt_am).getTime())[0];
        if (!nextNew) return null;
        const queueCount = orders.filter((o) => o.status === 'neu').length;
        return (
          <NewOrderOverlay
            order={nextNew}
            queueCount={queueCount}
            onAccept={() => setAcceptingOrder(nextNew)}
            onReject={() => setRejectingOrder(nextNew)}
            onDismiss={() => setDismissedNewIds((prev) => new Set(prev).add(nextNew.id))}
          />
        );
      })()}
    </div>
  );
}

// ─── Modals ─────────────────────────────────────────────────────────

function AcceptModal({
  order, onCancel, onConfirm,
}: { order: Order; onCancel: () => void; onConfirm: (minutes: number) => void }) {
  const [custom, setCustom] = useState('');
  const presets = order.typ === 'lieferung' ? [25, 35, 45, 60, 75] : [10, 15, 20, 30, 45];
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm grid place-items-center p-4">
      <div className="bg-white rounded-3xl border-2 border-zinc-900 max-w-md w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl font-black">Bestellung annehmen</h3>
            <p className="text-sm text-zinc-600 mt-1">
              Wie lange dauert es bis {order.typ === 'lieferung' ? 'die Lieferung losgeht' : 'die Bestellung abholbereit ist'}?
            </p>
            <p className="text-xs text-zinc-500 mt-1.5">
              #{order.bestellnummer} · {order.kunde_name} · {Number(order.gesamtbetrag).toFixed(2)}€
            </p>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 h-9 w-9 rounded-full border-2 border-zinc-200 grid place-items-center hover:bg-zinc-50"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {presets.map((m) => (
            <button
              key={m}
              onClick={() => onConfirm(m)}
              className="px-3 py-4 rounded-2xl border-2 border-zinc-200 hover:border-emerald-500 hover:bg-emerald-50 active:scale-[0.97]"
            >
              <div className="font-display font-black text-2xl text-zinc-900">{m}</div>
              <div className="text-xs text-zinc-600 mt-0.5">Minuten</div>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border-2 border-zinc-200 p-3 flex items-center gap-2">
          <input
            type="number"
            min={5}
            max={180}
            placeholder="Eigene Zeit (Min)"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <button
            onClick={() => {
              const n = parseInt(custom, 10);
              if (Number.isFinite(n) && n >= 5 && n <= 180) onConfirm(n);
            }}
            disabled={!custom}
            className="px-4 py-2 rounded-lg bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-700 disabled:opacity-50"
          >
            Annehmen
          </button>
        </div>

        <p className="text-xs text-zinc-500 leading-relaxed">
          Der Kunde sieht die geschätzte Zeit sofort in der Live-Status-Ansicht
          und bekommt eine Push-Benachrichtigung.
        </p>
      </div>
    </div>
  );
}

const REJECT_REASONS = [
  { id: 'sold_out', label: 'Produkt ausverkauft' },
  { id: 'too_busy', label: 'Zu viele Bestellungen — überlastet' },
  { id: 'closing_soon', label: 'Kurz vor Ladenschluss' },
  { id: 'out_of_zone', label: 'Außerhalb Liefergebiet' },
  { id: 'address_unclear', label: 'Adresse nicht erreichbar' },
  { id: 'other', label: 'Anderer Grund' },
];

function RejectModal({
  order, onCancel, onConfirm,
}: { order: Order; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [freeText, setFreeText] = useState('');
  const labelForId = (id: string) => REJECT_REASONS.find((r) => r.id === id)?.label ?? id;
  const canSubmit = (selectedId && selectedId !== 'other') || (selectedId === 'other' && freeText.trim().length > 0);
  function submit() {
    if (!selectedId) return;
    const reason = selectedId === 'other' ? freeText.trim() : labelForId(selectedId);
    onConfirm(reason);
  }
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm grid place-items-center p-4">
      <div className="bg-white rounded-3xl border-2 border-zinc-900 max-w-md w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl font-black">Bestellung ablehnen</h3>
            <p className="text-sm text-zinc-600 mt-1">
              Wähle einen Grund — der Kunde wird informiert und bekommt sein Geld zurück.
            </p>
            <p className="text-xs text-zinc-500 mt-1.5">
              #{order.bestellnummer} · {order.kunde_name}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 h-9 w-9 rounded-full border-2 border-zinc-200 grid place-items-center hover:bg-zinc-50"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          {REJECT_REASONS.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={cn(
                'w-full text-left px-4 py-3 rounded-xl border-2 transition',
                selectedId === r.id
                  ? 'border-red-500 bg-red-50 text-red-900 font-bold'
                  : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {selectedId === 'other' && (
          <textarea
            placeholder="Bitte ausführen…"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl border-2 border-zinc-200 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 rounded-xl border-2 border-zinc-200 font-bold hover:bg-zinc-50"
          >
            Doch nicht
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-black hover:bg-red-700 disabled:opacity-50 shadow-lg shadow-red-600/30"
          >
            Ablehnen
          </button>
        </div>
      </div>
    </div>
  );
}
