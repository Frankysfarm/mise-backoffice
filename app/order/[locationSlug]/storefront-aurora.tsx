'use client';

import * as React from 'react';
import { Star, Plus, Minus, ShoppingBag, Search, Store, Truck, Clock, Zap } from 'lucide-react';
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
            <button className="au-cart-btn" onClick={() => alert('Warenkorb (kommt im Bottom-Sheet)')}>
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
          <span className="au-cart-bar__label">
            {orderType === 'lieferung' && remainingToMin > 0
              ? `Noch ${formatEuro(remainingToMin)} bis Min.`
              : 'Warenkorb ansehen'}
          </span>
        </div>
        <span className="au-cart-bar__price">{formatEuro(total)}</span>
      </div>
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
