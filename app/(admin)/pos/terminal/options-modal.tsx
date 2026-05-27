'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Check, Minus, Plus, X } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

type ExtraOption = { id: string; name: string; preis: number };
type ExtraGroup = {
  id: string;
  name: string;
  typ: 'size' | 'milk' | 'extra' | 'note';
  required?: boolean;
  multiple?: boolean;
  options?: ExtraOption[];
};

export type MenuItem = {
  id: string;
  name: string;
  beschreibung: string | null;
  preis: number;
  bild_url: string | null;
  beliebt: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extras: any;
};

export type SelectedExtras = Record<string, string[]>;
export type AddPayload = {
  item: MenuItem;
  qty: number;
  selected: SelectedExtras;
  extraPrice: number;
  notiz: string;
};

export function POSItemOptionsModal({
  item, onClose, onAdd,
}: {
  item: MenuItem;
  onClose: () => void;
  onAdd: (payload: AddPayload) => void;
}) {
  const groups: ExtraGroup[] = Array.isArray(item.extras) ? item.extras : [];
  const hasOptions = groups.length > 0;

  const [qty, setQty] = useState(1);
  const [selected, setSelected] = useState<SelectedExtras>(() => {
    const init: SelectedExtras = {};
    for (const g of groups) {
      if (g.required && !g.multiple && g.options?.length) init[g.id] = [g.options[0].id];
      else init[g.id] = [];
    }
    return init;
  });
  const [notiz, setNotiz] = useState('');

  const extraPrice = useMemo(() => {
    let sum = 0;
    for (const g of groups) {
      const ids = selected[g.id] ?? [];
      for (const optId of ids) {
        const opt = g.options?.find((o) => o.id === optId);
        if (opt) sum += opt.preis;
      }
    }
    return sum;
  }, [selected, groups]);

  const totalPrice = (item.preis + extraPrice) * qty;

  const allRequiredSet = groups.every(
    (g) => !g.required || (selected[g.id]?.length ?? 0) > 0,
  );

  function toggleOption(groupId: string, optionId: string, multiple?: boolean) {
    setSelected((prev) => {
      const current = prev[groupId] ?? [];
      if (multiple) {
        if (current.includes(optionId)) {
          return { ...prev, [groupId]: current.filter((x) => x !== optionId) };
        }
        return { ...prev, [groupId]: [...current, optionId] };
      }
      return { ...prev, [groupId]: [optionId] };
    });
  }

  function handleAdd() {
    if (!allRequiredSet) return;
    onAdd({ item, qty, selected, extraPrice, notiz });
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm grid items-end sm:items-center justify-center animate-in fade-in">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl max-h-[95vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom">
        {/* Image */}
        {item.bild_url && (
          <div className="relative h-44 sm:h-56 bg-gray-100 rounded-t-3xl overflow-hidden shrink-0">
            <Image src={item.bild_url} fill alt={item.name} className="object-cover" unoptimized />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 h-10 w-10 rounded-full bg-white/95 shadow-lg grid place-items-center hover:bg-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="p-5 pb-2">
            {!item.bild_url && (
              <button onClick={onClose} className="mb-2 text-sm text-muted-foreground inline-flex items-center gap-1">
                <X className="h-4 w-4" /> Abbrechen
              </button>
            )}
            <h2 className="font-display text-2xl font-black">{item.name}</h2>
            {item.beschreibung && (
              <p className="text-sm text-muted-foreground mt-1">{item.beschreibung}</p>
            )}
            <div className="mt-2 font-display text-2xl font-black text-matcha-800">
              {euro(item.preis)}
            </div>
          </div>

          {/* Option-Gruppen */}
          {hasOptions ? (
            <div className="px-5 space-y-5 pb-4">
              {groups.map((g) => (
                <OptionGroup
                  key={g.id}
                  group={g}
                  selected={selected[g.id] ?? []}
                  onToggle={(id) => toggleOption(g.id, id, g.multiple)}
                />
              ))}
            </div>
          ) : (
            <div className="px-5 pb-4">
              <div className="rounded-xl bg-gray-50 border p-3 text-sm text-muted-foreground">
                Keine Optionen — direkt zum Bon hinzufügen.
              </div>
            </div>
          )}

          {/* Sonderwunsch */}
          <div className="px-5 pb-5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              Sonderwunsch (optional)
            </label>
            <textarea
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              placeholder="z. B. ohne Zucker, extra heiß, …"
              rows={2}
              className="w-full rounded-xl border-2 bg-white px-3 py-2 text-sm focus:outline-none focus:border-matcha-700"
            />
          </div>
        </div>

        {/* Footer: Qty + Add */}
        <footer className="border-t bg-white p-4 flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 bg-gray-50 rounded-full p-1 border">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="h-11 w-11 rounded-full hover:bg-gray-200 grid place-items-center"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="font-display font-bold w-8 text-center text-lg">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="h-11 w-11 rounded-full bg-matcha-900 text-white grid place-items-center"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={handleAdd}
            disabled={!allRequiredSet}
            className="flex-1 h-13 py-3 rounded-2xl bg-matcha-900 text-white font-display font-black text-base disabled:opacity-40 hover:bg-matcha-800 inline-flex items-center justify-center gap-2"
          >
            Hinzufügen · {euro(totalPrice)}
          </button>
        </footer>
      </div>
    </div>
  );
}

function OptionGroup({
  group, selected, onToggle,
}: {
  group: ExtraGroup;
  selected: string[];
  onToggle: (optionId: string) => void;
}) {
  if (!group.options?.length && group.typ !== 'note') return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-base font-bold">{group.name}</h3>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {group.required ? 'Pflicht' : group.multiple ? 'Mehrfach OK' : 'Optional'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {group.options?.map((opt) => {
          const isSelected = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => onToggle(opt.id)}
              className={cn(
                'rounded-xl p-3 text-left border-2 transition',
                isSelected
                  ? 'bg-matcha-900 text-white border-matcha-900'
                  : 'bg-white border-gray-200 hover:border-matcha-300',
              )}
            >
              <div className="flex items-start gap-2">
                <div className={cn(
                  'h-5 w-5 rounded-full border-2 shrink-0 mt-0.5 grid place-items-center',
                  isSelected ? 'bg-white border-white' : 'border-gray-300',
                )}>
                  {isSelected && <Check className="h-3 w-3 text-matcha-900" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm leading-tight">{opt.name}</div>
                  {opt.preis > 0 && (
                    <div className={cn('text-xs mt-0.5 font-bold', isSelected ? 'opacity-80' : 'text-matcha-700')}>
                      + {euro(opt.preis)}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
