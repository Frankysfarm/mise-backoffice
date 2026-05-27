'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check, Minus, Plus, X } from 'lucide-react';
import { ItemImage } from './item-image';
import { ALLERGEN_LABEL, type ExtraGroup, type MenuItem, type SelectedExtras } from './types';

type Props = {
  item: MenuItem | null;
  qty: number;
  onClose: () => void;
  onAddToCart: (qty: number, extras: SelectedExtras, notiz: string, extraPreis: number) => void;
};

export function ItemDetailModal({ item, qty, onClose, onAddToCart }: Props) {
  const [localQty, setLocalQty] = React.useState(1);
  const [selected, setSelected] = React.useState<SelectedExtras>({});
  const [notiz, setNotiz] = React.useState('');

  React.useEffect(() => {
    if (!item) return;
    const groups = parseExtras(item.extras);
    const initial: SelectedExtras = {};
    for (const g of groups) {
      if (g.required && !g.multiple && g.options && g.options.length > 0) {
        initial[g.id] = [g.options[0].id];
      } else {
        initial[g.id] = [];
      }
    }
    setSelected(initial);
    setLocalQty(1);
    setNotiz('');
  }, [item]);

  if (!item) return null;
  const groups = parseExtras(item.extras);

  const extraPreis = groups.reduce((sum, g) => {
    const chosen = selected[g.id] ?? [];
    const opts = g.options ?? [];
    return sum + chosen.reduce((s, id) => {
      const o = opts.find((x) => x.id === id);
      return s + (o?.preis ?? 0);
    }, 0);
  }, 0);

  const totalPreis = (item.preis + extraPreis) * localQty;
  const canAdd = groups.every((g) => !g.required || (selected[g.id]?.length ?? 0) > 0);

  function toggleOption(group: ExtraGroup, optId: string) {
    setSelected((prev) => {
      const current = prev[group.id] ?? [];
      if (group.multiple) {
        return { ...prev, [group.id]: current.includes(optId) ? current.filter((x) => x !== optId) : [...current, optId] };
      }
      return { ...prev, [group.id]: [optId] };
    });
  }

  function handleAdd() {
    if (!canAdd) return;
    onAddToCart(localQty, selected, notiz.trim(), extraPreis);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-matcha-900/60 backdrop-blur-sm sm:items-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        className="relative w-full max-w-2xl max-h-[95vh] bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col shadow-strong motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-8 motion-safe:duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero-Bild */}
        <div className="relative h-56 sm:h-72 shrink-0">
          {item.bild_url ? (
            <img src={item.bild_url} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <ItemImage item={item} />
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 h-10 w-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-soft hover:bg-white"
            aria-label="Schließen"
          >
            <X className="h-5 w-5 text-matcha-900" />
          </button>
          {item.beliebt && (
            <div className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-matcha-900">
              ⭐ Beliebt
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-5 sm:p-6">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-matcha-900 leading-tight">
              {item.name}
            </h2>
            {item.beschreibung && (
              <p className="mt-2 text-sm text-matcha-800/70 leading-relaxed">{item.beschreibung}</p>
            )}
            {item.allergene && item.allergene.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.allergene.map((a) => (
                  <span key={a} className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">
                    {ALLERGEN_LABEL[a] ?? a}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Extras-Gruppen */}
          {groups.length > 0 && (
            <div className="border-t bg-matcha-50/30">
              {groups.map((g) => (
                <ExtraGroupSection
                  key={g.id}
                  group={g}
                  selected={selected[g.id] ?? []}
                  onToggle={(optId) => toggleOption(g, optId)}
                  notiz={notiz}
                  onNotizChange={setNotiz}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-white p-4 sm:p-5 flex items-center gap-4">
          <div className="flex items-center gap-0 rounded-full border border-matcha-200 overflow-hidden">
            <button
              onClick={() => setLocalQty((q) => Math.max(1, q - 1))}
              className="h-11 w-11 flex items-center justify-center text-matcha-700 hover:bg-matcha-50"
              aria-label="Weniger"
            >
              <Minus className="h-4 w-4" />
            </button>
            <div className="w-10 text-center font-display text-lg font-bold text-matcha-900">{localQty}</div>
            <button
              onClick={() => setLocalQty((q) => q + 1)}
              className="h-11 w-11 flex items-center justify-center text-matcha-700 hover:bg-matcha-50"
              aria-label="Mehr"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className={cn(
              'flex-1 flex items-center justify-between rounded-2xl px-5 h-12 font-display font-bold shadow-soft transition',
              canAdd
                ? 'bg-matcha-900 text-matcha-50 hover:bg-matcha-800'
                : 'bg-matcha-100 text-matcha-900/40 cursor-not-allowed',
            )}
          >
            <span>{qty > 0 ? 'Aktualisieren' : 'Hinzufügen'}</span>
            <span className="font-mono tabular-nums">
              {totalPreis.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}&nbsp;€
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ExtraGroupSection({
  group: g, selected, onToggle, notiz, onNotizChange,
}: {
  group: ExtraGroup;
  selected: string[];
  onToggle: (optId: string) => void;
  notiz: string;
  onNotizChange: (v: string) => void;
}) {
  if (g.typ === 'note') {
    return (
      <div className="px-5 sm:px-6 py-4 border-b last:border-b-0">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-display text-sm font-bold text-matcha-900">{g.name}</h3>
          <span className="text-[10px] text-matcha-600">optional</span>
        </div>
        <textarea
          value={notiz}
          onChange={(e) => onNotizChange(e.target.value)}
          rows={2}
          placeholder={'z. B. "ohne Zwiebeln" oder "bitte scharf"…'}
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-matcha-700 focus:ring-2 focus:ring-matcha-500/20"
        />
      </div>
    );
  }

  const opts = g.options ?? [];
  if (opts.length === 0) return null;

  return (
    <div className="px-5 sm:px-6 py-4 border-b last:border-b-0">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-display text-sm font-bold text-matcha-900">{g.name}</h3>
        {g.required ? (
          <span className="text-[10px] font-bold text-matcha-700 uppercase tracking-wider">Pflicht</span>
        ) : (
          <span className="text-[10px] text-matcha-600">optional</span>
        )}
        {g.multiple && <span className="text-[10px] text-matcha-600">· mehrere möglich</span>}
      </div>
      <div className="space-y-1.5">
        {opts.map((o) => {
          const isSelected = selected.includes(o.id);
          return (
            <button
              key={o.id}
              onClick={() => onToggle(o.id)}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
                isSelected
                  ? 'border-matcha-700 bg-matcha-50 ring-2 ring-matcha-500/20'
                  : 'border-black/10 bg-white hover:border-matcha-400',
              )}
            >
              <div className={cn(
                'h-5 w-5 shrink-0 flex items-center justify-center',
                g.multiple ? 'rounded-md border-2' : 'rounded-full border-2',
                isSelected ? 'border-matcha-700 bg-matcha-700' : 'border-black/30',
              )}>
                {isSelected && (g.multiple
                  ? <Check className="h-3 w-3 text-white" />
                  : <span className="h-2 w-2 rounded-full bg-white" />
                )}
              </div>
              <span className="flex-1 text-sm font-medium text-matcha-900">{o.name}</span>
              {o.preis > 0 && (
                <span className="text-xs font-mono font-bold text-matcha-700">
                  +{o.preis.toFixed(2).replace('.', ',')}&nbsp;€
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function parseExtras(raw: unknown): ExtraGroup[] {
  if (!raw || !Array.isArray(raw)) return [];
  const result: ExtraGroup[] = [];
  for (const item of raw as any[]) {
    if (!item || typeof item !== 'object' || !item.id || !item.name) continue;
    result.push({
      id: String(item.id),
      name: String(item.name),
      typ: (item.typ === 'size' || item.typ === 'milk' || item.typ === 'note') ? item.typ : 'extra',
      required: !!item.required,
      multiple: !!item.multiple,
      options: Array.isArray(item.options)
        ? item.options
            .filter((o: any) => o?.id && o?.name)
            .map((o: any) => ({ id: String(o.id), name: String(o.name), preis: Number(o.preis ?? 0) }))
        : [],
    });
  }
  return result;
}
