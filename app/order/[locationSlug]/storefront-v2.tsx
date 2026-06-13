'use client';

import * as React from 'react';
import { ArrowLeft, Share2, Star, Plus, Minus, ShoppingBag, Store, Truck, Search } from 'lucide-react';

export type V2OrderType = 'lieferung' | 'abholung';

export interface V2Item {
  id: string;
  category_id: string | null;
  name: string;
  beschreibung: string | null;
  preis: number;
  bild_url: string | null;
  verfuegbar: boolean;
  beliebt: boolean;
  tags: string[] | null;
  allergene: string[] | null;
}

export interface V2Category {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
}

export interface V2Location {
  id: string;
  name: string;
  adresse: string | null;
  stadt: string | null;
  plz: string | null;
  telefon: string | null;
}

export interface V2Tenant {
  name: string;
  slug: string;
  primary?: string | null;
  hero_image_url?: string | null;
  logo_url?: string | null;
  delivery_time_min?: number;
  min_order?: number;
  delivery_fee?: number;
}

export function StorefrontV2({
  location,
  tenant,
  categories,
  items,
}: {
  location: V2Location;
  tenant: V2Tenant;
  categories: V2Category[];
  items: V2Item[];
}) {
  const [orderType, setOrderType] = React.useState<V2OrderType>('lieferung');
  const [cart, setCart] = React.useState<Map<string, number>>(new Map());
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [pulse, setPulse] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [liveEta, setLiveEta] = React.useState<{
    eta_min: number;
    load: string;
    queue_signal: string;
    eta_extension_min: number;
    signal_message: string | null;
    active_orders: number | null;
    drivers_online: number | null;
  } | null>(null);

  React.useEffect(() => {
    const load = () => {
      fetch(`/api/delivery/eta/live?location_id=${location.id}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.eta_min != null) {
            setLiveEta({
              eta_min:           d.eta_min,
              load:              d.load ?? 'quiet',
              queue_signal:      d.queue_signal ?? 'normal',
              eta_extension_min: d.eta_extension_min ?? 0,
              signal_message:    d.signal_message ?? null,
              active_orders:     d.active_orders ?? null,
              drivers_online:    d.drivers_online ?? null,
            });
          }
        })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 90_000);
    return () => clearInterval(iv);
  }, [location.id]);

  // Custom accent override
  const customStyle = tenant.primary
    ? ({ '--accent': tenant.primary, '--accent-hover': darken(tenant.primary, 0.1) } as React.CSSProperties)
    : undefined;

  const itemsByCategory = React.useMemo(() => {
    const filtered = search.trim()
      ? items.filter((i) =>
          (i.name + (i.beschreibung ?? '')).toLowerCase().includes(search.toLowerCase()),
        )
      : items;
    const map = new Map<string, V2Item[]>();
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
  const reachedMin = total >= minOrder;
  const remainingToMin = Math.max(0, minOrder - total);

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

  const initialsLetter = location.name.charAt(0).toUpperCase();
  const isOpen = new Date().getHours() < 22;
  const ratingFake = 4.8;
  const ratingCountFake = 210;

  // Scroll-spy setup
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = (visible[0].target as HTMLElement).dataset.section;
          if (id) setActiveId(id);
        }
      },
      { rootMargin: '-72px 0px -60% 0px', threshold: [0, 0.5, 1] },
    );
    document.querySelectorAll('[data-section]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [categories.length]);

  return (
    <div data-v="2" style={customStyle}>
      <div className="v2-container">
        {/* === HERO === */}
        <header className="v2-hero">
          <nav className="v2-hero__nav">
            <button className="v2-icon-btn" aria-label="Zurück" onClick={() => history.back()}>
              <ArrowLeft size={18} strokeWidth={2.5} />
            </button>
            <button
              className="v2-icon-btn"
              aria-label="Teilen"
              onClick={() => {
                if (navigator.share) navigator.share({ url: window.location.href, title: location.name });
              }}
            >
              <Share2 size={18} strokeWidth={2.2} />
            </button>
          </nav>

          <div
            className="v2-hero__cover"
            style={tenant.hero_image_url ? { backgroundImage: `url(${tenant.hero_image_url})` } : undefined}
          >
            <div className="v2-hero__avatar">
              {tenant.logo_url ? <img src={tenant.logo_url} alt={location.name} /> : initialsLetter}
            </div>
          </div>

          <div className="v2-hero__body">
            <h1 className="v2-hero__name">{location.name}</h1>
            <div className="v2-hero__meta">
              <span className="v2-hero__rating">
                <Star size={13} strokeWidth={0} fill="currentColor" />
                {ratingFake.toFixed(1)}
              </span>
              <span>({ratingCountFake})</span>
              <span className="v2-hero__meta-dot" />
              {liveEta ? (
                <span style={{
                  color: liveEta.load === 'busy' ? '#ef4444' : liveEta.load === 'normal' ? '#f97316' : '#22c55e',
                  fontWeight: 700,
                }}>
                  {liveEta.eta_min}–{liveEta.eta_min + 10} min
                </span>
              ) : (
                <span>{deliveryTime}–{deliveryTime + 10} min</span>
              )}
              <span className="v2-hero__meta-dot" />
              <span>
                {orderType === 'lieferung' && deliveryFee > 0
                  ? `${formatEuro(deliveryFee)} Lieferung`
                  : 'Kostenlose Abholung'}
              </span>
              <span className="v2-hero__meta-dot" />
              <span>Min. {formatEuro(minOrder)}</span>
            </div>

            <div className="v2-hero__chips">
              <span className={`v2-info-chip ${isOpen ? 'v2-info-chip--success' : ''}`}>
                <span className="v2-info-chip__dot" />
                {isOpen ? 'Geöffnet bis 22 Uhr' : 'Geschlossen'}
              </span>
              {liveEta && orderType === 'lieferung' && (
                <span className="v2-info-chip" style={{
                  background: liveEta.load === 'busy' ? 'rgba(239,68,68,0.12)' : liveEta.load === 'normal' ? 'rgba(249,115,22,0.12)' : 'rgba(34,197,94,0.12)',
                  color: liveEta.load === 'busy' ? '#ef4444' : liveEta.load === 'normal' ? '#f97316' : '#16a34a',
                  fontWeight: 700,
                }}>
                  🍳{' '}
                  {liveEta.signal_message ?? (liveEta.load === 'busy' ? 'Viel los' : liveEta.load === 'normal' ? 'Mäßig ausgelastet' : 'Küche frei')}
                  {' · ~'}{liveEta.eta_min} Min
                  {liveEta.eta_extension_min > 0 && ` (+${liveEta.eta_extension_min} Min)`}
                  {liveEta.active_orders != null && liveEta.active_orders > 2 && (
                    <> · {liveEta.active_orders} {liveEta.active_orders === 1 ? 'Bestellung' : 'Bestellungen'} aktiv</>
                  )}
                </span>
              )}
              {(location.adresse || location.stadt) && (
                <span className="v2-info-chip">
                  📍 {[location.adresse, location.stadt].filter(Boolean).join(', ')}
                </span>
              )}
              {location.telefon && (
                <a href={`tel:${location.telefon}`} className="v2-info-chip" style={{ textDecoration: 'none' }}>
                  📞 {location.telefon}
                </a>
              )}
            </div>
          </div>

          {/* Queue-Signal-Banner: Wartezeit-Hinweis wenn Küche ausgelastet / Pause */}
          {liveEta && orderType === 'lieferung' && liveEta.queue_signal !== 'normal' && (
            <div
              style={{
                margin: '0.5rem 0 0',
                padding: '0.6rem 1rem',
                borderRadius: '0.5rem',
                background: liveEta.queue_signal === 'paused' ? 'rgba(239,68,68,0.13)' : 'rgba(245,158,11,0.13)',
                color: liveEta.queue_signal === 'paused' ? '#b91c1c' : '#92400e',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>{liveEta.queue_signal === 'paused' ? '🚫' : '⏳'}</span>
              <span>
                {liveEta.signal_message ??
                  (liveEta.queue_signal === 'paused'
                    ? 'Momentan nehmen wir keine neuen Lieferbestellungen an.'
                    : `Aktuell erhöhte Wartezeit (+${liveEta.eta_extension_min} Min) — bitte etwas mehr Zeit einplanen.`)}
              </span>
            </div>
          )}

          {/* Dynamische ETA-Leiste: zeigt Live-Auslastung als visuellen Balken */}
          {liveEta && orderType === 'lieferung' && liveEta.load && (
            <div style={{
              margin: '0.5rem 0 0',
              borderRadius: '0.75rem',
              background: 'rgba(0,0,0,0.06)',
              padding: '0.6rem 0.875rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                  Live-Auslastung
                </span>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 800,
                  color: liveEta.load === 'busy' ? '#dc2626' : liveEta.load === 'normal' ? '#d97706' : '#16a34a',
                }}>
                  {liveEta.load === 'busy' ? '🔴 Sehr ausgelastet' : liveEta.load === 'normal' ? '🟡 Mäßig ausgelastet' : '🟢 Küche frei'}
                </span>
              </div>
              {/* Load bar */}
              <div style={{ height: '4px', borderRadius: '9999px', background: 'rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '9999px',
                  width: liveEta.load === 'busy' ? '90%' : liveEta.load === 'normal' ? '55%' : '20%',
                  background: liveEta.load === 'busy' ? '#ef4444' : liveEta.load === 'normal' ? '#f59e0b' : '#22c55e',
                  transition: 'width 1s ease',
                }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.7rem' }}>
                {liveEta.active_orders != null && (
                  <span style={{ opacity: 0.65 }}>📦 {liveEta.active_orders} Bestellungen aktiv</span>
                )}
                {liveEta.drivers_online != null && (
                  <span style={{ opacity: 0.65 }}>🛵 {liveEta.drivers_online} Fahrer online</span>
                )}
                <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: '0.78rem' }}>
                  ~{liveEta.eta_min}{liveEta.eta_extension_min > 0 ? `+${liveEta.eta_extension_min}` : ''} Min
                </span>
              </div>
            </div>
          )}

          {/* Order type tabs */}
          <div className="v2-order-type" role="tablist">
            <button
              className="v2-order-type__btn"
              data-active={orderType === 'lieferung'}
              onClick={() => setOrderType('lieferung')}
              role="tab"
            >
              <Truck size={16} strokeWidth={2} /> Lieferung
            </button>
            <button
              className="v2-order-type__btn"
              data-active={orderType === 'abholung'}
              onClick={() => setOrderType('abholung')}
              role="tab"
            >
              <Store size={16} strokeWidth={2} /> Abholung
            </button>
          </div>
        </header>

        {/* === STICKY CATEGORY BAR === */}
        <nav className="v2-sticky-bar" aria-label="Kategorien">
          <div className="v2-sticky-bar__inner">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className="v2-pill"
                data-active={activeId === cat.id}
                onClick={() => {
                  document.querySelector(`[data-section="${cat.id}"]`)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  });
                }}
              >
                {cat.icon && <span aria-hidden>{cat.icon}</span>}
                {cat.name}
              </button>
            ))}
          </div>
        </nav>

        {/* === SEARCH === */}
        <div style={{ padding: '16px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 14px',
              height: 44,
              borderRadius: 'var(--r-pill)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
            }}
          >
            <Search size={16} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
            <input
              type="search"
              placeholder={`Suchen bei ${location.name}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                fontSize: 16,
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </label>
        </div>

        {/* === CATEGORIES + ITEMS === */}
        {categories.map((cat) => {
          const catItems = itemsByCategory.get(cat.id) ?? [];
          if (catItems.length === 0) return null;
          return (
            <section key={cat.id} data-section={cat.id} className="v2-section">
              <div className="v2-section__header">
                <h2 className="v2-section__title">{cat.name}</h2>
              </div>
              <div className="v2-items">
                {catItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    qty={cart.get(item.id) ?? 0}
                    onAdd={() => addItem(item.id)}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {search && Array.from(itemsByCategory.values()).every((arr) => arr.length === 0) && (
          <div className="v2-empty">
            <p className="v2-empty__title">Nichts gefunden</p>
            <p>Suche „{search}" hat keine Treffer. Probier was anderes.</p>
          </div>
        )}

        {/* === FOOTER === */}
        <footer className="v2-footer">
          <div style={{ marginBottom: 12 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{location.name}</strong>
            {location.adresse && <> · {location.adresse}</>}
            {location.stadt && <>, {location.plz} {location.stadt}</>}
            {location.telefon && (
              <>
                <br />
                <a href={`tel:${location.telefon}`}>{location.telefon}</a>
              </>
            )}
          </div>
          <div>
            Sichere Bestellung über{' '}
            <a href="https://mise-gastro.de" className="v2-footer__mise">
              mise
            </a>{' '}
            ·{' '}
            <a href="/agb">AGB</a> · <a href="/datenschutz">Datenschutz</a> ·{' '}
            <a href="/impressum">Impressum</a>
          </div>
        </footer>
      </div>

      {/* === CART BAR === */}
      <div
        className="v2-cart-bar"
        data-hidden={totalItems === 0}
        data-pulse={pulse}
        role="region"
        aria-label="Warenkorb"
      >
        <div className="v2-cart-bar__left">
          <span className="v2-cart-bar__count">{totalItems}</span>
          <span className="v2-cart-bar__label">
            {orderType === 'lieferung' && !reachedMin
              ? `Noch ${formatEuro(remainingToMin)} bis Min.`
              : 'Warenkorb ansehen'}
          </span>
        </div>
        <span className="v2-cart-bar__price">{formatEuro(total)}</span>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────

function ItemRow({
  item,
  qty,
  onAdd,
  onRemove,
}: {
  item: V2Item;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const verfuegbar = item.verfuegbar !== false;
  const tags = item.tags ?? [];
  const isVegan = tags.includes('vegan');
  const isTop = item.beliebt;

  return (
    <article
      className={`v2-item ${!verfuegbar ? 'v2-item--unavailable' : ''}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-stop]')) return;
        if (verfuegbar) onAdd();
      }}
    >
      <div className="v2-item__body">
        {(isTop || isVegan) && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            {isTop && <span className="v2-badge v2-badge--top">⭐ Beliebt</span>}
            {isVegan && <span className="v2-badge v2-badge--vegan">🌱 Vegan</span>}
          </div>
        )}
        <h3 className="v2-item__title">{item.name}</h3>
        {item.beschreibung && item.beschreibung.length >= 30 && (
          <p className="v2-item__desc">{item.beschreibung}</p>
        )}
        <div className="v2-item__price-row">
          <span className="v2-item__price">{formatEuro(item.preis)}</span>
          {!verfuegbar && (
            <span className="v2-caption v2-text-muted" style={{ fontStyle: 'italic' }}>
              Heute leider aus
            </span>
          )}
        </div>
      </div>
      <div className="v2-item__media">
        {item.bild_url ? (
          <img src={item.bild_url} alt="" loading="lazy" />
        ) : (
          <div className="v2-item__media-fallback">{getEmojiFallback(item)}</div>
        )}
        {verfuegbar && qty === 0 && (
          <button
            className="v2-item__plus"
            data-stop
            aria-label={`${item.name} hinzufügen`}
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
        )}
        {verfuegbar && qty > 0 && (
          <div className="v2-item__stepper" data-stop onClick={(e) => e.stopPropagation()}>
            <button
              aria-label="Weniger"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              <Minus size={14} strokeWidth={2.5} />
            </button>
            <span className="v2-item__stepper-count">{qty}</span>
            <button
              aria-label="Mehr"
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
            >
              <Plus size={14} strokeWidth={2.5} />
            </button>
          </div>
        )}
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

function getEmojiFallback(item: V2Item): string {
  const name = item.name.toLowerCase();
  if (name.includes('matcha') || name.includes('kaffee') || name.includes('latte')) return '☕';
  if (name.includes('pizza')) return '🍕';
  if (name.includes('burger')) return '🍔';
  if (name.includes('salat') || name.includes('bowl')) return '🥗';
  if (name.includes('pasta') || name.includes('nudel')) return '🍝';
  if (name.includes('sushi')) return '🍣';
  if (name.includes('cake') || name.includes('kuchen') || name.includes('torte')) return '🍰';
  if (name.includes('bier')) return '🍺';
  if (name.includes('wein')) return '🍷';
  if (name.includes('cola') || name.includes('limo')) return '🥤';
  if (name.includes('eis') || name.includes('ice')) return '🍦';
  return '🍽️';
}

function darken(hex: string, amount: number): string {
  if (!hex.startsWith('#')) return hex;
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - Math.floor(255 * amount));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.floor(255 * amount));
  const b = Math.max(0, (num & 0xff) - Math.floor(255 * amount));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
