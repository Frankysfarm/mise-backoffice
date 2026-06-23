'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, euro } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────
type Location = { id: string; name: string; adresse: string | null; stadt: string | null; plz: string | null; telefon: string | null };
type Tenant = { name: string; slug: string; logoUrl: string | null; heroImageUrl: string | null; primary: string | null; deliveryTimeMin: number; minOrder: number; deliveryFee: number };
type Category = { id: string; name: string; icon?: string | null; sort_order: number };
type Item = { id: string; name: string; beschreibung: string | null; preis: number; bild_url: string | null; category_id: string; beliebt: boolean; option_groups?: unknown };
type CartMap = Map<string, number>;
type EtaData = { eta_min: number; load: 'quiet' | 'normal' | 'busy'; drivers_online: number } | null;

// ── Sub-components ─────────────────────────────────────────────────────────
function EtaBadge({ eta }: { eta: EtaData }) {
  if (!eta) return null;
  const color = eta.load === 'quiet' ? 'bg-matcha-100 text-matcha-700' : eta.load === 'busy' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold', color)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 animate-pulse" />
      ~{eta.eta_min} Min
    </span>
  );
}

function ItemCard({ item, qty, onAdd, onRemove }: { item: Item; qty: number; onAdd: () => void; onRemove: () => void }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-white rounded-xl shadow-subtle border border-gray-100">
      {item.bild_url && (
        <img src={item.bild_url} alt={item.name} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="font-semibold text-gray-900 text-sm leading-snug">{item.name}</p>
            {item.beschreibung && <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{item.beschreibung}</p>}
          </div>
          {item.beliebt && (
            <span className="text-xs bg-matcha-600 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">Beliebt</span>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="font-bold text-matcha-700">{euro(item.preis)}</span>
          {qty === 0 ? (
            <button onClick={onAdd} className="w-8 h-8 rounded-full bg-matcha-600 text-white flex items-center justify-center text-lg font-bold hover:bg-matcha-700 transition-colors">+</button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={onRemove} className="w-7 h-7 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-bold hover:bg-gray-200 transition-colors">−</button>
              <span className="w-5 text-center font-semibold text-sm">{qty}</span>
              <button onClick={onAdd} className="w-7 h-7 rounded-full bg-matcha-600 text-white flex items-center justify-center font-bold hover:bg-matcha-700 transition-colors">+</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CartDrawer({ cart, items, tenant, orderType, onClose, onCheckout }: {
  cart: CartMap; items: Item[]; tenant: Tenant; orderType: 'lieferung' | 'abholung';
  onClose: () => void; onCheckout: () => void;
}) {
  const cartItems = items.filter(i => (cart.get(i.id) ?? 0) > 0);
  const subtotal = cartItems.reduce((sum, i) => sum + i.preis * (cart.get(i.id) ?? 0), 0);
  const fee = orderType === 'lieferung' ? tenant.deliveryFee : 0;
  const total = subtotal + fee;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-sm bg-white h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-lg">Warenkorb</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cartItems.map(item => (
            <div key={item.id} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-matcha-600 text-white text-xs flex items-center justify-center font-bold">{cart.get(item.id)}</span>
              <span className="flex-1 text-sm">{item.name}</span>
              <span className="font-semibold text-sm">{euro(item.preis * (cart.get(item.id) ?? 0))}</span>
            </div>
          ))}
        </div>
        <div className="p-4 border-t space-y-2 bg-gray-50">
          <div className="flex justify-between text-sm text-gray-600"><span>Zwischensumme</span><span>{euro(subtotal)}</span></div>
          {orderType === 'lieferung' && <div className="flex justify-between text-sm text-gray-600"><span>Liefergebühr</span><span>{fee === 0 ? 'Kostenlos' : euro(fee)}</span></div>}
          <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Gesamt</span><span>{euro(total)}</span></div>
          {subtotal < tenant.minOrder && <p className="text-xs text-amber-600">Mindestbestellwert: {euro(tenant.minOrder)} (noch {euro(tenant.minOrder - subtotal)})</p>}
          <button
            onClick={onCheckout}
            disabled={subtotal < tenant.minOrder}
            className="w-full py-3 bg-matcha-600 text-white rounded-xl font-semibold hover:bg-matcha-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Zur Kasse →
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckoutForm({ cart, items, tenant, location, onBack, onSuccess }: {
  cart: CartMap; items: Item[]; tenant: Tenant; location: Location;
  onBack: () => void; onSuccess: (orderId: string) => void;
}) {
  const [form, setForm] = useState({ name: '', phone: '', address: '', payment: 'bar' as 'bar' | 'karte', type: 'lieferung' as 'lieferung' | 'abholung' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cartItems = items.filter(i => (cart.get(i.id) ?? 0) > 0);
  const subtotal = cartItems.reduce((sum, i) => sum + i.preis * (cart.get(i.id) ?? 0), 0);
  const fee = form.type === 'lieferung' ? tenant.deliveryFee : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/delivery/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: location.id,
          items: cartItems.map(i => ({ id: i.id, name: i.name, qty: cart.get(i.id)!, price: i.preis })),
          customer: { name: form.name, phone: form.phone, address: form.address },
          type: form.type,
          payment_method: form.payment,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onSuccess(data.id ?? data.order_id ?? data.orderId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Bestellen');
    } finally {
      setLoading(false);
    }
  }

  const field = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-600';

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div className="max-w-lg mx-auto p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 mb-4 hover:text-gray-800">← Zurück</button>
        <h2 className="text-xl font-bold mb-4">Bestellung abschließen</h2>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {(['lieferung', 'abholung'] as const).map(t => (
              <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                className={cn('flex-1 py-2.5 text-sm font-semibold capitalize transition-colors', form.type === t ? 'bg-matcha-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
                {t === 'lieferung' ? 'Lieferung' : 'Abholung'}
              </button>
            ))}
          </div>
          <input className={field} placeholder="Dein Name *" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input className={field} placeholder="Telefonnummer *" required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          {form.type === 'lieferung' && (
            <input className={field} placeholder="Lieferadresse (Straße, Hausnr., Stadt) *" required value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          )}
          <div>
            <p className="text-sm font-semibold mb-2">Zahlungsmethode</p>
            <div className="flex gap-2">
              {(['bar', 'karte'] as const).map(p => (
                <button key={p} type="button" onClick={() => setForm(f => ({ ...f, payment: p }))}
                  className={cn('flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-colors', form.payment === p ? 'bg-matcha-600 text-white border-matcha-600' : 'bg-white text-gray-600 border-gray-200 hover:border-matcha-600')}>
                  {p === 'bar' ? 'Bar' : 'Karte'}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 space-y-1 text-sm">
            {cartItems.map(i => (
              <div key={i.id} className="flex justify-between"><span>{cart.get(i.id)}× {i.name}</span><span>{euro(i.preis * (cart.get(i.id) ?? 0))}</span></div>
            ))}
            <div className="border-t pt-1 flex justify-between font-bold"><span>Gesamt</span><span>{euro(subtotal + fee)}</span></div>
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-xl">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-3.5 bg-matcha-600 text-white rounded-xl font-bold text-base hover:bg-matcha-700 disabled:opacity-50 transition-colors">
            {loading ? 'Wird gesendet…' : `Jetzt bestellen · ${euro(subtotal + fee)}`}
          </button>
        </form>
      </div>
    </div>
  );
}

function OrderSuccess({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [status, setStatus] = useState<string>('eingegangen');
  const [eta, setEta] = useState<{ eta_earliest?: string; eta_latest?: string } | null>(null);
  const steps = ['eingegangen', 'bestaetigt', 'zubereitung', 'unterwegs', 'geliefert'];
  const stepLabels: Record<string, string> = { eingegangen: 'Eingegangen', bestaetigt: 'Bestätigt', zubereitung: 'In Zubereitung', unterwegs: 'Unterwegs', geliefert: 'Geliefert' };
  const curIdx = steps.indexOf(status);

  useEffect(() => {
    const sb = createClient();
    const channel = sb.channel(`order-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` }, payload => {
        if (payload.new?.status) setStatus(payload.new.status);
      })
      .subscribe();
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/delivery/orders/${orderId}/status`);
        if (res.ok) {
          const d = await res.json();
          if (d.status) setStatus(d.status);
          if (d.eta_earliest || d.eta_latest) setEta(d);
        }
      } catch {}
    }, 20000);
    return () => { sb.removeChannel(channel); clearInterval(poll); };
  }, [orderId]);

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div className="max-w-lg mx-auto p-6 text-center">
        <div className="w-16 h-16 bg-matcha-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
        <h2 className="text-2xl font-bold text-matcha-700 mb-1">Bestellung aufgegeben!</h2>
        <p className="text-gray-500 text-sm mb-6">Bestellnummer: <span className="font-mono font-semibold">{orderId.slice(0, 8).toUpperCase()}</span></p>
        <div className="relative mb-8">
          <div className="flex justify-between relative z-10">
            {steps.map((s, i) => (
              <div key={s} className="flex flex-col items-center gap-1 flex-1">
                <div className={cn('w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors',
                  i < curIdx ? 'bg-matcha-600 border-matcha-600 text-white' :
                  i === curIdx ? 'bg-white border-matcha-600 text-matcha-700' :
                  'bg-white border-gray-200 text-gray-300')}>
                  {i < curIdx ? '✓' : i + 1}
                </div>
                <span className={cn('text-[10px] text-center leading-tight', i <= curIdx ? 'text-matcha-700 font-semibold' : 'text-gray-300')}>{stepLabels[s]}</span>
              </div>
            ))}
          </div>
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-100 -z-0">
            <div className="h-full bg-matcha-600 transition-all duration-500" style={{ width: `${Math.max(0, curIdx / (steps.length - 1)) * 100}%` }} />
          </div>
        </div>
        {eta?.eta_latest && (
          <p className="text-sm text-gray-600 mb-4">Voraussichtliche Ankunft: <strong>{new Date(eta.eta_latest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</strong></p>
        )}
        <button onClick={onClose} className="mt-4 px-6 py-3 bg-matcha-600 text-white rounded-xl font-semibold hover:bg-matcha-700 transition-colors">Neue Bestellung</button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function BissStorefront({ location, tenant, categories, items }: {
  location: Location; tenant: Tenant; categories: Category[]; items: Item[];
}) {
  const [cart, setCart] = useState<CartMap>(new Map());
  const [eta, setEta] = useState<EtaData>(null);
  const [activeCategory, setActiveCategory] = useState<string>(categories[0]?.id ?? '');
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<'lieferung' | 'abholung'>('lieferung');
  const catRefs = useRef<Record<string, HTMLElement | null>>({});

  // Fetch ETA
  useEffect(() => {
    async function fetchEta() {
      try {
        const res = await fetch(`/api/delivery/eta/live?location_id=${location.id}`);
        if (res.ok) setEta(await res.json());
      } catch {}
    }
    fetchEta();
    const iv = setInterval(fetchEta, 60000);
    return () => clearInterval(iv);
  }, [location.id]);

  function add(itemId: string) {
    setCart(prev => { const m = new Map(prev); m.set(itemId, (m.get(itemId) ?? 0) + 1); return m; });
  }
  function remove(itemId: string) {
    setCart(prev => { const m = new Map(prev); const n = (m.get(itemId) ?? 0) - 1; if (n <= 0) m.delete(itemId); else m.set(itemId, n); return m; });
  }

  const totalQty = Array.from(cart.values()).reduce((s, v) => s + v, 0);
  const totalPrice = items.filter(i => cart.has(i.id)).reduce((s, i) => s + i.preis * (cart.get(i.id) ?? 0), 0);

  const popularItems = items.filter(i => i.beliebt);

  function scrollToCategory(catId: string) {
    setActiveCategory(catId);
    catRefs.current[catId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (orderId) return <OrderSuccess orderId={orderId} onClose={() => { setOrderId(null); setCart(new Map()); }} />;
  if (showCheckout) return <CheckoutForm cart={cart} items={items} tenant={tenant} location={location} onBack={() => setShowCheckout(false)} onSuccess={id => { setShowCheckout(false); setOrderId(id); }} />;

  return (
    <div className="min-h-screen bg-gray-50 font-body pb-28">
      {/* Hero */}
      <div className={cn('relative w-full h-52 flex items-end', tenant.heroImageUrl ? '' : 'bg-gradient-to-br from-matcha-700 via-matcha-600 to-matcha-500')}>
        {tenant.heroImageUrl && <img src={tenant.heroImageUrl} alt={tenant.name} className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="relative p-4 w-full flex items-end gap-3">
          {tenant.logoUrl && <img src={tenant.logoUrl} alt="Logo" className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-lg" />}
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-2xl leading-tight">{tenant.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 text-xs text-white/90"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />Geöffnet</span>
              <EtaBadge eta={eta} />
              {!eta && <span className="text-xs text-white/80">~{tenant.deliveryTimeMin} Min</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Info strip */}
      <div className="bg-white px-4 py-2.5 flex gap-4 text-xs text-gray-500 border-b border-gray-100">
        <span>Mindestbestellung {euro(tenant.minOrder)}</span>
        <span>·</span>
        <span>Liefergebühr {tenant.deliveryFee === 0 ? 'Kostenlos' : euro(tenant.deliveryFee)}</span>
        {location.adresse && <><span>·</span><span className="truncate">{location.adresse}</span></>}
      </div>

      {/* Category nav */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex overflow-x-auto scrollbar-hide px-4 gap-2 py-2.5">
          {popularItems.length > 0 && (
            <button onClick={() => scrollToCategory('popular')}
              className={cn('whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors flex-shrink-0', activeCategory === 'popular' ? 'bg-matcha-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-matcha-100')}>
              ⭐ Beliebt
            </button>
          )}
          {categories.map(cat => (
            <button key={cat.id} onClick={() => scrollToCategory(cat.id)}
              className={cn('whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors flex-shrink-0', activeCategory === cat.id ? 'bg-matcha-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-matcha-100')}>
              {cat.icon ? `${cat.icon} ` : ''}{cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        {/* Popular section */}
        {popularItems.length > 0 && (
          <section ref={el => { catRefs.current['popular'] = el; }}>
            <h2 className="text-base font-bold text-gray-800 mb-3">⭐ Beliebt bei unseren Gästen</h2>
            <div className="space-y-3">
              {popularItems.map(item => (
                <ItemCard key={item.id} item={item} qty={cart.get(item.id) ?? 0} onAdd={() => add(item.id)} onRemove={() => remove(item.id)} />
              ))}
            </div>
          </section>
        )}

        {/* Menu sections */}
        {categories.map(cat => {
          const catItems = items.filter(i => i.category_id === cat.id);
          if (catItems.length === 0) return null;
          return (
            <section key={cat.id} ref={el => { catRefs.current[cat.id] = el; }}>
              <h2 className="text-base font-bold text-gray-800 mb-3">{cat.name}</h2>
              <div className="space-y-3">
                {catItems.map(item => (
                  <ItemCard key={item.id} item={item} qty={cart.get(item.id) ?? 0} onAdd={() => add(item.id)} onRemove={() => remove(item.id)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Floating cart button */}
      {totalQty > 0 && (
        <div className="fixed bottom-6 left-4 right-4 z-40 max-w-lg mx-auto">
          <button onClick={() => setShowCart(true)}
            className="w-full bg-matcha-600 hover:bg-matcha-700 text-white px-5 py-3.5 rounded-2xl shadow-strong flex items-center justify-between font-semibold transition-colors">
            <span className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">{totalQty}</span>
            <span>Warenkorb anzeigen</span>
            <span>{euro(totalPrice)}</span>
          </button>
        </div>
      )}

      {/* Cart drawer */}
      {showCart && (
        <CartDrawer cart={cart} items={items} tenant={tenant} orderType={orderType}
          onClose={() => setShowCart(false)}
          onCheckout={() => { setShowCart(false); setShowCheckout(true); }} />
      )}
    </div>
  );
}
