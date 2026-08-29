'use client';

import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { cn, euro } from '@/lib/utils';
import { MiseItemSheet, makeCartLineId, type MiseItem, type Selections } from './item-sheet';
import {
  ArrowLeft, ArrowRight, Bell, Check, CreditCard, Flame,
  Minus, Plus, ReceiptText, ShoppingBag, Utensils, Wallet, X,
} from 'lucide-react';

type Table = { id: string; nummer: string; name: string | null; bereich: string | null; tenant_id: string; location_id: string };
type Tenant = { name: string; slug: string; logo_url: string | null; hero_image_url: string | null; storefront_theme_id: string | null; theme_primary: string | null; theme_accent: string | null; qr_logo_url?: string | null; qr_hero_image_url?: string | null; qr_theme_primary?: string | null; qr_theme_accent?: string | null; qr_welcome_text?: string | null; qr_cta_label?: string | null };
type Location = { name: string; adresse: string | null; stadt: string | null; plz: string | null };
type Category = { id: string; name: string; icon: string | null; sort_order: number };
type MenuItem = {
  id: string;
  name: string;
  beschreibung: string | null;
  preis: number;
  bild_url: string | null;
  category_id: string | null;
  beliebt: boolean;
  allergene: string[] | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extras: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  option_groups?: any[] | null;
  tags?: string[] | null;
};

type CartLine = { item: MenuItem; qty: number; notiz: string; selections?: Selections; extraPrice?: number; displayName?: string; cartLineId?: string };
type Relation = { item_id: string; related_item_id: string; typ: 'crosssell' | 'upsell'; sort_order: number };

