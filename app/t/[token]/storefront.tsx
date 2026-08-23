'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { cn, euro } from '@/lib/utils';
import { contrastText, readableTextColor } from '@/lib/branding/contrast';
import { useModalDialog } from '@/lib/hooks/use-modal-dialog';
import { MiseItemSheet, makeCartLineId, type MiseItem, type Selections } from './item-sheet';
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChefHat,
  Clock3, CreditCard, Flame, Minus, Plus, Search, ShoppingBag,
  Utensils, Wallet, X,
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
type SuccessState = {
  number: string;
  method: 'bar' | 'karte';
  orderId: string;
  trackingToken: string;
  amountCents: number;
};
type PublicOrderStatus = { paymentStatus: string; orderStatus: string };

export function TableStorefront({
  table, tenant, location, categories, items, relations = [], orderToken,
}: {
  table: Table; tenant: Tenant; location: Location;
  categories: Category[]; items: MenuItem[];
  relations?: Relation[];
  orderToken?: string;
}) {
  const storageKey = `mise-table-cart:${orderToken ?? table.id}`;
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sheetItem, setSheetItem] = useState<MenuItem | null>(null);
  const [activeCat, setActiveCat] = useState<string>(categories[0]?.id ?? '');
  const [cartOpen, setCartOpen] = useState(false);
  const [crossSellOpen, setCrossSellOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [orderStatus, setOrderStatus] = useState<PublicOrderStatus | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [cartHydrated, setCartHydrated] = useState(false);
  const [pendingCrossSellId, setPendingCrossSellId] = useState<string | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const tischNummer = table.nummer;

  // Cross-Sell: Items, die zu den aktuell im Warenkorb liegenden passen (nicht selbst schon drin)
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return;
      const restored = parsed.flatMap((line: Partial<CartLine>) => {
        const current = line.item?.id ? itemMap.get(line.item.id) : null;
        const quantity = Number(line.qty);
        if (!current || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) return [];
        const extraPrice = Number.isFinite(Number(line.extraPrice)) ? Number(line.extraPrice) : 0;
        const displayName = typeof line.displayName === 'string' ? line.displayName.slice(0, 200) : current.name;
        return [{
          item: { ...current, name: displayName, preis: current.preis + extraPrice },
          qty: quantity,
          notiz: typeof line.notiz === 'string' ? line.notiz.slice(0, 500) : '',
          selections: line.selections && typeof line.selections === 'object' ? line.selections : {},
          extraPrice,
          displayName,
          cartLineId: typeof line.cartLineId === 'string' ? line.cartLineId : undefined,
        }];
      });
      setCart(restored);
    } catch {
      window.localStorage.removeItem(storageKey);
    } finally {
      setCartHydrated(true);
    }
  }, [itemMap, storageKey]);

  useEffect(() => {
    if (!cartHydrated) return;
    if (cart.length === 0) window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, JSON.stringify(cart));
  }, [cart, cartHydrated, storageKey]);

  useEffect(() => {
    if (!success?.orderId || !success.trackingToken) return;
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const refresh = async () => {
      try {
        const response = await fetch(
          `/api/order/status?id=${encodeURIComponent(success.orderId)}&token=${encodeURIComponent(success.trackingToken)}`,
          { cache: 'no-store' },
        );
        if (!response.ok) return;
        const next = await response.json() as PublicOrderStatus;
        if (active) setOrderStatus(next);
      } catch {
        // The status card keeps its last known state while the connection recovers.
      }
    };
    void refresh();
    timer = setInterval(refresh, 5_000);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [success]);

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
  const onPrimary = contrastText(primary);
  const onAccent = contrastText(accent);
  const primaryInk = readableTextColor(primary, '#ffffff');
  const accentOnPrimary = readableTextColor(accent, primary, onPrimary);

  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cart.reduce((s, l) => s + l.qty * l.item.preis, 0);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('de');
    if (!needle) return items;
    return items.filter((item) => [
      item.name,
      item.beschreibung ?? '',
      ...(item.tags ?? []),
      ...(item.allergene ?? []),
    ].join(' ').toLocaleLowerCase('de').includes(needle));
  }, [items, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const it of visibleItems) {
      const cid = it.category_id ?? 'other';
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid)!.push(it);
    }
    return map;
  }, [visibleItems]);

  function addItem(item: MenuItem, source: 'menu' | 'crosssell' = 'menu') {
    idempotencyKey.current = null;
    setOrderError(null);
    if (item.option_groups && Array.isArray(item.option_groups) && item.option_groups.length > 0) {
      setPendingCrossSellId(source === 'crosssell' ? item.id : null);
      setSheetItem(item);
      return false;
    }
    setCart((c) => {
      const existing = c.find((l) => l.item.id === item.id && !l.notiz && !l.cartLineId);
      if (existing) return c.map((l) => l === existing ? { ...l, qty: l.qty + 1 } : l);
      return [...c, { item, qty: 1, notiz: '' }];
    });
    return true;
  }
  function addConfiguredItem(input: { item: MenuItem; qty: number; selections: Selections; extraPrice: number; displayName: string; notiz: string }) {
    idempotencyKey.current = null;
    setOrderError(null);
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
    if (pendingCrossSellId === input.item.id) {
      setPendingCrossSellId(null);
      setCrossSellOpen(false);
      setPayOpen(true);
    }
  }
  function updateQty(idx: number, delta: number) {
    idempotencyKey.current = null;
    setOrderError(null);
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

  async function submitOrder(paymentMethod: 'bar' | 'karte') {
    if (!orderToken || table.id === 'preview') {
      setOrderError('Die Vorschau kann keine Bestellung auslösen.');
      return;
    }
    if (submitting || cart.length === 0) return;
    setOrderError(null);
    setSubmitting(true);
    const requestKey = idempotencyKey.current ?? crypto.randomUUID();
    idempotencyKey.current = requestKey;
    try {
      const response = await fetch('/api/order/table', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': requestKey,
        },
        body: JSON.stringify({
          token: orderToken,
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

      if (!result?.orderNumber || !result?.orderId || !result?.trackingToken) {
        throw new Error('Bestellbestätigung ist unvollständig');
      }
      setSuccess({
        number: result.orderNumber,
        method: paymentMethod,
        orderId: result.orderId,
        trackingToken: result.trackingToken,
        amountCents: Number(result.amountCents) || Math.round(cartTotal * 100),
      });
      setOrderStatus({ paymentStatus: 'pending_payment', orderStatus: 'wartet_auf_zahlung' });
      setCart([]);
      setCartOpen(false);
      setPayOpen(false);
      setCrossSellOpen(false);
      idempotencyKey.current = null;
    } catch (e) {
      setOrderError(e instanceof Error ? e.message : 'Fehler beim Bestellen');
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- Success Screen ---------- */
  if (success) {
    const paid = orderStatus?.paymentStatus === 'paid';
    const kitchenStarted = ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'abgeholt'].includes(
      orderStatus?.orderStatus ?? '',
    );
    const ready = ['fertig', 'abgeholt'].includes(orderStatus?.orderStatus ?? '');
    const headline = ready ? 'Deine Bestellung ist fertig' : paid ? 'Zahlung bestätigt' : 'Bestellung reserviert';
    const copy = ready
      ? `Wir bringen die Bestellung an Tisch ${tischNummer}.`
      : paid
        ? 'Die Küche hat deine Bestellung erhalten.'
        : `Bitte bezahle ${success.method === 'bar' ? 'bar' : 'mit Karte'} an der Kasse. Danach startet die Küche.`;

    return (
      <div className="min-h-screen px-4 py-8 sm:py-14" style={{ background: primary, color: onPrimary }}>
        <main className="mx-auto w-full max-w-md">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.22em] opacity-65">{tenant.name}</div>
              <div className="truncate text-sm font-bold opacity-80">{location.name}</div>
            </div>
            <div
              className="shrink-0 rounded-2xl px-4 py-2 text-center shadow-lg"
              style={{ background: accent, color: onAccent }}
            >
              <div className="text-[9px] font-black uppercase tracking-[0.2em]">Tisch</div>
              <div className="font-display text-2xl font-black leading-none">{tischNummer}</div>
            </div>
          </div>

          <section className="mt-10 text-center" aria-live="polite">
            <div
              className="mx-auto grid h-24 w-24 place-items-center rounded-full"
              style={{ background: accent, color: onAccent }}
            >
              {ready ? <CheckCircle2 className="h-12 w-12" /> : paid ? <ChefHat className="h-12 w-12" /> : <Wallet className="h-12 w-12" />}
            </div>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full motion-safe:animate-pulse" style={{ background: accent }} />
              Live-Status
            </div>
            <h1 className="mt-4 font-display text-4xl font-black leading-tight">{headline}</h1>
            <p className="mx-auto mt-3 max-w-sm text-base leading-relaxed opacity-80">{copy}</p>
          </section>

          <section className="mt-8 rounded-3xl border border-white/20 bg-white/10 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] opacity-60">Bestellnummer</div>
                <div className="mt-1 font-mono text-3xl font-black" style={{ color: accentOnPrimary }}>
                  #{success.number.replace('FF-', '')}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] opacity-60">Summe</div>
                <div className="font-display text-2xl font-black">{euro(success.amountCents / 100)}</div>
              </div>
            </div>

            <div className="mt-5 space-y-3 border-t border-white/15 pt-5">
              <StatusStep active done={paid} icon={CreditCard} label="An der Kasse bezahlen" />
              <StatusStep active={paid} done={kitchenStarted} icon={ChefHat} label="Küche bereitet zu" />
              <StatusStep active={kitchenStarted} done={ready} icon={Clock3} label="Kommt an deinen Tisch" />
            </div>
          </section>

          <button
            onClick={() => {
              setSuccess(null);
              setOrderStatus(null);
            }}
            className="mt-6 h-14 w-full rounded-2xl font-display text-lg font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
            style={{ background: accent, color: onAccent }}
          >
            Noch etwas bestellen
          </button>
        </main>
      </div>
    );
  }

  const heroImage = tenant.qr_hero_image_url ?? tenant.hero_image_url;

  return (
    <div data-testid="table-order-storefront" className="min-h-screen pb-32" style={{ background: '#fafaf5' }}>
      {/* ============ KOMPAKT HERO ============ */}
      <section className="relative overflow-hidden" style={{ background: primary, color: onPrimary }}>
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

        <div className="relative max-w-3xl mx-auto px-5 py-4">
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
                style={{ background: accent, color: onAccent }}
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
            <div
              className="shrink-0 rounded-2xl px-3 py-2 text-center shadow-lg"
              style={{ background: accent, color: onAccent }}
              aria-label={`Tisch ${tischNummer}`}
            >
              <div className="text-[8px] font-black uppercase tracking-[0.2em]">Tisch</div>
              <div className="font-display text-2xl font-black leading-none">{tischNummer}</div>
            </div>
          </div>
          <p className="mt-4 max-w-xl text-sm font-medium leading-relaxed opacity-80">
            {tenant.qr_welcome_text ?? 'Direkt am Tisch bestellen. Wir bringen alles zu dir.'}
          </p>
        </div>
      </section>

      {/* ============ SEARCH + CATEGORY TABS (sticky) ============ */}
      {categories.length > 0 && (
        <div className="sticky top-0 z-20 border-b bg-[#fafaf5]/95 backdrop-blur">
          <div className="mx-auto max-w-3xl px-5 pt-3">
            <label className="relative block">
              <span className="sr-only">Menü durchsuchen</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Wonach ist dir?"
                className="h-12 w-full rounded-2xl border border-stone-200 bg-white pl-12 pr-4 text-base font-semibold shadow-sm outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-300"
              />
            </label>
          </div>
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
                    'min-h-11 px-4 py-2 rounded-full text-sm font-bold transition shrink-0 border-2',
                    activeCat === c.id
                      ? 'border-transparent'
                      : 'bg-white text-foreground border-transparent hover:bg-muted',
                  )}
                  style={activeCat === c.id ? { background: primary, color: onPrimary } : undefined}
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

      {items.length > 0 && visibleItems.length === 0 && (
        <div className="mx-auto max-w-3xl px-5 py-12 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-stone-100">
            <Search className="h-7 w-7 text-stone-500" />
          </div>
          <h3 className="mt-4 font-display text-xl font-black">Nichts gefunden</h3>
          <p className="mt-2 text-sm text-muted-foreground">Probiere einen anderen Begriff oder wähle eine Kategorie.</p>
          <button onClick={() => setQuery('')} className="mt-4 min-h-11 rounded-full border px-5 text-sm font-bold">
            Suche zurücksetzen
          </button>
        </div>
      )}

      {/* ============ MENU ============ */}
      <main className="max-w-3xl mx-auto px-4 py-4 space-y-8">
        {categories.map((c) => {
          const catItems = grouped.get(c.id) ?? [];
          if (catItems.length === 0) return null;
          return (
            <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-20">
              <h2 className="font-display text-2xl font-black mb-3 px-1 flex items-center gap-2" style={{ color: primaryInk }}>
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
            style={{ background: primary, color: onPrimary }}
          >
            <div className="h-10 w-10 rounded-xl flex items-center justify-center font-black" style={{ background: accent, color: onAccent }}>
              {cartCount}
            </div>
            <span className="flex-1 text-left">
              <span className="block text-[10px] uppercase tracking-wider opacity-70">Warenkorb</span>
              <span className="block text-base">{tenant.qr_cta_label ?? 'Zur Bestellung'}</span>
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
          onAdd={(it) => addItem(it, 'crosssell')}
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
          error={orderError}
          onClose={() => setPayOpen(false)}
          onPay={submitOrder}
        />
      )}
      <MiseItemSheet
        item={sheetItem as MiseItem | null}
        primary={primary}
        accent={accent}
        onClose={() => {
          setSheetItem(null);
          setPendingCrossSellId(null);
        }}
        onAdd={(input) => addConfiguredItem({ ...input, item: input.item as MenuItem })}
      />
    </div>
  );
}

function StatusStep({
  active, done, icon: Icon, label,
}: {
  active: boolean;
  done: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', active || done ? 'opacity-100' : 'opacity-40')}>
      <div
        className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-full border',
          done ? 'border-transparent bg-white text-emerald-800' : 'border-white/30 bg-white/10',
        )}
      >
        {done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
      </div>
      <div className="flex-1 text-left text-sm font-bold">{label}</div>
      <div className="text-[10px] font-black uppercase tracking-wider">
        {done ? 'Erledigt' : active ? 'Aktuell' : 'Danach'}
      </div>
    </div>
  );
}

/* ============================================ Item Row ============================================ */

function ItemRow({
  item, onAdd, primary, accent, cart,
}: {
  item: MenuItem; onAdd: () => void; primary: string; accent: string; cart: CartLine[];
}) {
  const countInCart = cart.filter((l) => l.item.id === item.id).reduce((s, l) => s + l.qty, 0);
  const onPrimary = contrastText(primary);
  const onAccent = contrastText(accent);
  const primaryInk = readableTextColor(primary, '#ffffff');

  return (
    <button
      onClick={onAdd}
      className="group w-full flex gap-4 items-stretch bg-white rounded-3xl p-3 text-left hover:shadow-xl transition active:scale-[0.99] border border-transparent hover:border-matcha-100 relative"
    >
      {countInCart > 0 && (
        <div
          className="absolute -top-2 -right-2 z-10 h-7 min-w-7 px-2 rounded-full font-display font-bold text-sm flex items-center justify-center shadow-lg"
          style={{ background: accent, color: onAccent }}
        >
          {countInCart}×
        </div>
      )}
      {item.bild_url && (
        <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl overflow-hidden shrink-0 bg-muted relative">
          <Image src={item.bild_url} fill alt={item.name} className="object-cover" unoptimized />
          {item.beliebt && (
            <div className="absolute top-1 left-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase flex items-center gap-0.5" style={{ background: accent, color: onAccent }}>
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
          <div className="font-display text-lg font-black" style={{ color: primaryInk }}>
            {euro(item.preis)}
          </div>
          <div
            className="h-11 w-11 rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition"
            style={{ background: primary, color: onPrimary }}
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
  const dialogRef = useModalDialog<HTMLDivElement>(onClose);
  const onPrimary = contrastText(primary);
  const primaryInk = readableTextColor(primary, '#ffffff');

  return (
    <div
      className="fixed inset-0 z-40 grid items-end justify-center bg-black/70 animate-in fade-in sm:items-center"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-cart-title"
        tabIndex={-1}
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white animate-in slide-in-from-bottom sm:max-w-lg sm:rounded-3xl"
      >
        <header className="p-5 border-b flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Dein Warenkorb</div>
            <h2 id="table-cart-title" className="font-display text-2xl font-black">
              {cart.reduce((s, l) => s + l.qty, 0)} Artikel
            </h2>
          </div>
          <button aria-label="Warenkorb schließen" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full hover:bg-muted">
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
                <div className="text-sm font-display font-black mt-1" style={{ color: primaryInk }}>
                  {euro(l.qty * l.item.preis)}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1 bg-white rounded-2xl p-1 shadow-sm shrink-0">
                <button aria-label={`${l.item.name} erhöhen`} onClick={() => onUpdateQty(idx, 1)} className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: primary, color: onPrimary }}>
                  <Plus className="h-4 w-4" />
                </button>
                <span className="font-display font-bold w-5 text-center text-sm">{l.qty}</span>
                <button aria-label={`${l.item.name} reduzieren`} onClick={() => onUpdateQty(idx, -1)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted">
                  <Minus className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <footer className="p-5 border-t bg-muted/20">
          <div className="flex items-center justify-between mb-4">
            <span className="font-display font-bold text-base">Summe</span>
            <span className="font-display text-3xl font-black" style={{ color: primaryInk }}>{euro(total)}</span>
          </div>
          <button
            onClick={onProceed}
            className="w-full h-14 rounded-2xl font-display font-black text-lg inline-flex items-center justify-center gap-2 active:scale-[0.98] transition"
            style={{ background: primary, color: onPrimary }}
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
  onAdd: (item: MenuItem) => boolean;
  onClose: () => void;
  onSkip: () => void;
}) {
  const [added, setAdded] = useState<Set<string>>(new Set());
  const dialogRef = useModalDialog<HTMLDivElement>(onClose);
  const onPrimary = contrastText(primary);
  const onAccent = contrastText(accent);
  const primaryInk = readableTextColor(primary, '#ffffff');

  function handleAdd(item: MenuItem) {
    if (onAdd(item)) {
      setAdded((s) => new Set(s).add(item.id));
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 grid items-end justify-center bg-black/80 animate-in fade-in sm:items-center"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cross-sell-title"
        tabIndex={-1}
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white animate-in slide-in-from-bottom sm:max-w-lg sm:rounded-3xl"
      >
        <header className="p-5 border-b flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 mb-1.5" style={{ background: accent, color: onAccent }}>
              <Flame className="h-3 w-3" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Passt dazu</span>
            </div>
            <h2 id="cross-sell-title" className="font-display text-2xl font-black leading-tight">
              Willst du noch was?
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">Was andere Gäste gerne dazu bestellen.</p>
          </div>
          <button aria-label="Empfehlungen schließen" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-muted">
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
                  <div className="absolute top-2 right-2 z-10 h-7 w-7 rounded-full grid place-items-center" style={{ background: accent, color: onAccent }}>
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
                    <div className="font-display text-sm font-black" style={{ color: primaryInk }}>
                      {euro(it.preis)}
                    </div>
                    {!isAdded && (
                      <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ background: primary, color: onPrimary }}>
                        <Plus className="h-3.5 w-3.5" />
                      </div>
                    )}
                    {isAdded && (
                      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: primaryInk }}>
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
            style={{ background: primary, color: onPrimary }}
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
  total, tischNummer, primary, accent, submitting, error, onClose, onPay,
}: {
  total: number; tischNummer: string; primary: string; accent: string; submitting: boolean;
  error: string | null;
  onClose: () => void; onPay: (m: 'bar' | 'karte') => void;
}) {
  const dialogRef = useModalDialog<HTMLDivElement>(onClose);
  const onAccent = contrastText(accent);
  const primaryInk = readableTextColor(primary, '#ffffff');

  return (
    <div
      className="fixed inset-0 z-50 grid items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-title"
        tabIndex={-1}
        className="w-full rounded-t-3xl bg-white p-6 animate-in slide-in-from-bottom sm:max-w-md sm:rounded-3xl"
      >
        <header className="flex items-center justify-between mb-2">
          <button onClick={onClose} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Zurück
          </button>
          <button aria-label="Zahlung schließen" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="text-center my-5">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-3" style={{ background: accent, color: onAccent }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Tisch</span>
            <span className="font-display font-black">{tischNummer}</span>
          </div>
          <h2 id="payment-title" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gesamtbetrag</h2>
          <div className="font-display text-5xl font-black mt-1" style={{ color: primaryInk }}>{euro(total)}</div>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => onPay('karte')}
            disabled={submitting}
            className="w-full h-14 rounded-2xl font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60 border-2"
            style={{ borderColor: primaryInk, color: primaryInk, background: 'white' }}
          >
            <CreditCard className="h-4 w-4" /> Vorn an der Kasse zahlen (Karte)
          </button>

          <button
            onClick={() => onPay('bar')}
            disabled={submitting}
            className="w-full h-14 rounded-2xl bg-muted text-foreground font-bold inline-flex items-center justify-center gap-2 hover:bg-muted/70 disabled:opacity-60 border-2 border-transparent"
          >
            <Wallet className="h-4 w-4" /> Vorn an der Kasse zahlen (Bar)
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[11px] text-amber-900 leading-relaxed">
          <strong>Hinweis:</strong> Du zahlst die Bestellung vorn an der Kasse. Erst nach der Zahlung wird sie verbindlich an die Küche übergeben.
        </div>
      </div>
    </div>
  );
}
