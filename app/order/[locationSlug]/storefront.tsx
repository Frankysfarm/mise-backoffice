'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import { toastError } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { Clock, Zap, X } from 'lucide-react';

import { Hero } from './components/hero';
import { LanguageSwitcher } from './components/language-switcher';
import { StickyCategoryBar } from './components/sticky-category-bar';
import { PopularCarousel } from './components/popular-carousel';
import { MenuItemCard } from './components/menu-item-card';
import { CartSidebar } from './components/cart-sidebar';
import { CartFab } from './components/cart-fab';
import { CheckoutSheet } from './components/checkout-sheet';
import { ItemDetailModal } from './components/item-detail-modal';
import { SuccessState } from './components/success-state';
import type {
  CartItem,
  Category,
  CheckoutForm,
  Location,
  MenuItem,
  OrderType,
  SelectedExtras,
} from './components/types';
import { UpsellPopup } from './components/upsell-popup';
import { DELIVERY_FEE } from './components/types';

type Props = {
  location: Location;
  categories: Category[];
  items: MenuItem[];
  paymentMethods?: {
    method: string;
    label: string | null;
    enabled_lieferung: boolean;
    enabled_abholung: boolean;
    enabled_vor_ort: boolean;
  }[];
  themeId?: string;
  heroImageUrl?: string | null;
  logoUrl?: string | null;
  locale?: 'de' | 'en' | 'tr' | 'ar';
  deliveryTimeMin?: number;
  minOrder?: number;
  tenantDeliveryFee?: number;
};