export function TableStorefront({
  table, tenant, location, categories, items, relations = [], qrToken, universalOrderToken, onlinePaymentEnabled = false,
}: {
  table: Table; tenant: Tenant; location: Location;
  categories: Category[]; items: MenuItem[];
  relations?: Relation[];
  qrToken?: string;
  universalOrderToken?: string;
  onlinePaymentEnabled?: boolean;
}) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sheetItem, setSheetItem] = useState<MenuItem | null>(null);
  const [activeCat, setActiveCat] = useState<string>(categories[0]?.id ?? '');
  const [cartOpen, setCartOpen] = useState(false);
  const [crossSellOpen, setCrossSellOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionState, setSessionState] = useState<'starting' | 'ready' | 'pending_confirmation' | 'error'>('starting');
  const [sessionMessage, setSessionMessage] = useState('Sichere Tischsitzung wird gestartet …');
  const [serviceOpen, setServiceOpen] = useState(false);
  const [serviceNotice, setServiceNotice] = useState('');
  const [success, setSuccess] = useState<{
    number: string;
    method: 'service' | 'online';
    orderId: string;
    trackingToken: string;
  } | null>(null);
  const [liveOrderStatus, setLiveOrderStatus] = useState('neu');
  const tischNummer = table.nummer;

  useEffect(() => {
    if ((!qrToken && !universalOrderToken) || table.id === 'preview') {
      setSessionState('error');
      setSessionMessage('Die Vorschau kann keine Tischsitzung starten.');
      return;
    }
    let cancelled = false;
    fetch('/api/order/table/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(qrToken
        ? { qrToken }
        : { universalToken: universalOrderToken, tableId: table.id }),
    }).then(async (response) => {
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? 'Tischsitzung konnte nicht gestartet werden.');
      if (cancelled) return;
      if (result.status === 'wartet_auf_bestaetigung') {
        setSessionState('pending_confirmation');
        setSessionMessage('Der Service bestätigt deinen Tisch gleich.');
      } else {
        setSessionState('ready');
        setSessionMessage('Tisch sicher erkannt.');
      }
    }).catch((error) => {
      if (cancelled) return;
      setSessionState('error');
      setSessionMessage(error instanceof Error ? error.message : 'Tischsitzung fehlgeschlagen.');
    });
    return () => { cancelled = true; };
  }, [qrToken, universalOrderToken, table.id]);

  useEffect(() => {
    if (!success?.orderId || !success.trackingToken) return;
    let cancelled = false;
    const poll = async () => {
      const response = await fetch(`/api/order/status?id=${encodeURIComponent(success.orderId)}&token=${encodeURIComponent(success.trackingToken)}`, { cache: 'no-store' });
      const result = await response.json().catch(() => null);
      if (!cancelled && response.ok && result?.orderStatus) setLiveOrderStatus(result.orderStatus);
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 8_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [success]);

  // Cross-Sell: Items, die zu den aktuell im Warenkorb liegenden passen (nicht selbst schon drin)
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const crossSellItems = useMemo(() => {
    if (cart.length === 0) return [];
    const cartIds = new Set(cart.map((l) => l.item.id));
    const suggestions = new Map<string, MenuItem>();
    for (const c of cart) {
      for (const r of relations) {
        if (r.item_id === c.item.id && !cartIds.has(r.related_item_id)) {
          const it = itemMap.get(r.related_item_id);
          if (it && !suggestions.has(it.id)) suggestions.set(it.id, it);
        }
      }
    }
    return Array.from(suggestions.values()).slice(0, 4);
  }, [cart, relations, itemMap]);

  const primary = tenant.qr_theme_primary ?? tenant.theme_primary ?? '#14532d';
  const accent = tenant.qr_theme_accent ?? tenant.theme_accent ?? '#4ae68a';

  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cart.reduce((s, l) => s + l.qty * l.item.preis, 0);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const it of items) {
      const cid = it.category_id ?? 'other';
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid)!.push(it);
    }
    return map;
  }, [items]);

  function addItem(item: MenuItem) {
    if (item.option_groups && Array.isArray(item.option_groups) && item.option_groups.length > 0) {
      setSheetItem(item);
      return;
    }
    setCart((c) => {
      const existing = c.find((l) => l.item.id === item.id && !l.notiz && !l.cartLineId);
      if (existing) return c.map((l) => l === existing ? { ...l, qty: l.qty + 1 } : l);
      return [...c, { item, qty: 1, notiz: '' }];
    });
  }
  function addConfiguredItem(input: { item: MenuItem; qty: number; selections: Selections; extraPrice: number; displayName: string; notiz: string }) {
    const cartLineId = makeCartLineId(input.item.id, input.selections);
    setCart((c) => {
      const existing = c.find((l) => l.cartLineId === cartLineId);
      if (existing) return c.map((l) => l === existing ? { ...l, qty: l.qty + input.qty } : l);
      return [...c, {
        item: { ...input.item, name: input.displayName, preis: input.item.preis + input.extraPrice },
        qty: input.qty,
        notiz: input.notiz,
        selections: input.selections,
        extraPrice: input.extraPrice,
        displayName: input.displayName,
        cartLineId,
      }];
    });
  }
  function updateQty(idx: number, delta: number) {
    setCart((c) => {
      const next = [...c];
      const line = next[idx];
      if (!line) return c;
      const newQty = line.qty + delta;
      if (newQty <= 0) next.splice(idx, 1);
      else next[idx] = { ...line, qty: newQty };
      return next;
    });
  }

  async function submitOrder(paymentMethod: 'service' | 'online') {
    if (sessionState !== 'ready' || table.id === 'preview') {
      alert('Die Vorschau kann keine Bestellung auslösen.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/order/table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: table.id,
          paymentMethod,
          items: cart.map((line) => ({
            id: line.item.id,
            qty: line.qty,
            selections: line.selections ?? {},
            note: line.notiz,
          })),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? 'Bestellung fehlgeschlagen');

      if (result?.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      if (!result?.orderNumber || !result?.orderId || !result?.trackingToken) throw new Error('Bestellbestätigung unvollständig');
      setLiveOrderStatus('neu');
      setSuccess({
        number: result.orderNumber,
        method: paymentMethod,
        orderId: result.orderId,
        trackingToken: result.trackingToken,
      });
      setCart([]);
      setCartOpen(false);
      setPayOpen(false);
      setCrossSellOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Fehler beim Bestellen');
    } finally {
      setSubmitting(false);
    }
  }

  async function sendServiceRequest(requestType: 'service' | 'rechnung' | 'bezahlen' | 'besteck' | 'problem') {
    setServiceNotice('');
    try {
      const response = await fetch('/api/order/table/service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: table.id, requestType, orderId: success?.orderId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? 'Anfrage konnte nicht gesendet werden.');
      setServiceNotice('Der Service wurde informiert.');
    } catch (error) {
      setServiceNotice(error instanceof Error ? error.message : 'Serviceanfrage fehlgeschlagen.');
    }
  }

  /* ---------- Success Screen ---------- */
  if (success) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: primary, color: 'white' }}>
        <div className="flex-1 grid place-items-center p-6">
          <div className="max-w-md w-full text-center">
            <>
                <div className="mx-auto h-24 w-24 rounded-full flex items-center justify-center mb-6" style={{ background: accent }}>
                  <Wallet className="h-12 w-12" style={{ color: primary }} />
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur border border-white/20 px-4 py-1.5 mb-4 text-xs font-bold uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: accent }} />
                  {success.method === 'service' ? 'Bezahlung beim Service' : 'Online bezahlt'}
                </div>
                <h1 className="font-display text-4xl font-black mb-3 leading-tight">Fast geschafft!</h1>
                <p className="text-lg opacity-90 leading-relaxed">
                  Deine Bestellung ist eingegangen. {success.method === 'service' ? 'Du kannst bequem beim Service bezahlen.' : 'Die Zahlung wird gerade bestätigt.'}
                </p>
                <p className="mt-3 text-sm opacity-75 leading-relaxed">
                  Sie bleibt vollständig Tisch {tischNummer} zugeordnet und wird an die passenden Stationen verteilt.
                </p>

                <div className="mt-6 rounded-3xl bg-white/10 backdrop-blur border-2 border-white/20 p-5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-70 mb-1">Zeig das an der Kasse</div>
                  <div className="font-mono font-black text-4xl" style={{ color: accent }}>
                    #{success.number.replace('FF-', '')}
                  </div>
                  <div className="mt-2 text-xs opacity-80">Tisch <strong>{tischNummer}</strong></div>
                  <div className="mt-3 rounded-full bg-black/15 px-3 py-2 text-xs font-bold">Status: {orderStatusLabel(liveOrderStatus)}</div>
                </div>

                <button
                  onClick={() => setServiceOpen(true)}
                  className="mt-8 w-full h-14 rounded-2xl font-display font-bold text-lg"
                  style={{ background: accent, color: primary }}
                >
                  Service oder Rechnung anfordern
                </button>
            </>
          </div>
        </div>
        {serviceOpen && (
          <ServiceSheet
            primary={primary}
            notice={serviceNotice}
            onClose={() => setServiceOpen(false)}
            onRequest={sendServiceRequest}
          />
        )}
      </div>
    );
  }

  const heroImage = tenant.qr_hero_image_url ?? tenant.hero_image_url;

  return (
    <div className="min-h-screen pb-32" style={{ background: '#fafaf5' }}>
      {/* ============ KOMPAKT HERO ============ */}
      <section className="relative overflow-hidden" style={{ background: primary }}>
        {/* Animated blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-16 -right-16 h-48 w-48 rounded-full blur-3xl opacity-30"
            style={{ background: accent }}
          />
        </div>

        {/* Hero-Image subtiles Overlay */}
        {heroImage && (
          <div className="absolute inset-0 opacity-20 mix-blend-overlay">
            <Image src={heroImage} alt="" fill priority className="object-cover" unoptimized />
          </div>
        )}

        <div className="relative max-w-3xl mx-auto px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            {(tenant.qr_logo_url ?? tenant.logo_url) ? (
              <Image
                src={tenant.qr_logo_url ?? tenant.logo_url ?? ''}
                width={44}
                height={44}
                alt={tenant.name}
                className="rounded-xl shadow-lg ring-2 ring-white/20 shrink-0"
                unoptimized
              />
            ) : (
              <div
                className="h-11 w-11 rounded-xl flex items-center justify-center font-display font-black text-lg shadow-lg ring-2 ring-white/20 shrink-0"
                style={{ background: accent, color: primary }}
              >
                {tenant.name[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-xl sm:text-2xl font-black leading-tight truncate">{tenant.name}</h1>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider opacity-70 mt-0.5">
                <span className="truncate">{location.stadt || location.name}</span>
                <span className="h-1 w-1 rounded-full opacity-50" style={{ background: accent }} />
                <span className="inline-flex items-center gap-1 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: accent }} />
                  Live
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-5 pt-4">
        <div className={cn(
          'rounded-2xl border px-4 py-3 text-sm font-semibold',
          sessionState === 'ready' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
          sessionState === 'pending_confirmation' && 'border-amber-200 bg-amber-50 text-amber-950',
          sessionState === 'starting' && 'border-slate-200 bg-white text-slate-600',
          sessionState === 'error' && 'border-red-200 bg-red-50 text-red-900',
        )} role={sessionState === 'error' ? 'alert' : 'status'}>
          {sessionMessage}
        </div>
      </div>

      {/* ============ CATEGORY TABS (sticky) ============ */}
      {categories.length > 0 && (
        <div className="sticky top-0 z-20 bg-[#fafaf5]/95 backdrop-blur border-b mt-6">
          <div className="max-w-3xl mx-auto overflow-x-auto">
            <div className="flex gap-1 px-5 py-2 whitespace-nowrap">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveCat(c.id);
                    document.getElementById(`cat-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-bold transition shrink-0 border-2',
                    activeCat === c.id
                      ? 'text-white border-transparent'
                      : 'bg-white text-foreground border-transparent hover:bg-muted',
                  )}
                  style={activeCat === c.id ? { background: primary } : undefined}
                >
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============ EMPTY MENU ============ */}
      {items.length === 0 && (
        <div className="max-w-3xl mx-auto px-5 py-12 text-center">
          <div className="h-16 w-16 mx-auto rounded-3xl bg-muted grid place-items-center mb-4">
            <Utensils className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="font-display text-xl font-bold">Menü wird noch vorbereitet</h3>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
            Das Restaurant hat noch keine Produkte freigegeben. Bitte sprich einen Mitarbeiter an.
          </p>
        </div>
      )}

      {/* ============ MENU ============ */}
      <main className="max-w-3xl mx-auto px-4 py-4 space-y-8">
        {categories.map((c) => {
          const catItems = grouped.get(c.id) ?? [];
          if (catItems.length === 0) return null;
          return (
            <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-20">
              <h2 className="font-display text-2xl font-black mb-3 px-1 flex items-center gap-2" style={{ color: primary }}>
                <span className="text-3xl">{c.icon}</span> {c.name}
              </h2>
              <div className="grid gap-3">
                {catItems.map((it) => (
                  <ItemRow key={it.id} item={it} onAdd={() => addItem(it)} primary={primary} accent={accent} cart={cart} />
                ))}
              </div>
            </section>
          );
        })}
      </main>

      {/* ============ STICKY CART BUTTON ============ */}
      {cartCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-30">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full h-16 rounded-3xl shadow-2xl flex items-center gap-3 px-5 font-display font-bold active:scale-[0.98] transition"
            style={{ background: primary, color: 'white' }}
          >
            <div className="h-10 w-10 rounded-xl flex items-center justify-center font-black" style={{ background: accent, color: primary }}>
              {cartCount}
            </div>
            <span className="flex-1 text-left">
              <span className="block text-[10px] uppercase tracking-wider opacity-70">Warenkorb</span>
              <span className="block text-base">Zur Bestellung</span>
            </span>
            <span className="text-xl font-black">{euro(cartTotal)}</span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* ============ CART DRAWER ============ */}
      {cartOpen && !crossSellOpen && !payOpen && (
        <CartDrawer
          cart={cart}
          total={cartTotal}
          primary={primary}
          onClose={() => setCartOpen(false)}
          onUpdateQty={updateQty}
          onProceed={() => {
            if (crossSellItems.length > 0) setCrossSellOpen(true);
            else setPayOpen(true);
          }}
        />
      )}

      {/* ============ CROSS-SELL ============ */}
      {crossSellOpen && !payOpen && (
        <CrossSellSheet
          suggestions={crossSellItems}
          primary={primary}
          accent={accent}
          onAdd={(it) => addItem(it)}
          onClose={() => setCrossSellOpen(false)}
          onSkip={() => {
            setCrossSellOpen(false);
            setPayOpen(true);
          }}
        />
      )}

      {/* ============ PAYMENT SHEET ============ */}
      {payOpen && (
        <PaymentSheet
          total={cartTotal}
          tischNummer={tischNummer}
          primary={primary}
          accent={accent}
          submitting={submitting}
          onlinePaymentEnabled={onlinePaymentEnabled}
          onClose={() => setPayOpen(false)}
          onPay={submitOrder}
        />
      )}
      <MiseItemSheet
        item={sheetItem as MiseItem | null}
        primary={primary}
        accent={accent}
        onClose={() => setSheetItem(null)}
        onAdd={(input) => addConfiguredItem({ ...input, item: input.item as MenuItem })}
      />
      <button
        type="button"
        onClick={() => setServiceOpen(true)}
        disabled={sessionState === 'starting' || sessionState === 'error'}
        className="fixed right-4 top-20 z-30 inline-flex h-11 items-center gap-2 rounded-full border border-white/30 bg-white/95 px-4 text-sm font-bold shadow-lg backdrop-blur disabled:opacity-50"
        style={{ color: primary }}
      >
        <Bell className="h-4 w-4" /> Service
      </button>
      {serviceOpen && (
        <ServiceSheet
          primary={primary}
          notice={serviceNotice}
          onClose={() => setServiceOpen(false)}
          onRequest={sendServiceRequest}
        />
      )}
    </div>
  );
}

function orderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    wartet_auf_zahlung: 'Zahlung wird erwartet', neu: 'Eingegangen', 'bestätigt': 'Bestätigt',
    in_zubereitung: 'In Vorbereitung', teilweise_fertig: 'Teilweise fertig', fertig: 'Fertig',
    abholbereit: 'Abholbereit', wird_serviert: 'Wird serviert', serviert: 'Serviert',
    bezahlt: 'Bezahlt', abgeschlossen: 'Abgeschlossen', storniert: 'Storniert',
  };
  return labels[status] ?? status;
}

/* ============================================ Item Row ============================================ */

function ItemRow({
  item, onAdd, primary, accent, cart,
}: {
  item: MenuItem; onAdd: () => void; primary: string; accent: string; cart: CartLine[];
}) {
  const countInCart = cart.filter((l) => l.item.id === item.id).reduce((s, l) => s + l.qty, 0);

  return (
    <button
      onClick={onAdd}
      className="group w-full flex gap-4 items-stretch bg-white rounded-3xl p-3 text-left hover:shadow-xl transition active:scale-[0.99] border border-transparent hover:border-matcha-100 relative"
    >
      {countInCart > 0 && (
        <div
          className="absolute -top-2 -right-2 z-10 h-7 min-w-7 px-2 rounded-full font-display font-bold text-sm flex items-center justify-center shadow-lg"
          style={{ background: accent, color: primary }}
        >
          {countInCart}×
        </div>
      )}
      {item.bild_url && (
        <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl overflow-hidden shrink-0 bg-muted relative">
          <Image src={item.bild_url} fill alt={item.name} className="object-cover" unoptimized />
          {item.beliebt && (
            <div className="absolute top-1 left-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase flex items-center gap-0.5" style={{ background: accent, color: primary }}>
              <Flame className="h-2.5 w-2.5" /> Beliebt
            </div>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="font-display text-base sm:text-lg font-bold leading-tight">{item.name}</div>
        {item.beschreibung && (
          <div className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2 leading-snug">{item.beschreibung}</div>
        )}
        {item.allergene && item.allergene.length > 0 && (
          <div className="mt-1 text-[10px] text-muted-foreground">
            Enthält: {item.allergene.join(', ')}
          </div>
        )}
        <div className="mt-auto pt-2 flex items-center justify-between">
          <div className="font-display text-lg font-black" style={{ color: primary }}>
            {euro(item.preis)}
          </div>
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition"
            style={{ background: primary, color: 'white' }}
          >
            <Plus className="h-5 w-5" />
          </div>
        </div>
      </div>
    </button>
  );
}

/* ============================================ Cart Drawer ============================================ */

function CartDrawer({
  cart, total, primary, onClose, onUpdateQty, onProceed,
}: {
  cart: CartLine[]; total: number; primary: string;
  onClose: () => void; onUpdateQty: (i: number, d: number) => void; onProceed: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-black/70 grid items-end sm:items-center justify-center animate-in fade-in">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom">
        <header className="p-5 border-b flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Dein Warenkorb</div>
            <h2 className="font-display text-2xl font-black">
              {cart.reduce((s, l) => s + l.qty, 0)} {cart.reduce((s, l) => s + l.qty, 0) === 1 ? 'Artikel' : 'Artikel'}
            </h2>
          </div>
          <button onClick={onClose} className="h-10 w-10 rounded-full hover:bg-muted grid place-items-center">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto opacity-30 mb-2" />
              Warenkorb ist leer
            </div>
          )}
          {cart.map((l, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-muted/40 rounded-2xl p-3">
              {l.item.bild_url ? (
                <div className="relative h-16 w-16 rounded-xl overflow-hidden bg-muted shrink-0">
                  <Image src={l.item.bild_url} fill alt={l.item.name} className="object-cover" unoptimized />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center text-2xl shrink-0">🍽</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold leading-tight truncate">{l.item.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {euro(l.item.preis)} · {l.qty}×
                </div>
                {l.notiz && <div className="text-xs italic text-orange-700 mt-0.5 truncate">„{l.notiz}"</div>}
                <div className="text-sm font-display font-black mt-1" style={{ color: primary }}>
                  {euro(l.qty * l.item.preis)}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1 bg-white rounded-2xl p-1 shadow-sm shrink-0">
                <button onClick={() => onUpdateQty(idx, 1)} className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: primary, color: 'white' }}>
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <span className="font-display font-bold w-5 text-center text-sm">{l.qty}</span>
                <button onClick={() => onUpdateQty(idx, -1)} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center">
                  <Minus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <footer className="p-5 border-t bg-muted/20">
          <div className="flex items-center justify-between mb-4">
            <span className="font-display font-bold text-base">Summe</span>
            <span className="font-display text-3xl font-black" style={{ color: primary }}>{euro(total)}</span>
          </div>
          <button
            onClick={onProceed}
            className="w-full h-14 rounded-2xl font-display font-black text-lg inline-flex items-center justify-center gap-2 active:scale-[0.98] transition"
            style={{ background: primary, color: 'white' }}
          >
            Weiter zur Zahlung <ArrowRight className="h-5 w-5" />
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ============================================ Cross-Sell Sheet ============================================ */

function CrossSellSheet({
  suggestions, primary, accent, onAdd, onClose, onSkip,
}: {
  suggestions: MenuItem[];
  primary: string;
  accent: string;
  onAdd: (item: MenuItem) => void;
  onClose: () => void;
  onSkip: () => void;
}) {
  const [added, setAdded] = useState<Set<string>>(new Set());

  function handleAdd(item: MenuItem) {
    onAdd(item);
    setAdded((s) => new Set(s).add(item.id));
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/80 grid items-end sm:items-center justify-center animate-in fade-in">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom">
        <header className="p-5 border-b flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 mb-1.5" style={{ background: accent, color: primary }}>
              <Flame className="h-3 w-3" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Passt dazu</span>
            </div>
            <h2 className="font-display text-2xl font-black leading-tight">
              Willst du noch was?
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">Was andere Gäste gerne dazu bestellen.</p>
          </div>
          <button onClick={onClose} className="h-10 w-10 rounded-full hover:bg-muted grid place-items-center shrink-0">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3">
          {suggestions.map((it) => {
            const isAdded = added.has(it.id);
            return (
              <button
                key={it.id}
                onClick={() => !isAdded && handleAdd(it)}
                disabled={isAdded}
                className={cn(
                  'group relative rounded-2xl overflow-hidden text-left border-2 bg-white transition active:scale-[0.98]',
                  isAdded ? 'border-matcha-500 bg-matcha-50' : 'border-transparent hover:border-matcha-100 hover:shadow-lg',
                )}
              >
                {isAdded && (
                  <div className="absolute top-2 right-2 z-10 h-7 w-7 rounded-full grid place-items-center" style={{ background: accent, color: primary }}>
                    <Check className="h-4 w-4" />
                  </div>
                )}
                {it.bild_url ? (
                  <div className="relative aspect-square bg-muted">
                    <Image src={it.bild_url} fill alt={it.name} className="object-cover" unoptimized />
                  </div>
                ) : (
                  <div className="aspect-square bg-muted flex items-center justify-center text-4xl">
                    🍽
                  </div>
                )}
                <div className="p-3">
                  <div className="font-display text-sm font-bold leading-tight line-clamp-2">{it.name}</div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <div className="font-display text-sm font-black" style={{ color: primary }}>
                      {euro(it.preis)}
                    </div>
                    {!isAdded && (
                      <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ background: primary, color: 'white' }}>
                        <Plus className="h-3.5 w-3.5" />
                      </div>
                    )}
                    {isAdded && (
                      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: primary }}>
                        ✓ Dazu
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <footer className="p-5 border-t">
          <button
            onClick={onSkip}
            className="w-full h-14 rounded-2xl font-display font-black text-lg inline-flex items-center justify-center gap-2 active:scale-[0.98] transition"
            style={{ background: primary, color: 'white' }}
          >
            {added.size > 0 ? 'Perfekt, weiter' : 'Nein danke, weiter'}
            <ArrowRight className="h-5 w-5" />
          </button>
          <div className="mt-2 text-[11px] text-center text-muted-foreground">
            Du kannst jederzeit zurück und nochmal ergänzen.
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ============================================ Payment Sheet ============================================ */

function PaymentSheet({
  total, tischNummer, primary, accent, submitting, onlinePaymentEnabled, onClose, onPay,
}: {
  total: number; tischNummer: string; primary: string; accent: string; submitting: boolean;
  onlinePaymentEnabled: boolean;
  onClose: () => void; onPay: (m: 'service' | 'online') => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 grid items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 animate-in slide-in-from-bottom">
        <header className="flex items-center justify-between mb-2">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Zurück
          </button>
          <button onClick={onClose} className="h-9 w-9 rounded-full hover:bg-muted grid place-items-center">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="text-center my-5">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-3" style={{ background: accent, color: primary }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Tisch</span>
            <span className="font-display font-black">{tischNummer}</span>
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gesamtbetrag</div>
          <div className="font-display text-5xl font-black mt-1" style={{ color: primary }}>{euro(total)}</div>
        </div>

        <div className="space-y-2">
          {onlinePaymentEnabled && <button
            onClick={() => onPay('online')}
            disabled={submitting}
            className="w-full h-14 rounded-2xl font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60 border-2"
            style={{ borderColor: primary, color: primary, background: 'white' }}
          >
            <CreditCard className="h-4 w-4" /> Jetzt sicher online bezahlen
          </button>}

          <button
            onClick={() => onPay('service')}
            disabled={submitting}
            className="w-full h-14 rounded-2xl bg-muted text-foreground font-bold inline-flex items-center justify-center gap-2 hover:bg-muted/70 disabled:opacity-60 border-2 border-transparent"
          >
            <Wallet className="h-4 w-4" /> Beim Service bezahlen
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[11px] text-amber-900 leading-relaxed">
          <strong>Hinweis:</strong> Bei „Beim Service bezahlen“ geht die Bestellung direkt ein und bleibt bis zur Bezahlung als offen markiert.
        </div>
      </div>
    </div>
  );
}

function ServiceSheet({
  primary, notice, onClose, onRequest,
}: {
  primary: string;
  notice: string;
  onClose: () => void;
  onRequest: (type: 'service' | 'rechnung' | 'bezahlen' | 'besteck' | 'problem') => void;
}) {
  const actions = [
    ['service', 'Service rufen', Bell],
    ['rechnung', 'Rechnung anfordern', ReceiptText],
    ['bezahlen', 'Bezahlen', CreditCard],
    ['besteck', 'Besteck anfordern', Utensils],
    ['problem', 'Problem melden', Bell],
  ] as const;
  return (
    <div className="fixed inset-0 z-[60] grid items-end bg-black/70 sm:items-center sm:justify-center">
      <div className="w-full rounded-t-3xl bg-white p-5 sm:max-w-md sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <div><div className="text-xs font-bold uppercase tracking-wider text-slate-400">Tischservice</div><h2 className="mt-1 text-2xl font-black">Wie können wir helfen?</h2></div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        {notice && <div className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold" role="status">{notice}</div>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          {actions.map(([type,label,Icon]) => (
            <button key={type} onClick={() => onRequest(type)} className="flex min-h-24 flex-col items-start justify-between rounded-2xl border border-slate-200 p-4 text-left font-bold hover:bg-slate-50">
              <Icon className="h-5 w-5" style={{ color: primary }} /><span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
