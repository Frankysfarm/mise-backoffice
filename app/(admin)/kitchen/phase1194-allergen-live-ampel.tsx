'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1194 — Allergen-Live-Ampel (Kitchen)
// Farbkodierter Alert je Allergen wenn ≥3 aktive Bestellungen das gleiche Allergen enthalten

interface OrderItem {
  name?: string | null;
  product?: { allergens?: string[] | null } | null;
}

interface Order {
  id: string;
  status: string;
  items?: OrderItem[] | null;
  allergens?: string[] | null;
}

interface Props { orders: Order[] }

const ALLERGEN_SCHWELLE = 3;

const ALLERGEN_LABELS: Record<string, string> = {
  gluten: 'Gluten', nüsse: 'Nüsse', milch: 'Milch/Laktose', eier: 'Eier',
  fisch: 'Fisch', soja: 'Soja', erdnüsse: 'Erdnüsse', sesam: 'Sesam',
  sellerie: 'Sellerie', senf: 'Senf', lupinen: 'Lupinen', weichtiere: 'Weichtiere',
  krebstiere: 'Krebstiere', schwefeldioxid: 'Schwefeldioxid',
};

const ACTIVE_STATUSES = new Set(['neu', 'angenommen', 'in_zubereitung', 'bereit', 'in_progress', 'accepted', 'preparing', 'ready']);

function extractAllergens(order: Order): string[] {
  if (order.allergens?.length) return order.allergens.map(a => a.toLowerCase());
  const fromItems: string[] = [];
  for (const item of order.items ?? []) {
    for (const a of item.product?.allergens ?? []) fromItems.push(a.toLowerCase());
    // fallback: keyword scan on item name
    const name = (item.name ?? '').toLowerCase();
    if (name.includes('nuss') || name.includes('mandel') || name.includes('cashew')) fromItems.push('nüsse');
    if (name.includes('gluten') || name.includes('weizen') || name.includes('mehl')) fromItems.push('gluten');
    if (name.includes('milch') || name.includes('käse') || name.includes('sahne') || name.includes('butter')) fromItems.push('milch');
    if (name.includes('ei ') || name.includes('eier')) fromItems.push('eier');
    if (name.includes('fisch') || name.includes('lachs') || name.includes('thunfisch')) fromItems.push('fisch');
    if (name.includes('soja')) fromItems.push('soja');
    if (name.includes('sesam')) fromItems.push('sesam');
  }
  return [...new Set(fromItems)];
}

type AllergenAlert = {
  allergen: string;
  label: string;
  anzahl: number;
  level: 'kritisch' | 'warnung';
};

function computeAlerts(orders: Order[]): AllergenAlert[] {
  const active = orders.filter(o => ACTIVE_STATUSES.has(o.status));
  const counts: Record<string, number> = {};
  for (const order of active) {
    const allergens = extractAllergens(order);
    const seen = new Set<string>();
    for (const a of allergens) {
      if (!seen.has(a)) {
        seen.add(a);
        counts[a] = (counts[a] ?? 0) + 1;
      }
    }
  }

  return Object.entries(counts)
    .filter(([, n]) => n >= ALLERGEN_SCHWELLE)
    .map(([a, n]) => ({
      allergen: a,
      label: ALLERGEN_LABELS[a] ?? a,
      anzahl: n,
      level: n >= 5 ? 'kritisch' : 'warnung',
    }))
    .sort((a, b) => b.anzahl - a.anzahl);
}

export function KitchenPhase1194AllergenLiveAmpel({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const alerts = useMemo(() => computeAlerts(orders), [orders]);

  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 px-4 py-2.5 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          Allergen-Ampel: Keine Häufung aktiver Allergene
        </span>
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-xl border shadow-sm overflow-hidden',
      alerts[0]?.level === 'kritisch'
        ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
        : 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30',
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <AlertTriangle className={cn(
            'h-4 w-4 shrink-0',
            alerts[0]?.level === 'kritisch' ? 'text-red-500' : 'text-amber-500',
          )} />
          <span className={cn(
            'font-bold text-sm',
            alerts[0]?.level === 'kritisch' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300',
          )}>
            Allergen-Live-Ampel
          </span>
          <span className={cn(
            'rounded-full text-white text-[10px] font-black px-2 py-0.5',
            alerts[0]?.level === 'kritisch' ? 'bg-red-500' : 'bg-amber-500',
          )}>
            {alerts.length} Allergen{alerts.length !== 1 ? 'e' : ''} auffällig
          </span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {alerts.map(a => (
            <div
              key={a.allergen}
              className={cn(
                'flex items-center justify-between rounded-lg px-3 py-2.5 border',
                a.level === 'kritisch'
                  ? 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-700'
                  : 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700',
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  a.level === 'kritisch' ? 'bg-red-500 animate-pulse' : 'bg-amber-500',
                )} />
                <span className={cn(
                  'font-bold text-sm',
                  a.level === 'kritisch' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300',
                )}>
                  {a.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-xs font-semibold',
                  a.level === 'kritisch' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400',
                )}>
                  {a.anzahl} aktive Bestellungen
                </span>
                <span className={cn(
                  'rounded-full text-[9px] font-black px-2 py-0.5 text-white',
                  a.level === 'kritisch' ? 'bg-red-500' : 'bg-amber-500',
                )}>
                  {a.level === 'kritisch' ? '⚠ KRITISCH' : '! WARNUNG'}
                </span>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground px-1">
            Alert ab ≥{ALLERGEN_SCHWELLE} aktiven Bestellungen mit gleichem Allergen. Kritisch ab ≥5.
          </p>
        </div>
      )}
    </div>
  );
}
