'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Minus, Plus, X } from 'lucide-react';
import { cn, euro } from '@/lib/utils';
import { contrastText, readableTextColor } from '@/lib/branding/contrast';
import { useModalDialog } from '@/lib/hooks/use-modal-dialog';

/**
 * MiseItemSheet — Item-Detail-Modal mit Variants/Optionen für QR-Tisch-Storefront.
 *
 * Adaption von biss-app's ItemSheet.tsx auf Mise-Datentypen + Tenant-Theme-Variables.
 * Wird vom QR-Tisch-Storefront (`/t/[token]/storefront.tsx`) gerendert wenn der
 * Gast auf ein Item mit `option_groups` klickt.
 */

export interface OptionInline {
  id: string;
  name: string;
  priceDelta: number;
  default?: boolean;
  badge?: string;
}

export interface OptionGroup {
  id: string;
  name: string;
  type: 'single' | 'multi';
  required?: boolean;
  max?: number;
  options: OptionInline[];
}

export type Selections = Record<string, string | string[]>;

export interface MiseItem {
  id: string;
  name: string;
  beschreibung: string | null;
  preis: number;
  bild_url: string | null;
  beliebt: boolean;
  allergene: string[] | null;
  tags?: string[] | null;
  option_groups?: OptionGroup[] | null;
}

interface Props {
  item: MiseItem | null;
  primary: string;
  accent: string;
  onClose: () => void;
  onAdd: (input: {
    item: MiseItem;
    qty: number;
    selections: Selections;
    extraPrice: number;
    displayName: string;
    notiz: string;
  }) => void;
}

