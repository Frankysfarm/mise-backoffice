'use client';

// Phase 1272 — Multi-Allergen-Scan-Cockpit (Kitchen)
// Prüft alle aktiven Bestellungen auf 8 Hauptallergene + Farb-Ampel + Eskalation bei kritischer Kombination
// Props-basiert (orders) · rein client-seitig via useMemo

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ShieldAlert, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItem {
  name?: string | null;
  quantity?: number;
  allergens?: string[] | null;
  item?: { name?: string | null; allergens?: string[] | null } | null;
}

interface Order {
  id: string;
  status?: string | null;
  customer_name?: string | null;
  items?: OrderItem[] | null;
  allergen_notes?: string | null;
}

interface Props {
  orders: Order[];
}

const AKTIV_STATUS = new Set(['new', 'confirmed', 'in_progress', 'preparing', 'ready']);

const ALLERGENE = [
  { key: 'gluten',     label: 'Gluten',      emoji: '🌾', farbe: 'amber' },
  { key: 'nüsse',      label: 'Nüsse',       emoji: '🥜', farbe: 'red' },
  { key: 'milch',      label: 'Milch',       emoji: '🥛', farbe: 'blue' },
  { key: 'eier',       label: 'Eier',        emoji: '🥚', farbe: 'yellow' },
  { key: 'fisch',      label: 'Fisch',       emoji: '🐟', farbe: 'cyan' },
  { key: 'schalentiere', label: 'Schalen.', emoji: '🦐', farbe: 'orange' },
  { key: 'soja',       label: 'Soja',        emoji: '🫘', farbe: 'green' },
  { key: 'sesam',      label: 'Sesam',       emoji: '🌱', farbe: 'lime' },
] as const;

type AllergenKey = typeof ALLERGENE[number]['key'];

const KRITISCHE_KOMBIS: { keys: AllergenKey[]; warnung: string }[] = [
  { keys: ['nüsse', 'sesam'], warnung: 'Kritisch: Nüsse + Sesam kombiniert' },
  { keys: ['fisch', 'schalentiere'], warnung: 'Achtung: Mehrere Meeresfrüchte' },
];