export function Storefront({ location, categories, items, paymentMethods = [], themeId = 'classic', heroImageUrl = null, logoUrl = null, locale = 'de', deliveryTimeMin = 35, minOrder = 12, tenantDeliveryFee = 0 }: Props) {
  /* ---------------- state ---------------- */
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [orderType, setOrderType] = React.useState<OrderType>('abholung');
  const [checkoutOpen, setCheckoutOpen] = React.useState(false);
  const [cartSheetOpen, setCartSheetOpen] = React.useState(false);
  const [ordering, setOrdering] = React.useState(false);
  const [orderSuccess, setOrderSuccess] = React.useState<{
    bestellnummer: string;
    name: string;
    eta: number;
    type: OrderType;
    orderId: string;
  } | null>(null);

  const [activeSectionId, setActiveSectionId] = React.useState<string | null>(null);

  const [detailItem, setDetailItem] = React.useState<MenuItem | null>(null);
  const [detailNotiz, setDetailNotiz] = React.useState('');

  // Voucher-Code aus URL auto-einlösen (z.B. ?code=THX-ABC123 vom Bon-QR)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;
    // Storage für späteren Checkout
    try {
      sessionStorage.setItem(`pending_voucher:${location.id}`, code);
    } catch {}
  }, [location.id]);

  /* ---------------- search + filter ---------------- */
  const [search, setSearch] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'beliebt' | 'vegan' | 'under10'>('all');

  const filteredItems = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((i) => {
      if (needle) {
        const hay = `${i.name} ${i.beschreibung ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (activeFilter === 'beliebt' && !i.beliebt) return false;
      if (activeFilter === 'vegan' && !(i.tags ?? []).includes('vegan')) return false;
      if (activeFilter === 'under10' && i.preis >= 10) return false;
      return true;
    });
  }, [items, search, activeFilter]);

  /* ---------------- derived ---------------- */
  const popular = React.useMemo(() => filteredItems.filter((i) => i.beliebt), [filteredItems]);

  const categoryMap = React.useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  const itemsByCategory = React.useMemo(() => {
    const m = new Map<string, MenuItem[]>();
    for (const cat of categories) {
      m.set(
        cat.id,
        filteredItems.filter((i) => i.category_id === cat.id),
      );
    }
    return m;
  }, [categories, filteredItems]);

  const totalItems = React.useMemo(() => cart.reduce((s, c) => s + c.qty, 0), [cart]);
  const subtotal = React.useMemo(
    () => cart.reduce((s, c) => s + c.qty * (c.item.preis + (c.extra_preis ?? 0)), 0),
    [cart],
  );
  // Voucher-State
  const [voucher, setVoucher] = React.useState<{ voucher_id: string; code: string; typ: string; rabatt: number; beschreibung: string | null } | null>(null);
  // Delivery Credit State
  const [deliveryCredit, setDeliveryCredit] = React.useState<{ token: string; amountEur: number } | null>(null);
  const deliveryFeeBase = orderType === 'lieferung' ? DELIVERY_FEE : 0;
  const deliveryFee = voucher?.typ === 'gratis_lieferung' && orderType === 'lieferung' ? 0 : deliveryFeeBase;
  const voucherRabatt = voucher?.typ !== 'gratis_lieferung' ? (voucher?.rabatt ?? 0) : 0;
  const creditDiscount = deliveryCredit?.amountEur ?? 0;
  const total = Math.max(0, subtotal + deliveryFee - voucherRabatt - creditDiscount);

  const getCategory = React.useCallback(
    (id: string | null) => (id ? categoryMap.get(id) : undefined),
    [categoryMap],
  );

  /* ---------------- cart ---------------- */
  const [upsellFor, setUpsellFor] = React.useState<MenuItem | null>(null);

  const addToCart = React.useCallback((item: MenuItem) => {
    setCart((c) => {
      const ex = c.find((x) => x.item.id === item.id && !x.extras);
      if (ex) return c.map((x) => (x.item.id === item.id && !x.extras ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { item, qty: 1, lineId: item.id }];
    });
    // Upsell-Vorschlag wenn das Item verwandte Artikel hat
    setUpsellFor(item);
  }, []);

  const addItemWithExtras = React.useCallback((item: MenuItem, qty: number, extras: SelectedExtras, notiz: string, extraPreis: number) => {
    // Hash der Extras-Wahl — gleiche Wahl = selbe Cart-Line
    const extraHash = JSON.stringify(extras) + '|' + notiz;
    const lineId = `${item.id}::${extraHash}`;

    setCart((c) => {
      const existing = c.find((x) => x.lineId === lineId);
      if (existing) {
        return c.map((x) => (x.lineId === lineId ? { ...x, qty: x.qty + qty } : x));
      }
      return [...c, { item, qty, lineId, extras, notiz, extra_preis: extraPreis }];
    });
    setUpsellFor(item);
  }, []);

  const addById = React.useCallback(
    (id: string) => {
      const it = items.find((i) => i.id === id);
      if (it) addToCart(it);
    },
    [items, addToCart],
  );

  const removeFromCart = React.useCallback((itemId: string) => {
    setCart((c) =>
      c.map((x) => (x.item.id === itemId ? { ...x, qty: x.qty - 1 } : x)).filter((x) => x.qty > 0),
    );
  }, []);

  const deleteFromCart = React.useCallback((itemId: string) => {
    setCart((c) => c.filter((x) => x.item.id !== itemId));
  }, []);

  const getQty = React.useCallback(
    (itemId: string) => cart.find((c) => c.item.id === itemId)?.qty ?? 0,
    [cart],
  );

  /* ---------------- IntersectionObserver for sticky bar ---------------- */
  const sectionRefs = React.useRef<Map<string, HTMLElement>>(new Map());

  const registerSection = React.useCallback((id: string) => (el: HTMLElement | null) => {
    if (el) sectionRefs.current.set(id, el);
    else sectionRefs.current.delete(id);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to the top (most visible above fold).
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          const id = (visible[0].target as HTMLElement).id;
          if (id) setActiveSectionId(id);
        }
      },
      { rootMargin: '-120px 0px -55% 0px', threshold: [0, 0.2, 0.6] },
    );
    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [categories.length, popular.length]);

  const scrollToSection = React.useCallback((id: string) => {
    const el = sectionRefs.current.get(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, []);

  /* ---------------- detail modal ---------------- */
  const openDetail = React.useCallback((item: MenuItem) => {
    setDetailItem(item);
    setDetailNotiz('');
  }, []);
  const closeDetail = React.useCallback(() => setDetailItem(null), []);

  /* ---------------- submit ---------------- */
  async function placeOrder(form: CheckoutForm) {
    setOrdering(true);
    try {
      const sb = createClient();
      const eta = Math.max(10, cart.length * 3);
      const { data: order, error } = await sb
        .from('customer_orders')
        .insert({
          location_id: location.id,
          typ: orderType,
          kunde_name: form.name,
          kunde_telefon: form.telefon,
          kunde_email: form.email ?? null,
          kunde_adresse: form.adresse ?? null,
          kunde_plz: form.plz ?? null,
          kunde_stadt: form.stadt ?? null,
          kunde_lat: form.lat ?? null,
          kunde_lng: form.lng ?? null,
          kunde_etage: form.etage ?? null,
          kunde_tuer_code: form.tuercode ?? null,
          kunde_lieferhinweis: form.lieferhinweis ?? null,
          kunde_notiz: form.lieferhinweis ?? null,
          zwischensumme: subtotal,
          liefergebuehr: deliveryFee,
          gesamtbetrag: total,
          geschaetzte_zubereitung_min: eta,
          zahlungsart: form.zahlungsart,
          voucher_code: voucher?.code ?? null,
          voucher_rabatt: voucherRabatt + (voucher?.typ === 'gratis_lieferung' ? deliveryFeeBase : 0),
          marketing_optin: form.marketing_optin ?? false,
        })
        .select('id,bestellnummer')
        .single();
      if (error) throw error;

      await sb.from('order_items').insert(
        cart.map((c) => ({
          order_id: order.id,
          menu_item_id: c.item.id,
          name: c.item.name,
          menge: c.qty,
          einzelpreis: c.item.preis + (c.extra_preis ?? 0),
          extras: c.extras ? { selections: c.extras, extra_preis: c.extra_preis ?? 0 } : [],
          notiz: c.notiz ?? null,
        })),
      );

      // Voucher-Einlösung bestätigen
      if (voucher) {
        await sb.rpc('confirm_voucher_redemption', {
          p_voucher_id: voucher.voucher_id,
          p_order_id: order.id,
          p_rabatt: voucherRabatt + (voucher.typ === 'gratis_lieferung' ? deliveryFeeBase : 0),
          p_kunde_email: form.email ?? null,
          p_kunde_telefon: form.telefon ?? null,
        });
        try { sessionStorage.removeItem(`pending_voucher:${location.id}`); } catch {}
      }

      // Delivery Credit einlösen (fire-and-forget — kein Fatal wenn es fehlschlägt)
      if (deliveryCredit) {
        void fetch(`/api/delivery/credits/${deliveryCredit.token}/redeem`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: order.id, location_id: location.id }),
        }).catch(() => null);
      }

      // Wenn Online-Zahlung: Stripe-Checkout-Session erstellen + Redirect
      if (form.zahlungsart === 'online' && total > 0) {
        try {
          const res = await fetch('/api/checkout/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: order.id }),
          });
          const json = await res.json();
          if (res.ok && json.url) {
            window.location.href = json.url;
            return;
          }
          // Fallback: Order bleibt bestehen, zeige Fehler + trotzdem Success (als Reservierung)
          toastError('Online-Zahlung nicht möglich', json.error ?? 'Bitte im Laden oder beim Fahrer bezahlen');
        } catch (e) {
          toastError('Stripe-Fehler', e instanceof Error ? e.message : 'Bitte vor Ort bezahlen');
        }
      }

      setOrderSuccess({
        bestellnummer: order.bestellnummer,
        name: form.name,
        eta,
        type: orderType,
        orderId: order.id,
      });
      setCart([]);
      setCheckoutOpen(false);
      setCartSheetOpen(false);

      // Bestellbestätigungs-Email asynchron triggern (fire-and-forget)
      if (form.email) {
        void fetch('/api/email/process-outbox', { method: 'POST' }).catch(() => {});
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unbekannter Fehler';
      toastError('Bestellung fehlgeschlagen', message);
    } finally {
      setOrdering(false);
    }
  }

  /* ---------------- success screen ---------------- */
  if (orderSuccess) {
    return (
      <SuccessState
        bestellnummer={orderSuccess.bestellnummer}
        name={orderSuccess.name}
        etaMinutes={orderSuccess.eta}
        isDelivery={orderSuccess.type === 'lieferung'}
        onNewOrder={() => setOrderSuccess(null)}
        orderId={orderSuccess.orderId}
      />
    );
  }

  /* ---------------- main ---------------- */
  return (
    <div data-storefront-theme={themeId} dir={locale === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-surface storefront-root">
      {/* Skip to content */}
      <a
        href="#menu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-matcha-900 focus:px-4 focus:py-2 focus:text-sm focus:text-matcha-50"
      >
        Direkt zur Speisekarte
      </a>

      {/* Sprache-Switcher oben rechts (auf Hero) */}
      <div className="absolute top-4 right-4 z-40">
        <LanguageSwitcher current={locale} />
      </div>

      <Hero
        location={location}
        orderType={orderType}
        onOrderType={setOrderType}
        popularCount={popular.length}
        itemCount={items.length}
        themeId={themeId as 'classic' | 'bold' | 'minimal' | 'farmhouse' | 'urban' | 'aurora'}
        deliveryTimeMin={deliveryTimeMin}
        minOrder={minOrder}
        deliveryFee={tenantDeliveryFee}
        heroImageUrl={heroImageUrl}
        logoUrl={logoUrl}
      />

      {/* Live-Lieferzeit-Indikator */}
      {orderType === 'lieferung' && (
        <LiveEtaBar locationId={location.id} baseEtaMin={deliveryTimeMin} />
      )}

      {/* Quick-Jump: Kategorie-Buttons oben, damit Kunden nicht scrollen müssen */}
      <div className="bg-surface border-b border-matcha-900/5">
        <div className="mx-auto max-w-6xl px-4 py-3 md:px-8">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {popular.length > 0 && (
              <button
                onClick={() => scrollToSection('beliebt')}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-matcha-900 px-4 py-2 text-xs font-bold text-matcha-50 shadow-sm transition active:scale-95"
              >
                <span>⭐</span> Beliebt
              </button>
            )}
            {categories.map((cat) => {
              const catItems = itemsByCategory.get(cat.id) ?? [];
              if (catItems.length === 0) return null;
              return (
                <button
                  key={cat.id}
                  onClick={() => scrollToSection(cat.id)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-matcha-50 px-4 py-2 text-xs font-bold text-matcha-900 transition hover:bg-matcha-100 active:scale-95"
                >
                  {cat.icon && <span>{cat.icon}</span>}
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <StickyCategoryBar
        categories={categories}
        hasPopular={popular.length > 0}
        activeId={activeSectionId}
        onJump={scrollToSection}
        totalItems={totalItems}
        totalPrice={total}
        onOpenCart={() => setCartSheetOpen(true)}
        themeId={themeId as any}
      />

      <main id="menu" className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="lg:flex lg:gap-10">
          <div className="flex-1">
            {/* Search + Filter */}
            <div className="sticky top-12 z-20 -mx-4 bg-white/95 px-4 py-2 backdrop-blur md:top-16 md:-mx-8 md:px-8">
              <div className="relative">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Suche Cappuccino, Matcha, …"
                  className="h-10 w-full rounded-xl border border-matcha-900/10 bg-white px-3 pl-9 pr-4 text-[13px] sm:text-sm text-matcha-900 placeholder:text-matcha-900/40 focus:border-matcha-700 focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                <svg className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-matcha-900/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
                </svg>
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-matcha-900/10 text-xs font-bold text-matcha-900"
                    aria-label="Suche löschen"
                  >×</button>
                )}
              </div>
              {/* Quick Filters */}
              <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {[
                  { id: 'all',     label: 'Alle',         emoji: '🍽️' },
                  { id: 'beliebt', label: 'Beliebt',      emoji: '⭐' },
                  { id: 'vegan',   label: 'Vegan',        emoji: '🌱' },
                  { id: 'under10', label: 'Unter 10 €',  emoji: '💶' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id as any)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95',
                      activeFilter === f.id
                        ? 'bg-matcha-900 text-accent shadow-sm'
                        : 'bg-matcha-50 text-matcha-900 hover:bg-matcha-100',
                    )}
                  >
                    <span>{f.emoji}</span>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* No results */}
            {filteredItems.length === 0 && (search || activeFilter !== 'all') && (
              <div className="rounded-3xl bg-matcha-50 p-8 text-center">
                <div className="text-4xl mb-2">🔍</div>
                <div className="font-display text-lg font-bold text-matcha-900">Nichts gefunden</div>
                <div className="mt-1 text-sm text-matcha-900/60">
                  Andere Suche oder Filter entfernen.
                </div>
                <button
                  onClick={() => { setSearch(''); setActiveFilter('all'); }}
                  className="mt-4 inline-flex h-10 items-center rounded-full bg-matcha-900 px-4 text-sm font-bold text-matcha-50"
                >
                  Alle zeigen
                </button>
              </div>
            )}

            {/* Popular */}
            {popular.length > 0 && (
              <section
                id="beliebt"
                ref={registerSection('beliebt')}
                className="scroll-mt-20"
              >
                <PopularCarousel themeId={themeId as any}
                  items={popular}
                  getCategory={getCategory}
                  getQty={getQty}
                  onAdd={addToCart}
                  onRemove={removeFromCart}
                  onOpenDetail={openDetail}
                />
              </section>
            )}

            {/* Category sections */}
            {categories.map((cat) => {
              const catItems = itemsByCategory.get(cat.id) ?? [];
              if (catItems.length === 0) return null;
              return (
                <section
                  key={cat.id}
                  id={cat.id}
                  ref={registerSection(cat.id)}
                  className="scroll-mt-20 py-8 md:py-12"
                >
                  <div className="mb-6 flex items-end justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-600">
                        <span className="text-base leading-none">{cat.icon}</span>
                        Kategorie
                      </div>
                      <h2 className="mt-1 font-display text-3xl font-bold tracking-[-0.02em] text-matcha-900 md:text-4xl">
                        {cat.name}
                      </h2>
                      <p className="mt-1 text-sm text-matcha-800/60">
                        {categoryDescription(cat.name)}
                      </p>
                    </div>
                    <div className="hidden text-xs text-matcha-800/50 md:block">
                      {catItems.length} {catItems.length === 1 ? 'Gericht' : 'Gerichte'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-4 md:gap-x-4 lg:grid-cols-3">
                    {catItems.map((item) => (
                      <MenuItemCard
                        key={item.id}
                        item={item}
                        category={cat}
                        qty={getQty(item.id)}
                        onAdd={() => addToCart(item)}
                        onRemove={() => removeFromCart(item.id)}
                        onOpenDetail={() => openDetail(item)}
                        themeId={themeId as any}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {/* Footer spacer */}
            <div className="h-24 lg:h-16" />

            {/* Location footer */}
            <footer className="mb-24 rounded-3xl bg-matcha-900 p-8 text-matcha-50 md:p-12 lg:mb-16">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-300">Besuch uns</div>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] md:text-4xl">
                {location.name}
              </h2>
              <p className="mt-3 text-matcha-200">
                {[location.adresse, location.plz, location.stadt].filter(Boolean).join(', ')}
              </p>
              {location.telefon && (
                <a
                  href={`tel:${location.telefon}`}
                  className="mt-1 inline-block font-mono text-sm text-matcha-100 underline underline-offset-4"
                >
                  {location.telefon}
                </a>
              )}

              {/* Rechtliches — Pflichtangaben */}
              <div className="mt-8 pt-6 border-t border-matcha-700 flex flex-wrap gap-x-6 gap-y-2 text-xs text-matcha-300">
                <a href={`/legal/impressum`} className="hover:text-accent underline-offset-4 hover:underline">Impressum</a>
                <a href={`/legal/datenschutz`} className="hover:text-accent underline-offset-4 hover:underline">Datenschutz</a>
                <a href={`/legal/agb`} className="hover:text-accent underline-offset-4 hover:underline">AGB & Widerruf</a>
                <a href={`/legal/allergene`} className="hover:text-accent underline-offset-4 hover:underline">Allergene & Zusatzstoffe</a>
              </div>
              <div className="mt-3 text-[10px] text-matcha-400 leading-relaxed">
                {location.name} · Alle Preise inkl. MwSt.
              </div>
            </footer>
          </div>

          {/* Desktop cart */}
          <CartSidebar
            cart={cart}
            orderType={orderType}
            totalItems={totalItems}
            subtotal={subtotal}
            total={total}
            getCategory={getCategory}
            onAdd={addById}
            onRemove={removeFromCart}
            onDelete={deleteFromCart}
            onCheckout={() => setCheckoutOpen(true)}
            onBrowse={() => scrollToSection(popular.length > 0 ? 'beliebt' : categories[0]?.id ?? '')}
            variant="desktop"
          />
        </div>
      </main>

      {/* Mobile FAB + sheet */}
      <CartFab
        totalItems={totalItems}
        total={total}
        visible={totalItems > 0 && !cartSheetOpen && !checkoutOpen && !detailItem}
        onClick={() => setCartSheetOpen(true)}
        themeId={themeId as any}
      />

      {/* Mobile cart bottom sheet */}
      {cartSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-matcha-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setCartSheetOpen(false)}
        >
          <div
            className={cn(
              'w-full overflow-hidden rounded-t-3xl bg-surface shadow-strong',
              'motion-safe:animate-in motion-safe:slide-in-from-bottom-8 motion-safe:duration-300',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <CartSidebar
              cart={cart}
              orderType={orderType}
              totalItems={totalItems}
              subtotal={subtotal}
              total={total}
              getCategory={getCategory}
              onAdd={addById}
              onRemove={removeFromCart}
              onDelete={deleteFromCart}
              onCheckout={() => {
                setCartSheetOpen(false);
                setCheckoutOpen(true);
              }}
              onBrowse={() => {
                setCartSheetOpen(false);
                scrollToSection(popular.length > 0 ? 'beliebt' : categories[0]?.id ?? '');
              }}
              onClose={() => setCartSheetOpen(false)}
              variant="sheet"
            />
          </div>
        </div>
      )}

      {/* Upsell-Popup nach Add-to-Cart */}
      <UpsellPopup
        forItem={upsellFor}
        onClose={() => setUpsellFor(null)}
        onAdd={(item) => addToCart(item)}
      />

      {/* Detail modal mit Optionen */}
      <ItemDetailModal
        item={detailItem}
        qty={detailItem ? getQty(detailItem.id) : 0}
        onClose={closeDetail}
        onAddToCart={(qty, extras, notiz, extraPreis) => {
          if (!detailItem) return;
          addItemWithExtras(detailItem, qty, extras, notiz, extraPreis);
          closeDetail();
        }}
      />

      {/* Checkout */}
      <CheckoutSheet
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        orderType={orderType}
        total={total}
        loading={ordering}
        onSubmit={placeOrder}
        locationCoords={cityFallbackCoords(location.stadt)}
        defaultCity={location.stadt ?? ''}
        paymentMethods={paymentMethods}
        locationId={location.id}
        subtotal={subtotal}
        voucher={voucher}
        onVoucherChange={setVoucher}
        deliveryCredit={deliveryCredit}
        onDeliveryCreditChange={setDeliveryCredit}
      />

      {/* Hidden unused import suppression (keeps lint happy when X not used elsewhere). */}
      <span className="hidden">
        <X aria-hidden />
      </span>
    </div>
  );
}

/**
 * Ohne lat/lng-Spalten auf `locations` nutzen wir Stadt-Fallback-Koordinaten
 * zum Biasing der Adress-Suche und zum Liefer-Radius-Check.
 * Sobald `locations` eigene Koordinaten hat, kommt das weg.
 */
function cityFallbackCoords(city: string | null): { lat: number; lng: number } | null {
  if (!city) return null;
  const c = city.toLowerCase();
  const map: Record<string, { lat: number; lng: number }> = {
    aachen: { lat: 50.7753, lng: 6.0839 },
    berlin: { lat: 52.5200, lng: 13.4050 },
    mannheim: { lat: 49.4875, lng: 8.4660 },
    koeln: { lat: 50.9375, lng: 6.9603 },
    köln: { lat: 50.9375, lng: 6.9603 },
    hamburg: { lat: 53.5511, lng: 9.9937 },
    muenchen: { lat: 48.1351, lng: 11.5820 },
    münchen: { lat: 48.1351, lng: 11.5820 },
    frankfurt: { lat: 50.1109, lng: 8.6821 },
  };
  for (const key of Object.keys(map)) {
    if (c.includes(key)) return map[key];
  }
  return null;
}

function categoryDescription(name: string): string {
  const n = name.toLowerCase();
  if (/heiß|heiss|hot/.test(n)) return 'Frisch aufgebrüht — unsere Handwerkskunst in der Tasse.';
  if (/kalt|iced|cold/.test(n)) return 'Mit Eis und Liebe — erfrischend für jede Jahreszeit.';
  if (/food/.test(n)) return 'Hausgemacht, ehrlich und mit den besten Zutaten.';
  if (/special/.test(n)) return 'Unsere Signatures — Limited Editions und Saisongäste.';
  return 'Unsere Auswahl, sorgfältig kuratiert.';
}

/* ------------------------------ LiveEtaBar ------------------------------ */

type EtaLoad = 'quiet' | 'normal' | 'busy';

function LiveEtaBar({ locationId, baseEtaMin }: { locationId: string; baseEtaMin: number }) {
  const [etaMin, setEtaMin] = React.useState<number>(baseEtaMin);
  const [load, setLoad] = React.useState<EtaLoad>('normal');
  const [activeCount, setActiveCount] = React.useState<number | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/eta/live?location_id=${locationId}`);
        if (!res.ok || cancelled) return;
        const d = await res.json();
        if (cancelled) return;
        setEtaMin(d.eta_min ?? baseEtaMin);
        setLoad(d.load ?? 'normal');
        if (d.active_orders != null) setActiveCount(d.active_orders);
        setLoaded(true);
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 60_000);
    // Tick every 30s for countdown refresh
    const tickIv = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => { cancelled = true; clearInterval(iv); clearInterval(tickIv); };
  }, [locationId, baseEtaMin]);

  if (!loaded) return null;

  const meta = {
    quiet:  { dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50 border-green-200',   label: 'Küche frei',          emoji: '✨' },
    normal: { dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200',   label: 'Normale Auslastung',  emoji: '👌' },
    busy:   { dot: 'bg-red-500',   text: 'text-red-700',   bg: 'bg-red-50 border-red-200',       label: 'Hohe Auslastung',     emoji: '🔥' },
  }[load];

  // ETA range: +/- 5 min
  const etaFrom = Math.max(10, etaMin - 5);
  const etaTo   = etaMin + 5;

  // Load bar: map etaMin to a 0-100 scale (20min = 0%, 60min = 100%)
  const barPct = Math.min(100, Math.max(0, Math.round(((etaMin - 20) / 40) * 100)));
  const barColor =
    load === 'quiet' ? 'bg-green-400' :
    load === 'normal' ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8 mt-3">
      <div className={cn('rounded-xl border px-4 py-3', meta.bg)}>
        <div className="flex items-center gap-3">
          <span className="text-lg shrink-0">{meta.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('font-bold text-sm', meta.text)}>{meta.label}</span>
              <span className="text-muted-foreground text-xs">·</span>
              <span className={cn('font-display font-black text-base tabular-nums', meta.text)}>
                {etaFrom}–{etaTo} Min
              </span>
              {activeCount != null && activeCount > 0 && (
                <>
                  <span className="text-muted-foreground text-xs">·</span>
                  <span className="text-xs text-muted-foreground">{activeCount} Bestellungen aktiv</span>
                </>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 flex-wrap">
              {/* Absolute delivery time window */}
              {(() => {
                const fromMs = Date.now() + etaFrom * 60_000;
                const toMs   = Date.now() + etaTo   * 60_000;
                const fmt = (ms: number) =>
                  new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                return (
                  <span className={cn('text-xs font-semibold tabular-nums', meta.text)}>
                    Ankunft ~{fmt(fromMs)}–{fmt(toMs)} Uhr
                  </span>
                );
              })()}
            </div>
            {/* Auslastungs-Balken */}
            <div className="mt-1.5 h-1 rounded-full bg-black/10 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', barColor)}
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 shrink-0">
            <span className="relative flex h-1.5 w-1.5">
              <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', meta.dot)} />
              <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', meta.dot)} />
            </span>
            Live
          </span>
        </div>
      </div>
    </div>
  );
}