export function MiseItemSheet({ item, primary, accent, onClose, onAdd }: Props) {
  const [qty, setQty] = useState(1);
  const [selections, setSelections] = useState<Selections>({});
  const [notiz, setNotiz] = useState('');
  const [validateError, setValidateError] = useState<string | null>(null);
  const dialogRef = useModalDialog<HTMLDivElement>(onClose, Boolean(item));
  const onPrimary = contrastText(primary);
  const primaryInk = readableTextColor(primary, '#ffffff');
  const accentInk = readableTextColor(accent, '#ffffff');

  const groups: OptionGroup[] = useMemo(() => (item?.option_groups ?? []), [item]);

  useEffect(() => {
    if (!item) return;
    setQty(1);
    setNotiz('');
    setValidateError(null);
    const next: Selections = {};
    for (const g of groups) {
      const def = g.options.find((o) => o.default);
      if (g.type === 'single' && def) next[g.id] = def.id;
    }
    setSelections(next);
  }, [item, groups]);

  const extraPrice = useMemo(() => {
    let extra = 0;
    for (const g of groups) {
      const sel = selections[g.id];
      if (!sel) continue;
      const ids = Array.isArray(sel) ? sel : [sel];
      for (const optId of ids) {
        const opt = g.options.find((o) => o.id === optId);
        if (opt) extra += opt.priceDelta;
      }
    }
    return extra;
  }, [groups, selections]);

  const unitPrice = (item?.preis ?? 0) + extraPrice;
  const totalPrice = unitPrice * qty;

  function toggleSingle(groupId: string, optionId: string) {
    setSelections((p) => ({ ...p, [groupId]: optionId }));
    setValidateError(null);
  }

  function toggleMulti(groupId: string, optionId: string, max?: number) {
    setSelections((prev) => {
      const cur = (prev[groupId] as string[]) ?? [];
      const has = cur.includes(optionId);
      let next = has ? cur.filter((x) => x !== optionId) : [...cur, optionId];
      if (max && next.length > max) next = next.slice(0, max);
      return { ...prev, [groupId]: next };
    });
  }

  function validate(): string | null {
    for (const g of groups) {
      if (g.required) {
        const sel = selections[g.id];
        if (!sel || (Array.isArray(sel) && sel.length === 0)) {
          return `Bitte „${g.name}" wählen.`;
        }
      }
    }
    return null;
  }

  function add() {
    if (!item) return;
    const err = validate();
    if (err) { setValidateError(err); return; }
    const summary = buildSummary(groups, selections);
    const displayName = summary ? `${item.name} · ${summary}` : item.name;
    onAdd({ item, qty, selections, extraPrice, displayName, notiz });
    onClose();
  }

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <button aria-label="Produktdetails schließen" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-sheet-title"
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[88dvh] sm:max-w-lg sm:rounded-3xl"
      >
        {/* Drag-Handle (mobile) */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <span className="block w-10 h-1.5 rounded-full bg-gray-200" />
        </div>

        {/* Close-Button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white shadow-lg backdrop-blur transition hover:bg-black/70"
          aria-label="Schließen"
        >
          <X size={18} />
        </button>

        {/* Body scrollbar */}
        <div className="flex-1 overflow-y-auto">
          {/* Hero */}
          <div className="relative">
            <div
              className="aspect-[4/3] sm:aspect-[16/9] relative overflow-hidden"
              style={{
                background: item.bild_url
                  ? `url(${item.bild_url}) center/cover`
                  : `linear-gradient(135deg, ${primary}, ${primary}dd)`,
              }}
            >
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 to-transparent" />
              {item.beliebt && (
                <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur shadow-lg">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: primary }}>Beliebt</span>
                </div>
              )}
            </div>
            <div className="absolute inset-x-0 bottom-0 px-5 pb-4">
              <h2 id="item-sheet-title" className="font-display font-black text-3xl md:text-4xl leading-none text-white" style={{ letterSpacing: '-0.04em' }}>
                {item.name}
              </h2>
            </div>
          </div>

          <div className="px-5 py-5 space-y-5">
            {/* Beschreibung */}
            {item.beschreibung && (
              <p className="text-base text-gray-700 leading-relaxed">{item.beschreibung}</p>
            )}

            {/* Allergene + Tags */}
            {((item.allergene?.length ?? 0) + (item.tags?.length ?? 0)) > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Allergene & Hinweise</div>
                <div className="flex flex-wrap gap-1.5">
                  {[...(item.allergene ?? []), ...(item.tags ?? [])].map((t) => (
                    <span key={t} className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Optionen */}
            {groups.map((g) => (
              <section key={g.id}>
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-gray-800">
                    {g.name}
                    {g.required && <span className="ml-2" style={{ color: accentInk }}>·</span>}
                  </h3>
                  <span className="font-mono text-[10px] text-gray-500 uppercase">
                    {g.required ? 'Pflicht' : 'Optional'}
                    {g.type === 'multi' && g.max ? ` · max ${g.max}` : ''}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {g.options.map((opt) => {
                    const sel = selections[g.id];
                    const active = g.type === 'single' ? sel === opt.id : Array.isArray(sel) && sel.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => g.type === 'single' ? toggleSingle(g.id, opt.id) : toggleMulti(g.id, opt.id, g.max)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition text-left',
                          active ? 'bg-gray-50' : 'border-gray-200 hover:bg-gray-50',
                        )}
                        style={active ? { borderColor: primaryInk } : undefined}
                      >
                        <span
                          className="w-5 h-5 flex items-center justify-center shrink-0 border-2"
                          style={{
                            borderRadius: g.type === 'single' ? 9999 : 6,
                            borderColor: active ? primaryInk : '#d1d5db',
                            background: active ? primary : 'transparent',
                          }}
                        >
                          {active && <Check size={12} strokeWidth={3} style={{ color: onPrimary }} />}
                        </span>
                        <span className="flex-1 text-sm">
                          {opt.name}
                          {opt.badge && (
                            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider" style={{ color: accentInk }}>
                              {opt.badge}
                            </span>
                          )}
                        </span>
                        {opt.priceDelta > 0 && (
                          <span className="font-mono text-xs shrink-0" style={{ color: primaryInk }}>
                            +{euro(opt.priceDelta)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}

            {/* Notiz */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 block">Anmerkung an die Küche (optional)</label>
              <input
                type="text"
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                placeholder="z.B. ohne Zwiebel, extra scharf …"
                className="min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': accent } as React.CSSProperties}
              />
            </div>

            {validateError && (
              <div className="p-3 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#991b1b' }}>
                {validateError}
              </div>
            )}
          </div>
        </div>

        {/* Footer mit Mengen + Add-Button */}
        <footer className="px-5 py-3 border-t bg-white flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full bg-gray-100 border border-gray-200">
            <button aria-label="Menge reduzieren" onClick={() => setQty(Math.max(1, qty - 1))} className="flex h-11 w-11 items-center justify-center rounded-full">
              <Minus size={14} strokeWidth={2.5} />
            </button>
            <span className="font-mono font-bold text-sm px-1 min-w-[20px] text-center">{qty}</span>
            <button aria-label="Menge erhöhen" onClick={() => setQty(qty + 1)} className="flex h-11 w-11 items-center justify-center rounded-full">
              <Plus size={14} strokeWidth={2.5} />
            </button>
          </div>
          <button
            onClick={add}
            className="flex h-12 flex-1 items-center justify-center rounded-full text-sm font-bold uppercase tracking-wider transition active:scale-[0.98]"
            style={{ background: primary, color: onPrimary }}
          >
            Hinzufügen · {euro(totalPrice)}
          </button>
        </footer>
      </div>
    </div>
  );
}

function buildSummary(groups: OptionGroup[], selections: Selections): string {
  const parts: string[] = [];
  for (const g of groups) {
    const sel = selections[g.id];
    if (!sel) continue;
    const ids = Array.isArray(sel) ? sel : [sel];
    const names = ids.map((id) => g.options.find((o) => o.id === id)?.name).filter(Boolean) as string[];
    if (names.length > 0) parts.push(names.join(' + '));
  }
  return parts.join(' · ');
}

export function makeCartLineId(itemId: string, selections: Selections): string {
  const parts: string[] = [itemId];
  const keys = Object.keys(selections).sort();
  for (const k of keys) {
    const v = selections[k];
    if (Array.isArray(v)) parts.push(`${k}:${[...v].sort().join(',')}`);
    else parts.push(`${k}:${v}`);
  }
  return parts.join('|');
}
