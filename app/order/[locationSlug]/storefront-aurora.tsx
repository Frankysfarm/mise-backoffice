'use client';

import * as React from 'react';
import { Star, Plus, Minus, ShoppingBag, Search, Store, Truck, Clock, X, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ItemDetailSheet } from './item-sheet';

type LiveEtaLoad = 'quiet' | 'normal' | 'busy';

function useAuroraLiveEta(locationId: string, baseMin: number) {
  const [etaMin, setEtaMin] = React.useState(baseMin);
  const [load, setLoad] = React.useState<LiveEtaLoad>('normal');
  const [driversOnline, setDriversOnline] = React.useState<number | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/eta/live?location_id=${locationId}`);
        if (!res.ok || cancelled) return;
        const d = await res.json();
        if (cancelled) return;
        if (d?.eta_min != null) setEtaMin(d.eta_min);
        if (d?.load) setLoad(d.load as LiveEtaLoad);
        if (d?.drivers_online != null) setDriversOnline(d.drivers_online);
        setReady(true);
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  return { etaMin, load, driversOnline, ready };
}

export type AuroraOrderType = 'lieferung' | 'abholung';

export interface AuroraItem {
  id: string;
  category_id: string | null;
  name: string;
  beschreibung: string | null;
  preis: number;
  bild_url: string | null;
  verfuegbar: boolean;
  beliebt: boolean;
  tags: string[] | null;
  option_groups?: Array<{
    id: string;
    name: string;
    type: 'single' | 'multi';
    required: boolean;
    max?: number;
    options: Array<{ id: string; name: string; priceDelta: number; default?: boolean; badge?: string }>;
  }>;
}

export interface AuroraCategory {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
}

export interface AuroraLocation {
  id: string;
  name: string;
  adresse: string | null;
  stadt: string | null;
  plz: string | null;
  telefon: string | null;
}

export interface AuroraTenant {
  name: string;
  slug: string;
  primary?: string | null;
  accent?: string | null;
  hero_image_url?: string | null;
  logo_url?: string | null;
  delivery_time_min?: number;
  min_order?: number;
  delivery_fee?: number;
}

export function StorefrontAurora({
  location,
  tenant,
  categories,
  items,
  themeV,
}: {
  location: AuroraLocation;
  tenant: AuroraTenant;
  categories: AuroraCategory[];
  items: AuroraItem[];
  themeV?: string;
}) {
  const [orderType, setOrderType] = React.useState<AuroraOrderType>('lieferung');
  const [cart, setCart] = React.useState<Map<string, number>>(new Map());
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [pulse, setPulse] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [sheetItem, setSheetItem] = React.useState<AuroraItem | null>(null);
  const [cartSheetOpen, setCartSheetOpen] = React.useState(false);

  // Brand-token override (per tenant — only --brand-primary, --brand-accent, --brand-on-primary)
  const brandStyle: React.CSSProperties & Record<string, string> = {};
  if (tenant.primary) {
    brandStyle['--brand-primary' as any] = tenant.primary;
    brandStyle['--brand-on-primary' as any] = autoForeground(tenant.primary);
  }
  if (tenant.accent) brandStyle['--brand-accent' as any] = tenant.accent;

  const itemsByCategory = React.useMemo(() => {
    const filtered = search.trim()
      ? items.filter((i) =>
          (i.name + ' ' + (i.beschreibung ?? '')).toLowerCase().includes(search.toLowerCase()),
        )
      : items;
    const map = new Map<string, AuroraItem[]>();
    for (const cat of categories) map.set(cat.id, []);
    for (const it of filtered) {
      if (it.category_id && map.has(it.category_id)) {
        map.get(it.category_id)!.push(it);
      }
    }
    return map;
  }, [categories, items, search]);

  const totalItems = React.useMemo(
    () => Array.from(cart.values()).reduce((a, b) => a + b, 0),
    [cart],
  );
  const total = React.useMemo(() => {
    let sum = 0;
    cart.forEach((qty, id) => {
      const item = items.find((i) => i.id === id);
      if (item) sum += item.preis * qty;
    });
    return sum;
  }, [cart, items]);

  const minOrder = tenant.min_order ?? 12;
  const deliveryFee = tenant.delivery_fee ?? 0;
  const deliveryTime = tenant.delivery_time_min ?? 30;

  const liveEta = useAuroraLiveEta(location.id, deliveryTime);
  const remainingToMin = Math.max(0, minOrder - total);
  const isOpen = new Date().getHours() < 22;
  const initialsLetter = location.name.charAt(0).toUpperCase();

  function addItem(itemId: string) {
    setCart((prev) => {
      const next = new Map(prev);
      next.set(itemId, (next.get(itemId) ?? 0) + 1);
      return next;
    });
    setPulse(true);
    setTimeout(() => setPulse(false), 280);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(8);
    }
  }
  function removeItem(itemId: string) {
    setCart((prev) => {
      const next = new Map(prev);
      const cur = next.get(itemId) ?? 0;
      if (cur <= 1) next.delete(itemId);
      else next.set(itemId, cur - 1);
      return next;
    });
  }

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = (visible[0].target as HTMLElement).dataset.section;
          if (id) setActiveId(id);
        }
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: [0, 0.5, 1] },
    );
    document.querySelectorAll('[data-section]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [categories.length]);

  function scrollToSection(id: string) {
    const el = document.querySelector(`[data-section="${id}"]`);
    if (el) {
      const y = (el as HTMLElement).getBoundingClientRect().top + window.scrollY - 130;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  return (
    <div data-theme={themeV === 'aurora' ? 'aurora-v3' : (themeV ?? 'aurora-v3')} style={brandStyle}>
      <div className="au-page">
        {/* === HEADER === */}
        <header className="au-header">
          <div className="au-header__inner">
            <a href="#" className="au-logo">
              {tenant.logo_url ? (
                <img src={tenant.logo_url} alt={location.name} />
              ) : (
                <span className="au-logo__wordmark">{location.name}</span>
              )}
            </a>
            <button className="au-cart-btn" onClick={() => setCartSheetOpen(true)}>
              <ShoppingBag size={18} strokeWidth={1.6} />
              {totalItems > 0 && <span className="au-cart-btn__count">{totalItems}</span>}
            </button>
          </div>
        </header>

        {/* === HERO === */}
        <section className="au-hero">
          <div
            className="au-hero__banner"
            style={
              tenant.hero_image_url
                ? { backgroundImage: `url(${tenant.hero_image_url})` }
                : undefined
            }
          />
          <div className="au-hero__content">
            <div className="au-hero__card">
              <h1 className="au-hero__name">{location.name}</h1>
              <div className="au-hero__meta">
                <span className="au-hero__rating">
                  <Star size={14} strokeWidth={0} fill="currentColor" />
                  <span>4.8</span>
                </span>
                <span style={{ opacity: 0.6 }}>(210 Bewertungen)</span>
                <span className="au-hero__meta-dot" />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={13} strokeWidth={1.6} style={{ verticalAlign: '-2px' }} />
                  {liveEta.ready ? (
                    <>
                      <span style={{
                        fontWeight: 800,
                        color: liveEta.load === 'busy' ? '#dc2626' : liveEta.load === 'quiet' ? '#16a34a' : undefined,
                      }}>
                        {liveEta.etaMin}–{liveEta.etaMin + 10} Min
                      </span>
                      {liveEta.load !== 'normal' && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 9999,
                          backgroundColor: liveEta.load === 'busy' ? 'rgba(220,38,38,0.12)' : 'rgba(22,163,74,0.12)',
                          color: liveEta.load === 'busy' ? '#dc2626' : '#16a34a',
                        }}>
                          {liveEta.load === 'busy' ? '🔥 Ausgelastet' : '✨ Sehr schnell'}
                        </span>
                      )}
                    </>
                  ) : (
                    <span>{deliveryTime}–{deliveryTime + 10} Min</span>
                  )}
                </span>
                {orderType === 'lieferung' && deliveryFee > 0 && (
                  <>
                    <span className="au-hero__meta-dot" />
                    <span>{formatEuro(deliveryFee)} Lieferung</span>
                  </>
                )}
                {orderType === 'lieferung' && (
                  <>
                    <span className="au-hero__meta-dot" />
                    <span>Min. {formatEuro(minOrder)}</span>
                  </>
                )}
              </div>

              <div className="au-hero__chips">
                <span className={`au-status-chip ${isOpen ? 'au-status-chip--success' : ''}`}>
                  <span className="au-status-chip__dot" />
                  {isOpen ? 'Geöffnet bis 22 Uhr' : 'Geschlossen'}
                </span>
                {(location.adresse || location.stadt) && (
                  <span className="au-status-chip">
                    📍 {[location.adresse, location.plz, location.stadt].filter(Boolean).join(', ')}
                  </span>
                )}
                {location.telefon && (
                  <a href={`tel:${location.telefon}`} className="au-status-chip" style={{ textDecoration: 'none' }}>
                    📞 {location.telefon}
                  </a>
                )}
                {liveEta.ready && liveEta.driversOnline != null && liveEta.driversOnline > 0 && orderType === 'lieferung' && (
                  <span className="au-status-chip" style={{
                    backgroundColor: liveEta.driversOnline >= 3 ? 'rgba(22,163,74,0.1)' : undefined,
                    color: liveEta.driversOnline >= 3 ? '#15803d' : undefined,
                  }}>
                    🛵 {liveEta.driversOnline} Fahrer aktiv
                  </span>
                )}
              </div>

              <div className="au-order-type">
                <button
                  className="au-order-type__btn"
                  data-active={orderType === 'lieferung'}
                  onClick={() => setOrderType('lieferung')}
                >
                  <Truck size={15} strokeWidth={1.8} /> Lieferung
                </button>
                <button
                  className="au-order-type__btn"
                  data-active={orderType === 'abholung'}
                  onClick={() => setOrderType('abholung')}
                >
                  <Store size={15} strokeWidth={1.8} /> Abholung
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Geteilter Tracking-Link oder wiederkehrender Kunde mit aktiver Bestellung */}
        <div className="au-container" style={{ paddingTop: 12, paddingBottom: 0 }}>
          <AuroraSharedTrackingBanner />
          <AuroraActiveOrderBanner locationId={location.id} />
        </div>

        {/* === STICKY CATEGORY NAV === */}
        <nav className="au-cat-nav" aria-label="Kategorien">
          <div className="au-cat-nav__inner">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className="au-cat-pill"
                data-active={activeId === cat.id}
                onClick={() => scrollToSection(cat.id)}
              >
                {cat.icon && <span aria-hidden>{cat.icon}</span>}
                {cat.name}
              </button>
            ))}
          </div>
        </nav>

        {/* === SEARCH === */}
        <div className="au-container" style={{ paddingTop: 24 }}>
          <label className="au-search">
            <Search size={18} strokeWidth={1.6} />
            <input
              type="search"
              placeholder={`Suchen bei ${location.name}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        {/* === SECTIONS === */}
        {categories.map((cat) => {
          const catItems = itemsByCategory.get(cat.id) ?? [];
          if (catItems.length === 0) return null;
          return (
            <section key={cat.id} data-section={cat.id} className="au-section">
              <div className="au-section__header">
                <div className="au-section__eyebrow">{cat.icon ? cat.icon + ' Kategorie' : 'Kategorie'}</div>
                <h2 className="au-section__title">{cat.name}</h2>
              </div>
              <div className="au-grid">
                {catItems.map((item) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    qty={cart.get(item.id) ?? 0}
                    onAdd={() => addItem(item.id)}
                    onRemove={() => removeItem(item.id)}
                    onOpenDetail={() => setSheetItem(item)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {search && Array.from(itemsByCategory.values()).every((arr) => arr.length === 0) && (
          <div className="au-empty">
            <h3 className="au-empty__title">Nichts gefunden</h3>
            <p className="au-empty__text">Suche „{search}" hat keine Treffer. Probier was anderes.</p>
          </div>
        )}

        {/* === FOOTER === */}
        <footer className="au-footer">
          <div className="au-footer__inner">
            <h3 className="au-footer__title">{location.name}</h3>
            <div className="au-footer__details">
              {location.adresse && <>{location.adresse}<br /></>}
              {(location.plz || location.stadt) && <>{location.plz} {location.stadt}<br /></>}
              {location.telefon && <a href={`tel:${location.telefon}`} style={{ color: 'inherit' }}>{location.telefon}</a>}
            </div>
            <div className="au-footer__trust">
              Sichere Bestellung über{' '}
              <a href="https://mise-gastro.de">mise</a>
              {' · '}
              <a href="/agb">AGB</a> · <a href="/datenschutz">Datenschutz</a> ·{' '}
              <a href="/impressum">Impressum</a>
            </div>
          </div>
        </footer>
      </div>

      {/* === ITEM DETAIL SHEET === */}
      <ItemDetailSheet
        open={sheetItem !== null}
        onClose={() => setSheetItem(null)}
        item={
          sheetItem
            ? {
                id: sheetItem.id,
                name: sheetItem.name,
                description: sheetItem.beschreibung,
                basePrice: sheetItem.preis,
                imageUrl: sheetItem.bild_url,
                optionGroups: sheetItem.option_groups ?? [],
              }
            : null
        }
        onAdd={(qty) => {
          if (!sheetItem) return;
          for (let i = 0; i < qty; i++) addItem(sheetItem.id);
        }}
      />

      {/* === CART BOTTOM SHEET === */}
      {cartSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Warenkorb"
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end',
          }}
          onClick={() => setCartSheetOpen(false)}
        >
          <div
            style={{
              width: '100%', maxHeight: '88vh',
              background: 'var(--surface, #fff)',
              borderRadius: '20px 20px 0 0',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              animation: 'au-slide-up 0.28s cubic-bezier(0.32,0.72,0,1) both',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <style>{`@keyframes au-slide-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
            {/* Handle + Header */}
            <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(0,0,0,0.12)', margin: '0 auto 16px' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', opacity: 0.5 }}>Dein Warenkorb</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                    {totalItems === 0 ? 'Noch leer' : `${totalItems} Artikel`}
                  </div>
                </div>
                <button
                  aria-label="Schließen"
                  onClick={() => setCartSheetOpen(false)}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: 'none', background: 'rgba(0,0,0,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 18, color: 'inherit',
                  }}
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Items list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
              {totalItems === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.5 }}>
                  <ShoppingBag size={40} strokeWidth={1.2} style={{ margin: '0 auto 12px', display: 'block' }} />
                  <div style={{ fontWeight: 600 }}>Noch nichts im Warenkorb</div>
                </div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {Array.from(cart.entries()).map(([itemId, qty]) => {
                    const item = items.find((i) => i.id === itemId);
                    if (!item) return null;
                    return (
                      <li key={itemId} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 0',
                        borderBottom: '1px solid rgba(0,0,0,0.06)',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>{item.name}</div>
                          <div style={{ fontSize: '0.8rem', opacity: 0.55 }}>{formatEuro(item.preis)} €</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <button
                            onClick={() => removeItem(itemId)}
                            style={{
                              width: 28, height: 28, borderRadius: '50%',
                              border: '1.5px solid rgba(0,0,0,0.12)', background: 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', fontSize: 16, fontWeight: 700,
                            }}
                          >
                            <Minus size={13} strokeWidth={2.5} />
                          </button>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', minWidth: 20, textAlign: 'center' }}>{qty}</span>
                          <button
                            onClick={() => addItem(itemId)}
                            style={{
                              width: 28, height: 28, borderRadius: '50%',
                              border: '1.5px solid rgba(0,0,0,0.12)', background: 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', fontSize: 16, fontWeight: 700,
                            }}
                          >
                            <Plus size={13} strokeWidth={2.5} />
                          </button>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', width: 56, textAlign: 'right', flexShrink: 0 }}>
                          {formatEuro(item.preis * qty)} €
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Summary + CTA */}
            {totalItems > 0 && (
              <div style={{ padding: '16px 20px 24px', borderTop: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', opacity: 0.6 }}>
                    <span>Zwischensumme</span>
                    <span>{formatEuro(total)} €</span>
                  </div>
                  {orderType === 'lieferung' && deliveryFee > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', opacity: 0.6 }}>
                      <span>Liefergebühr</span>
                      <span>{formatEuro(deliveryFee)} €</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.05rem', marginTop: 4 }}>
                    <span>Gesamt</span>
                    <span>{formatEuro(total + (orderType === 'lieferung' ? deliveryFee : 0))} €</span>
                  </div>
                </div>

                {/* Live-ETA-Hinweis vor Checkout */}
                {orderType === 'lieferung' && liveEta.ready && remainingToMin === 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                    padding: '8px 12px', borderRadius: 10,
                    background: liveEta.load === 'busy' ? 'rgba(239,68,68,0.08)' : liveEta.load === 'normal' ? 'rgba(251,191,36,0.1)' : 'rgba(34,197,94,0.08)',
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: liveEta.load === 'busy' ? '#ef4444' : liveEta.load === 'normal' ? '#fbbf24' : '#22c55e',
                    }} />
                    <span style={{
                      fontSize: '0.78rem', fontWeight: 600,
                      color: liveEta.load === 'busy' ? '#dc2626' : liveEta.load === 'normal' ? '#d97706' : '#16a34a',
                    }}>
                      ~{liveEta.etaMin} Min Lieferzeit
                      {liveEta.load === 'busy' ? ' · Gerade viel los' : liveEta.load === 'normal' ? ' · Normal ausgelastet' : ' · Küche bereit'}
                    </span>
                  </div>
                )}

                {/* Min-Bestellwert nicht erreicht */}
                {orderType === 'lieferung' && remainingToMin > 0 && (
                  <div style={{
                    padding: '8px 12px', borderRadius: 10, marginBottom: 12,
                    background: 'rgba(251,191,36,0.12)',
                    fontSize: '0.8rem', fontWeight: 600, color: '#92400e',
                  }}>
                    Noch <strong>{formatEuro(remainingToMin)} €</strong> bis zum Mindestbestellwert
                  </div>
                )}

                <button
                  disabled={orderType === 'lieferung' && remainingToMin > 0}
                  style={{
                    width: '100%', height: 52, borderRadius: 14,
                    border: 'none', cursor: orderType === 'lieferung' && remainingToMin > 0 ? 'not-allowed' : 'pointer',
                    background: orderType === 'lieferung' && remainingToMin > 0
                      ? 'rgba(0,0,0,0.08)'
                      : 'var(--brand-primary, var(--au-brand, #4F46E5))',
                    color: orderType === 'lieferung' && remainingToMin > 0 ? 'rgba(0,0,0,0.35)' : '#fff',
                    fontWeight: 700, fontSize: '1rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                  onClick={() => {
                    if (orderType === 'lieferung' && remainingToMin > 0) return;
                    // Checkout-Flow (wird in einem späteren Phase ergänzt)
                    setCartSheetOpen(false);
                    window.location.href = `mailto:?subject=Bestellung+${location.name}`;
                  }}
                >
                  <ShoppingBag size={18} strokeWidth={2} />
                  Zur Kasse · {formatEuro(total + (orderType === 'lieferung' ? deliveryFee : 0))} €
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === MOBILE CART BAR === */}
      <div
        className="au-cart-bar"
        data-hidden={totalItems === 0}
        data-pulse={pulse}
        role="region"
        aria-label="Warenkorb"
      >
        <div className="au-cart-bar__left">
          <span className="au-cart-bar__count">{totalItems}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span className="au-cart-bar__label">
              {orderType === 'lieferung' && remainingToMin > 0
                ? `Noch ${formatEuro(remainingToMin)} bis Min.`
                : 'Warenkorb ansehen'}
            </span>
            {/* Live-ETA-Hinweis: nur bei Lieferung + wenn Daten geladen */}
            {orderType === 'lieferung' && liveEta.ready && remainingToMin === 0 && (
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                opacity: 0.8,
                color: liveEta.load === 'busy' ? '#fca5a5' : liveEta.load === 'normal' ? '#fcd34d' : '#86efac',
                letterSpacing: '0.01em',
              }}>
                ~{liveEta.etaMin} Min
                {liveEta.load === 'busy' ? ' · Viel los' : liveEta.load === 'normal' ? ' · Normal' : ' · Küche frei'}
              </span>
            )}
          </div>
        </div>
        <span className="au-cart-bar__price">{formatEuro(total)}</span>
      </div>
    </div>
  );
}

// ─── Live-Tracking Banner (Shared Link) ──────────────────────────────────

function AuroraSharedTrackingBanner() {
  const [orderId, setOrderId] = React.useState<string | null>(null);
  const [trackData, setTrackData] = React.useState<{
    status: string; bestellnummer: string; etaEarliest: string | null;
  } | null>(null);
  const [nowMs, setNowMs] = React.useState(Date.now());
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = new URLSearchParams(window.location.search).get('track');
    if (id) setOrderId(id);
  }, []);

  React.useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/delivery/orders/${orderId}/tracking`);
        if (!r.ok || cancelled) return;
        const d = await r.json();
        if (!cancelled) setTrackData({ status: d.status, bestellnummer: d.bestellnummer, etaEarliest: d.eta_earliest ?? null });
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 30_000);
    const tick = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => { cancelled = true; clearInterval(iv); clearInterval(tick); };
  }, [orderId]);

  if (!orderId || dismissed || !trackData) return null;
  const isTerminal = ['geliefert', 'abgeholt', 'storniert'].includes(trackData.status);
  const secsLeft = trackData.etaEarliest
    ? Math.max(0, Math.floor((new Date(trackData.etaEarliest).getTime() - nowMs) / 1000))
    : null;
  const minsLeft = secsLeft != null ? Math.floor(secsLeft / 60) : null;
  const statusLabel: Record<string, string> = {
    neu: 'Eingegangen', bestätigt: 'Bestätigt', in_zubereitung: 'Wird zubereitet',
    fertig: 'Bereit', unterwegs: 'Unterwegs 🛵', geliefert: 'Geliefert ✅',
  };

  return (
    <div style={{
      margin: '0 0 8px',
      padding: '10px 14px',
      borderRadius: 14,
      background: isTerminal ? 'rgba(74,230,138,0.08)' : 'rgba(59,130,246,0.1)',
      border: `1px solid ${isTerminal ? 'rgba(74,230,138,0.25)' : 'rgba(59,130,246,0.25)'}`,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{isTerminal ? '✅' : '📍'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>
          {statusLabel[trackData.status] ?? trackData.status}
          {' · '}
          <span style={{ fontFamily: 'monospace', opacity: 0.7 }}>{trackData.bestellnummer}</span>
        </div>
        {!isTerminal && minsLeft != null && minsLeft > 0 && (
          <div style={{ fontSize: '0.72rem', opacity: 0.7, marginTop: 1 }}>
            <Clock size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 3 }} />
            Noch ca. {minsLeft} Min
          </div>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, flexShrink: 0, padding: 4 }}
        aria-label="Schließen"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Active Order Banner (Returning Customer) ──────────────────────────────────

function AuroraActiveOrderBanner({ locationId }: { locationId: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [banner, setBanner] = React.useState<{
    bestellnummer: string; orderId: string; isDelivery: boolean; etaMs: number; status: string;
  } | null>(null);
  const [dismissed, setDismissed] = React.useState(false);
  const [nowMs, setNowMs] = React.useState(Date.now());

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(`active_order:${locationId}`);
      if (!raw) return;
      const stored = JSON.parse(raw) as { bestellnummer: string; orderId: string; isDelivery: boolean; placedAt: number; etaMs: number };
      if (Date.now() - stored.placedAt > 3 * 60 * 60 * 1000) {
        localStorage.removeItem(`active_order:${locationId}`);
        return;
      }
      setBanner({ ...stored, status: 'bestätigt' });
    } catch {}
  }, [locationId]);

  React.useEffect(() => {
    if (!banner?.orderId) return;
    const ch = supabase
      .channel(`aurora-order-${banner.orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${banner.orderId}` },
        (payload: { new: { status?: string } }) => {
          const s = payload.new?.status;
          if (!s) return;
          if (['geliefert', 'abgeholt', 'storniert'].includes(s)) {
            localStorage.removeItem(`active_order:${locationId}`);
            setBanner(null);
          } else {
            setBanner((prev) => prev ? { ...prev, status: s } : null);
          }
        },
      )
      .subscribe();
    const tick = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => { supabase.removeChannel(ch); clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banner?.orderId]);

  if (!banner || dismissed) return null;
  const minsLeft = Math.max(0, Math.floor((banner.etaMs - nowMs) / 60_000));
  const statusLabel: Record<string, string> = {
    bestätigt: 'Bestätigt', in_zubereitung: 'Wird zubereitet',
    fertig: 'Bereit zur Abholung', unterwegs: 'Unterwegs 🛵',
  };

  return (
    <div style={{
      margin: '0 0 8px',
      padding: '10px 14px',
      borderRadius: 14,
      background: 'rgba(74,230,138,0.08)',
      border: '1px solid rgba(74,230,138,0.25)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>🧾</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>
          Bestellung {banner.bestellnummer}
          {' · '}
          <span style={{ opacity: 0.7 }}>{statusLabel[banner.status] ?? banner.status}</span>
        </div>
        {minsLeft > 0 && (
          <div style={{ fontSize: '0.72rem', opacity: 0.7, marginTop: 1 }}>
            <Clock size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 3 }} />
            Noch ca. {minsLeft} Min
          </div>
        )}
      </div>
      <a
        href={`/track/${banner.bestellnummer}`}
        style={{
          fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
          padding: '4px 10px', borderRadius: 9999,
          background: 'rgba(74,230,138,0.15)', color: 'inherit',
          textDecoration: 'none', border: '1px solid rgba(74,230,138,0.3)',
        }}
      >
        Verfolgen
      </a>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, flexShrink: 0, padding: 4 }}
        aria-label="Schließen"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────

function ProductCard({
  item,
  qty,
  onAdd,
  onRemove,
  onOpenDetail,
}: {
  item: AuroraItem;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
  onOpenDetail?: () => void;
}) {
  const verfuegbar = item.verfuegbar !== false;
  const tags = item.tags ?? [];
  const isVegan = tags.includes('vegan');
  const isPopular = item.beliebt;

  return (
    <article
      className="au-card"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-stop]')) return;
        if (!verfuegbar) return;
        if (item.option_groups && item.option_groups.length > 0) onOpenDetail?.();
        else onAdd();
      }}
    >
      <div className="au-card__media">
        {isPopular && <span className="au-card__label au-card__label--popular">★ Beliebt</span>}
        {!isPopular && isVegan && <span className="au-card__label au-card__label--new">Vegan</span>}
        {item.bild_url ? (
          <img src={item.bild_url} alt={item.name} loading="lazy" />
        ) : (
          <div className="au-card__media-fallback">{getEmojiFallback(item)}</div>
        )}
      </div>
      <div className="au-card__body">
        <h3 className="au-card__title">{item.name}</h3>
        {item.beschreibung && item.beschreibung.length >= 20 && (
          <p className="au-card__desc">{item.beschreibung}</p>
        )}
        <div className="au-card__footer">
          <span className="au-card__price">{formatEuro(item.preis)}</span>
          {verfuegbar && qty === 0 && (
            <button
              className="au-card__plus"
              data-stop
              aria-label={`${item.name} hinzufügen`}
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
            >
              <Plus size={18} strokeWidth={2.2} />
            </button>
          )}
          {verfuegbar && qty > 0 && (
            <div className="au-card__stepper" data-stop onClick={(e) => e.stopPropagation()}>
              <button
                aria-label="Weniger"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
              >
                <Minus size={14} strokeWidth={2.2} />
              </button>
              <span className="au-card__stepper-count">{qty}</span>
              <button
                aria-label="Mehr"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd();
                }}
              >
                <Plus size={14} strokeWidth={2.2} />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Helpers ─────────────────────────────────────────

function formatEuro(n: number): string {
  return n.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });
}

function getEmojiFallback(item: AuroraItem): string {
  const name = item.name.toLowerCase();
  if (name.includes('matcha') || name.includes('kaffee') || name.includes('latte') || name.includes('cappuccino') || name.includes('espresso')) return '☕';
  if (name.includes('pizza')) return '🍕';
  if (name.includes('burger')) return '🍔';
  if (name.includes('salat') || name.includes('bowl')) return '🥗';
  if (name.includes('pasta') || name.includes('nudel')) return '🍝';
  if (name.includes('sushi')) return '🍣';
  if (name.includes('cake') || name.includes('kuchen') || name.includes('torte')) return '🍰';
  if (name.includes('bier')) return '🍺';
  if (name.includes('wein')) return '🍷';
  if (name.includes('cola') || name.includes('limo') || name.includes('saft')) return '🥤';
  if (name.includes('eis') || name.includes('ice')) return '🍦';
  if (name.includes('croissant') || name.includes('brot')) return '🥐';
  return '🍽️';
}

function autoForeground(hex: string): string {
  // Calculate luminance, return white or near-black
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return '#FFFFFF';
  const num = parseInt(m[1], 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#0B0B0F' : '#FBF9F4';
}