const FARB_MAP: Record<string, { badge: string; dot: string }> = {
  amber:  { badge: 'bg-amber-100 text-amber-800 border-amber-200',  dot: 'bg-amber-500' },
  red:    { badge: 'bg-red-100 text-red-800 border-red-200',        dot: 'bg-red-500' },
  blue:   { badge: 'bg-blue-100 text-blue-800 border-blue-200',     dot: 'bg-blue-500' },
  yellow: { badge: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-400' },
  cyan:   { badge: 'bg-cyan-100 text-cyan-800 border-cyan-200',     dot: 'bg-cyan-500' },
  orange: { badge: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-500' },
  green:  { badge: 'bg-green-100 text-green-800 border-green-200',  dot: 'bg-green-600' },
  lime:   { badge: 'bg-lime-100 text-lime-800 border-lime-200',     dot: 'bg-lime-500' },
};

function extractAllergens(text: string): string[] {
  const low = text.toLowerCase();
  return ALLERGENE.filter(a => low.includes(a.key) || low.includes(a.label.toLowerCase())).map(a => a.key);
}

export function KitchenPhase1272MultiAllergenScanCockpit({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const { aktiveOrders, globalAllergenCount, kritischeWarnungen, ordersWithAllergens } = useMemo(() => {
    const aktive = orders.filter(o => AKTIV_STATUS.has(o.status ?? ''));

    const allergenOrderMap: { orderId: string; customerName: string; allergens: Set<AllergenKey> }[] = [];
    const globalCount: Record<AllergenKey, number> = {} as Record<AllergenKey, number>;

    for (const o of aktive) {
      const found = new Set<AllergenKey>();
      // Check order-level allergen_notes
      if (o.allergen_notes) {
        for (const k of extractAllergens(o.allergen_notes)) found.add(k as AllergenKey);
      }
      // Check item-level allergens
      for (const item of (o.items ?? [])) {
        const src = item.allergens ?? item.item?.allergens ?? [];
        for (const a of src) {
          const low = a.toLowerCase();
          for (const al of ALLERGENE) {
            if (low.includes(al.key) || low.includes(al.label.toLowerCase())) found.add(al.key);
          }
        }
        // Also scan item name for keywords
        const itemName = item.name ?? item.item?.name ?? '';
        if (itemName) for (const k of extractAllergens(itemName)) found.add(k as AllergenKey);
      }
      if (found.size > 0) {
        allergenOrderMap.push({ orderId: o.id, customerName: o.customer_name ?? `#${o.id.slice(-4)}`, allergens: found });
        for (const k of found) globalCount[k] = (globalCount[k] ?? 0) + 1;
      }
    }

    const warnungen: string[] = [];
    for (const kombi of KRITISCHE_KOMBIS) {
      const betroffene = allergenOrderMap.filter(a => kombi.keys.every(k => a.allergens.has(k)));
      if (betroffene.length > 0) warnungen.push(`${kombi.warnung} (${betroffene.length} Bestellung${betroffene.length > 1 ? 'en' : ''})`);
    }

    return { aktiveOrders: aktive.length, globalAllergenCount: globalCount, kritischeWarnungen: warnungen, ordersWithAllergens: allergenOrderMap };
  }, [orders]);

  const totalAllergenOrders = ordersWithAllergens.length;
  if (aktiveOrders === 0) return null;

  const aktiveAllergene = ALLERGENE.filter(a => (globalAllergenCount[a.key] ?? 0) > 0);

  const eskaliert = kritischeWarnungen.length > 0;

  return (
    <div className={cn('rounded-2xl border', eskaliert ? 'border-red-300 dark:border-red-700' : 'border-stone-200 dark:border-stone-700', 'bg-white dark:bg-stone-900 overflow-hidden')}>
      {/* Header */}
      <button
        className={cn('w-full flex items-center gap-3 px-5 py-4', eskaliert ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-amber-500 to-orange-600')}
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
          {eskaliert ? <ShieldAlert className="h-4 w-4 text-white" /> : <AlertTriangle className="h-4 w-4 text-white" />}
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-white">Allergen-Scan</div>
          <div className="text-[11px] text-white/80">
            {totalAllergenOrders === 0 ? 'Keine Allergen-Hinweise' : `${totalAllergenOrders} Bestellung${totalAllergenOrders > 1 ? 'en' : ''} mit Allergenen`}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-white" /> : <ChevronDown className="h-4 w-4 text-white" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* Kritische Warnungen */}
          {kritischeWarnungen.length > 0 && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 space-y-1">
              {kritischeWarnungen.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs font-semibold text-red-700 dark:text-red-300">
                  <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Allergen-Übersicht */}
          {aktiveAllergene.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Keine Allergen-Hinweise in aktiven Bestellungen
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {aktiveAllergene.map(al => {
                const cnt = globalAllergenCount[al.key] ?? 0;
                const farben = FARB_MAP[al.farbe];
                return (
                  <span key={al.key} className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold', farben.badge)}>
                    <span>{al.emoji}</span>
                    {al.label}
                    <span className={cn('rounded-full px-1 py-0.5 text-[10px] font-black text-white', farben.dot)}>{cnt}</span>
                  </span>
                );
              })}
            </div>
          )}

          {/* Bestellungen mit Allergenen */}
          {ordersWithAllergens.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {ordersWithAllergens.map(o => (
                <div key={o.orderId} className="flex items-center justify-between rounded-lg bg-stone-50 dark:bg-stone-800 px-3 py-2">
                  <span className="text-xs font-medium text-char dark:text-stone-200">{o.customerName}</span>
                  <div className="flex gap-1">
                    {[...o.allergens].map(k => {
                      const al = ALLERGENE.find(a => a.key === k);
                      return al ? <span key={k} title={al.label} className="text-sm">{al.emoji}</span> : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
