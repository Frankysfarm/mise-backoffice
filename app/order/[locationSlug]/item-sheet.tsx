'use client';

import * as React from 'react';
import { X, Plus, Minus, ShoppingBag, ChevronLeft } from 'lucide-react';

export interface SheetOptionGroup {
  id: string;
  name: string;
  type: 'single' | 'multi';
  required: boolean;
  min?: number;
  max?: number;
  options: SheetOption[];
}

export interface SheetOption {
  id: string;
  name: string;
  priceDelta: number;
  default?: boolean;
  outOfStock?: boolean;
  badge?: string;
}

export interface SheetItem {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  optionGroups: SheetOptionGroup[];
}

interface Selection {
  groupId: string;
  optionIds: Set<string>;
}

export function ItemDetailSheet({
  item,
  open,
  onClose,
  onAdd,
}: {
  item: SheetItem | null;
  open: boolean;
  onClose: () => void;
  onAdd: (qty: number, selections: Selection[], note: string) => void;
}) {
  const [selections, setSelections] = React.useState<Map<string, Set<string>>>(new Map());
  const [qty, setQty] = React.useState(1);
  const [note, setNote] = React.useState('');
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const sheetRef = React.useRef<HTMLDivElement>(null);

  // Reset state when item changes
  React.useEffect(() => {
    if (!item) return;
    const init = new Map<string, Set<string>>();
    for (const grp of item.optionGroups) {
      const defaults = grp.options.filter((o) => o.default).map((o) => o.id);
      init.set(grp.id, new Set(defaults));
    }
    setSelections(init);
    setQty(1);
    setNote('');
    setValidationError(null);
  }, [item]);

  // Body scroll lock
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  if (!item) return null;

  function toggleOption(groupId: string, optionId: string, type: 'single' | 'multi') {
    setSelections((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(groupId) ?? []);
      if (type === 'single') {
        set.clear();
        set.add(optionId);
      } else {
        if (set.has(optionId)) set.delete(optionId);
        else set.add(optionId);
      }
      next.set(groupId, set);
      return next;
    });
  }

  // Live price calculation
  const currentSelections: Selection[] = Array.from(selections.entries()).map(([groupId, optionIds]) => ({
    groupId,
    optionIds,
  }));

  let priceDelta = 0;
  for (const sel of currentSelections) {
    const grp = item.optionGroups.find((g) => g.id === sel.groupId);
    if (!grp) continue;
    for (const optId of sel.optionIds) {
      const opt = grp.options.find((o) => o.id === optId);
      if (opt) priceDelta += opt.priceDelta;
    }
  }
  const totalPrice = (item.basePrice + priceDelta) * qty;

  function handleAdd() {
    // Validate required groups
    for (const grp of item.optionGroups) {
      if (grp.required) {
        const sel = selections.get(grp.id);
        if (!sel || sel.size === 0) {
          setValidationError(`Bitte ${grp.name} wählen`);
          // Scroll to group
          const el = sheetRef.current?.querySelector(`[data-group="${grp.id}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }
      if (grp.type === 'multi' && grp.max) {
        const sel = selections.get(grp.id);
        if (sel && sel.size > grp.max) {
          setValidationError(`${grp.name}: maximal ${grp.max} möglich`);
          return;
        }
      }
    }
    setValidationError(null);
    onAdd(qty, currentSelections, note);
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 101,
          background: 'var(--color-surface, #FFFFFF)',
          borderTopLeftRadius: 'var(--radius-modal, 24px)',
          borderTopRightRadius: 'var(--radius-modal, 24px)',
          maxHeight: '92dvh',
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 -16px 48px rgba(0, 0, 0, 0.18)',
        }}
      >
        {/* Drag-handle */}
        <div style={{ paddingTop: 8, paddingBottom: 4, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: 'rgba(0, 0, 0, 0.20)', borderRadius: 9999 }} />
        </div>

        {/* Sticky header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border, #EAE7E0)',
            background: 'var(--color-surface, #FFFFFF)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            aria-label="Zurück"
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-pill, 9999px)',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--color-ink, #0B0B0F)',
            }}
          >
            <ChevronLeft size={20} strokeWidth={1.8} />
          </button>
          <h2
            style={{
              fontFamily: 'var(--font-display, system-ui)',
              fontSize: 17,
              fontWeight: 600,
              color: 'var(--color-ink, #0B0B0F)',
              margin: 0,
              maxWidth: '70%',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {item.name}
          </h2>
          <button
            onClick={onClose}
            aria-label="Schließen"
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-pill, 9999px)',
              border: 'none',
              background: 'var(--color-surface-2, #F4ECE0)',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--color-ink, #0B0B0F)',
            }}
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {/* Image */}
          <div style={{ aspectRatio: '4/3', background: 'var(--color-surface-2)', position: 'relative' }}>
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', fontSize: 64, color: 'var(--color-ink-muted)' }}>🍽️</div>
            )}
          </div>

          {/* Title + description */}
          <div style={{ padding: '20px 16px 4px' }}>
            <h3
              style={{
                fontFamily: 'var(--font-display, system-ui)',
                fontSize: 24,
                fontWeight: 500,
                letterSpacing: '-0.015em',
                color: 'var(--color-ink, #0B0B0F)',
                margin: '0 0 8px',
              }}
            >
              {item.name}
            </h3>
            {item.description && (
              <p
                style={{
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: 'var(--color-ink-muted, #5B5B63)',
                  margin: 0,
                }}
              >
                {item.description}
              </p>
            )}
          </div>

          {/* Option groups */}
          {item.optionGroups.map((grp) => {
            const sel = selections.get(grp.id) ?? new Set<string>();
            return (
              <div key={grp.id} data-group={grp.id} style={{ padding: '20px 16px', borderTop: '1px solid var(--color-border, #EAE7E0)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--color-ink, #0B0B0F)',
                    }}
                  >
                    {grp.name}
                    {grp.required && <span style={{ color: 'var(--color-danger, #B23A3A)', marginLeft: 4 }}>*</span>}
                  </div>
                  {grp.type === 'multi' && grp.max && (
                    <div style={{ fontSize: 11, color: 'var(--color-ink-muted, #5B5B63)' }}>max {grp.max}</div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {grp.options.map((opt) => {
                    const checked = sel.has(opt.id);
                    return (
                      <label
                        key={opt.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-input, 10px)',
                          border: checked ? '1.5px solid var(--brand-primary, var(--color-ink))' : '1px solid var(--color-border, #EAE7E0)',
                          background: checked ? 'var(--color-surface-2, rgba(0,0,0,0.03))' : 'transparent',
                          cursor: opt.outOfStock ? 'not-allowed' : 'pointer',
                          opacity: opt.outOfStock ? 0.5 : 1,
                          minHeight: 48,
                          transition: 'border-color 200ms, background 200ms',
                        }}
                      >
                        <input
                          type={grp.type === 'single' ? 'radio' : 'checkbox'}
                          name={grp.id}
                          checked={checked}
                          disabled={opt.outOfStock}
                          onChange={() => !opt.outOfStock && toggleOption(grp.id, opt.id, grp.type)}
                          style={{ width: 18, height: 18, accentColor: 'var(--brand-primary, var(--color-ink))', flexShrink: 0 }}
                        />
                        <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: 'var(--color-ink, #0B0B0F)' }}>
                          {opt.name}
                          {opt.badge && (
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: 10,
                                fontWeight: 600,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                background: 'var(--color-success, #3F7A4B)',
                                color: 'white',
                                padding: '2px 6px',
                                borderRadius: 4,
                              }}
                            >
                              {opt.badge}
                            </span>
                          )}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono, system-ui)',
                            fontSize: 14,
                            fontWeight: 500,
                            color: 'var(--color-ink-muted, #5B5B63)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {opt.priceDelta === 0 ? '—' : opt.priceDelta > 0 ? `+${formatEuro(opt.priceDelta)}` : `−${formatEuro(-opt.priceDelta)}`}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Note */}
          <div style={{ padding: '20px 16px', borderTop: '1px solid var(--color-border, #EAE7E0)' }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-ink, #0B0B0F)',
                marginBottom: 8,
              }}
            >
              Anmerkung (optional)
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="z. B. ohne Zwiebeln, Zucker extra"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-input, 10px)',
                border: '1px solid var(--color-border, #EAE7E0)',
                background: 'var(--color-surface, #FFFFFF)',
                fontFamily: 'var(--font-body, system-ui)',
                fontSize: 14,
                lineHeight: 1.5,
                color: 'var(--color-ink, #0B0B0F)',
                resize: 'none',
                outline: 'none',
              }}
            />
          </div>

          {/* Quantity */}
          <div
            style={{
              padding: '16px',
              borderTop: '1px solid var(--color-border, #EAE7E0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink, #0B0B0F)' }}>Anzahl</span>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0,
                background: 'var(--color-surface-2)',
                borderRadius: 'var(--radius-pill, 9999px)',
                padding: 4,
              }}
            >
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                aria-label="Weniger"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-pill, 9999px)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--color-ink, #0B0B0F)',
                }}
              >
                <Minus size={16} strokeWidth={2} />
              </button>
              <span
                style={{
                  minWidth: 32,
                  textAlign: 'center',
                  fontFamily: 'var(--font-body, system-ui)',
                  fontSize: 16,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--color-ink, #0B0B0F)',
                }}
              >
                {qty}
              </span>
              <button
                onClick={() => setQty(qty + 1)}
                aria-label="Mehr"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-pill, 9999px)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--color-ink, #0B0B0F)',
                }}
              >
                <Plus size={16} strokeWidth={2} />
              </button>
            </div>
          </div>

          {validationError && (
            <div
              style={{
                margin: '0 16px 12px',
                padding: '10px 14px',
                background: 'rgba(178, 58, 58, 0.10)',
                border: '1px solid rgba(178, 58, 58, 0.30)',
                borderRadius: 'var(--radius-input, 10px)',
                color: 'var(--color-danger, #B23A3A)',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {validationError}
            </div>
          )}
        </div>

        {/* Sticky footer with CTA */}
        <div
          style={{
            padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
            background: 'var(--color-surface, #FFFFFF)',
            borderTop: '1px solid var(--color-border, #EAE7E0)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleAdd}
            style={{
              width: '100%',
              minHeight: 52,
              padding: '0 24px',
              borderRadius: 'var(--radius-button, 12px)',
              border: 'none',
              background: 'var(--brand-primary, var(--color-ink))',
              color: 'var(--brand-on-primary, var(--color-bg))',
              fontFamily: 'var(--font-body, system-ui)',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <ShoppingBag size={18} strokeWidth={1.8} />
              <span>In den Warenkorb</span>
            </span>
            <span style={{ fontFeatureSettings: '"tnum" 1' }}>{formatEuro(totalPrice)}</span>
          </button>
        </div>
      </div>
    </>
  );
}

function formatEuro(cents: number): string {
  return (cents).toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });
}
