'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { cn, euro } from '@/lib/utils';
import { MiseItemSheet, makeCartLineId, type MiseItem, type Selections } from './item-sheet';
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, CreditCard, Flame, Loader2,
  Minus, Plus, ShoppingBag, Utensils, Wallet, X,
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
  table, tenant, location, categories, items, relations = [],
}: {
  table: Table; tenant: Tenant; location: Location;
  categories: Category[]; items: MenuItem[];
  relations?: Relation[];
}) {
  const supabase = createClient();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sheetItem, setSheetItem] = useState<MenuItem | null>(null);
  const [activeCat, setActiveCat] = useState<string>(categories[0]?.id ?? '');
  const [cartOpen, setCartOpen] = useState(false);
  const [crossSellOpen, setCrossSellOpen] = useState(false);
  const [confirmTableOpen, setConfirmTableOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ number: string; method: 'bar' | 'karte' | 'online' } | null>(null);
  // Leer lassen — Kunde muss Tisch-Nummer vor Zahlung selbst eingeben.
  const [tischNummer, setTischNummer] = useState('');

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

  async function submitOrder(paymentMethod: 'bar' | 'karte' | 'online') {
    setSubmitting(true);
    try {
      const { data: order, error } = await supabase.from('customer_orders').insert({
        tenant_id: table.tenant_id,
        location_id: table.location_id,
        tisch_id: table.id !== 'preview' ? table.id : null,
        typ: 'vor_ort',
        // QR-Tischbestellung: wenn NICHT online bezahlt, zuerst 'wartet_auf_zahlung' →
        // Kellner kassiert vorn an der Kasse, dann wird Order an Küche gefeuert.
        // Online-Zahlung (Apple/Google Pay) → direkt 'neu' + bezahlt=true.
        status: paymentMethod === 'online' ? 'neu' : 'wartet_auf_zahlung',
        kunde_name: `Tisch ${tischNummer}`,
        zwischensumme: cartTotal,
        gesamtbetrag: cartTotal,
        zahlungsart: paymentMethod,
        bezahlt: paymentMethod === 'online',
        bestellt_am: new Date().toISOString(),
        geschaetzte_zubereitung_min: Math.max(10, cart.length * 3),
      }).select('id, bestellnummer').single();

      if (error) throw error;

      const itemRows = cart.map((l) => ({
        order_id: order.id,
        menu_item_id: l.item.id,
        name: l.item.name,
        menge: l.qty,
        einzelpreis: l.item.preis,
        gesamtpreis: l.qty * l.item.preis,
        notiz: l.notiz || null,
      }));
      await supabase.from('order_items').insert(itemRows);

      setSuccess({ number: order.bestellnummer, method: paymentMethod });
      setCart([]);
      setCartOpen(false);
      setPayOpen(false);
      setConfirmTableOpen(false);
      setCrossSellOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Fehler beim Bestellen');
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- Success Screen ---------- */
  if (success) {
    const needsPaymentAtCounter = success.method === 'bar' || success.method === 'karte';
    return (
      <div className="min-h-screen flex flex-col" style={{ background: primary, color: 'white' }}>
        <div className="flex-1 grid place-items-center p-6">
          <div className="max-w-md w-full text-center">
            {needsPaymentAtCounter ? (
              <>
                {/* COUNTER-ZAHLUNG */}
                <div className="mx-auto h-24 w-24 rounded-full flex items-center justify-center mb-6" style={{ background: accent }}>
                  <Wallet className="h-12 w-12" style={{ color: primary }} />
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur border border-white/20 px-4 py-1.5 mb-4 text-xs font-bold uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: accent }} />
                  Noch nicht bezahlt
                </div>
                <h1 className="font-display text-4xl font-black mb-3 leading-tight">Fast geschafft!</h1>
                <p className="text-lg opacity-90 leading-relaxed">
                  Bitte komm <strong>kurz vor zur Kasse</strong> und zahl dort <strong>{success.method === 'bar' ? 'bar' : 'mit Karte'}</strong>.
                </p>
                <p className="mt-3 text-sm opacity-75 leading-relaxed">
                  Sobald das durch ist, legt die Küche los und dein Essen landet gleich an Tisch {tischNummer}. Versprochen — keine langen Warteschlangen. ✨
                </p>

                <div className="mt-6 rounded-3xl bg-white/10 backdrop-blur border-2 border-white/20 p-5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-70 mb-1">Zeig das an der Kasse</div>
                  <div className="font-mono font-black text-4xl" style={{ color: accent }}>
                    #{success.number.replace('FF-', '')}
                  </div>
                  <div className="mt-2 text-xs opacity-80">Tisch <strong>{tischNummer}</strong></div>
                </div>

                <button
                  onClick={() => setSuccess(null)}
                  className="mt-8 w-full h-14 rounded-2xl font-display font-bold text-lg"
                  style={{ background: accent, color: primary }}
                >
                  Alles klar, ich geh hin
                </button>
              </>
            ) : (
              <>
                {/* ONLINE-ZAHLUNG ERFOLGT */}
                <div className="mx-auto h-24 w-24 rounded-full flex items-center justify-center mb-6 animate-bounce" style={{ background: accent }}>
                  <Check className="h-12 w-12" style={{ color: primary }} />
                </div>
                <h1 className="font-display text-4xl font-black mb-3">Bestellung raus!</h1>
                <div className="text-xl opacity-90">
                  <span className="font-mono font-bold">#{success.number.replace('FF-', '')}</span>
                </div>
                <p className="mt-4 opacity-85 leading-relaxed">
                  Bezahlt ✓ — deine Bestellung ist in der Küche.<br />
                  Wir bringen sie gleich an <strong>Tisch {tischNummer}</strong>. 🍽
                </p>
                <button
                  onClick={() => setSuccess(null)}
                  className="mt-8 w-full h-14 rounded-2xl font-display font-bold text-lg"
                  style={{ background: accent, color: primary }}
                >
                  Noch etwas bestellen
                </button>
              </>
            )}
          </div>
        </div>
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
      {cartOpen && !crossSellOpen && !confirmTableOpen && !payOpen && (
        <CartDrawer
          cart={cart}
          total={cartTotal}
          primary={primary}
          accent={accent}
          tableNumber={tischNummer}
          onClose={() => setCartOpen(false)}
          onUpdateQty={updateQty}
          onProceed={() => {
            if (crossSellItems.length > 0) setCrossSellOpen(true);
            else setConfirmTableOpen(true);
          }}
        />
      )}

      {/* ============ CROSS-SELL ============ */}
      {crossSellOpen && !confirmTableOpen && !payOpen && (
        <CrossSellSheet
          suggestions={crossSellItems}
          primary={primary}
          accent={accent}
          onAdd={(it) => addItem(it)}
          onClose={() => setCrossSellOpen(false)}
          onSkip={() => {
            setCrossSellOpen(false);
            setConfirmTableOpen(true);
          }}
        />
      )}

      {/* ============ TABLE CONFIRM STEP ============ */}
      {confirmTableOpen && !payOpen && (
        <TableConfirm
          initial={tischNummer}
          suggestion={table.id !== 'preview' ? table.nummer : undefined}
          primary={primary}
          accent={accent}
          onBack={() => setConfirmTableOpen(false)}
          onConfirm={(nummer) => {
            setTischNummer(nummer);
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
    </div>
  );
}

function FeatureChip({ icon, label, subLabel, accent }: { icon: string; label: string; subLabel: string; accent: string }) {
  return (
    <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/15 p-3 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="font-display text-xs font-black uppercase tracking-wider" style={{ color: accent }}>{label}</div>
      <div className="text-[10px] opacity-70 mt-0.5 leading-tight">{subLabel}</div>
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
  cart, total, primary, accent, tableNumber, onClose, onUpdateQty, onProceed,
}: {
  cart: CartLine[]; total: number; primary: string; accent: string; tableNumber: string;
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

/* ============================================ Table Confirm Step ============================================ */

function TableConfirm({
  initial, suggestion, primary, accent, onBack, onConfirm,
}: {
  initial: string; suggestion?: string; primary: string; accent: string;
  onBack: () => void; onConfirm: (nummer: string) => void;
}) {
  const [value, setValue] = useState(initial);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 grid items-end sm:items-center justify-center animate-in fade-in">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 animate-in slide-in-from-bottom">
        <button onClick={onBack} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Zurück zum Warenkorb
        </button>

        <div className="text-center mt-2">
          <div
            className="mx-auto h-20 w-20 rounded-3xl grid place-items-center mb-4 shadow-lg"
            style={{ background: primary, color: accent }}
          >
            <span className="font-display text-5xl font-black">#</span>
          </div>
          <h2 className="font-display text-3xl font-black leading-tight">An welchem Tisch sitzt du?</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
            Wir brauchen die Nummer, damit das Personal weiß, wohin dein Essen soll.
          </p>
        </div>

        <div className="mt-8">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="––"
            inputMode="numeric"
            className="w-full h-24 rounded-3xl border-4 bg-background px-4 font-display text-6xl font-black text-center focus:ring-4 focus:outline-none transition"
            style={{
              borderColor: value.trim() ? primary : undefined,
            }}
            autoFocus
          />
          <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground text-center">
            Tisch-Nummer
          </div>
        </div>

        {/* Quick-Chips */}
        {suggestion && !value && (
          <div className="mt-4 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Vorschlag</div>
            <button
              onClick={() => setValue(suggestion)}
              className="inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-bold hover:bg-muted"
              style={{ borderColor: primary, color: primary }}
            >
              Tisch {suggestion} <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <button
          onClick={() => value.trim() && onConfirm(value.trim())}
          disabled={!value.trim()}
          className="mt-8 w-full h-14 rounded-2xl font-display font-black text-lg disabled:opacity-30 inline-flex items-center justify-center gap-2 active:scale-[0.98] transition"
          style={{ background: primary, color: 'white' }}
        >
          Weiter zur Zahlung <ArrowRight className="h-5 w-5" />
        </button>

        <div className="mt-3 text-[11px] text-center text-muted-foreground leading-relaxed">
          Findest du deine Nummer nicht?<br />Auf dem Tisch-Aufsteller oder frag kurz das Personal.
        </div>
      </div>
    </div>
  );
}

/* ============================================ Payment Sheet ============================================ */

function PaymentSheet({
  total, tischNummer, primary, accent, submitting, onClose, onPay,
}: {
  total: number; tischNummer: string; primary: string; accent: string; submitting: boolean;
  onClose: () => void; onPay: (m: 'bar' | 'karte' | 'online') => void;
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
          <button
            onClick={() => onPay('online')}
            disabled={submitting}
            className="w-full h-14 rounded-2xl bg-black text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-gray-800"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <>
                <span className="text-2xl leading-none"></span>
                <span className="text-lg">Pay</span>
              </>
            )}
          </button>
          <button
            onClick={() => onPay('online')}
            disabled={submitting}
            className="w-full h-14 rounded-2xl bg-white border-2 border-gray-300 text-gray-800 font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-gray-50"
          >
            <span className="text-xl font-black">G</span>
            <span className="text-lg">Pay</span>
          </button>

          <div className="h-px bg-border my-3" />

          <button
            onClick={() => onPay('karte')}
            disabled={submitting}
            className="w-full h-14 rounded-2xl font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60 border-2"
            style={{ borderColor: primary, color: primary, background: 'white' }}
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

        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[11px] text-amber-900 leading-relaxed">
          <strong>Hinweis:</strong> Bei „Vorn an der Kasse" zahlst du erst dort, bevor wir anfangen zu kochen. Bei Apple/Google Pay landet die Bestellung <strong>sofort</strong> in der Küche.
        </div>
      </div>
    </div>
  );
}
