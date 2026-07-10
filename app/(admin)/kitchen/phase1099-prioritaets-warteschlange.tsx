'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1099 — Prioritäts-Warteschlangen-Matrix (Kitchen)
// Welche Bestellungen zuerst bearbeiten: nach ETA-Dringlichkeit, Wartezeit, Kundenwert

interface Item { name?: string; title?: string; price?: number }
interface Order {
  id: string;
  status: string;
  created_at?: string | null;
  promised_at?: string | null;
  items?: Item[] | null;
  customer_name?: string | null;
  total?: number | null;
}
interface Props { orders: Order[] }

const PENDING_STATUSES = ['neu', 'angenommen', 'confirmed', 'new', 'pending', 'in_preparation'];
const PREP_BUFFER_MIN = 8; // minutes needed to prepare before ETA

type PriorityLevel = 'kritisch' | 'hoch' | 'mittel' | 'niedrig';

type PrioEntry = {
  orderId: string;
  displayId: string;
  customerName: string;
  minutesUntilEta: number;
  wartezeit_min: number;
  bestellwert: number;
  prioritaet: PriorityLevel;
  prioritaetsScore: number;
  itemCount: number;
};

function calcMinutesUntilEta(order: Order): number {
  if (order.promised_at) {
    return Math.round((new Date(order.promised_at).getTime() - Date.now()) / 60_000);
  }
  const created = order.created_at ? new Date(order.created_at).getTime() : Date.now();
  return Math.round((created + 35 * 60_000 - Date.now()) / 60_000);
}

function calcWartezeit(order: Order): number {
  const created = order.created_at ? new Date(order.created_at).getTime() : Date.now();
  return Math.round((Date.now() - created) / 60_000);
}

function calcPriority(entry: Omit<PrioEntry, 'prioritaet' | 'prioritaetsScore'>): {
  prioritaet: PriorityLevel;
  score: number;
} {
  // Higher score = needs attention sooner
  let score = 0;

  // ETA urgency: penalise approaching ETAs heavily
  if (entry.minutesUntilEta <= PREP_BUFFER_MIN) score += 100;
  else if (entry.minutesUntilEta <= 15) score += 60;
  else if (entry.minutesUntilEta <= 25) score += 30;
  else score += 10;

  // Waiting time bonus
  if (entry.wartezeit_min >= 20) score += 40;
  else if (entry.wartezeit_min >= 12) score += 20;
  else if (entry.wartezeit_min >= 6) score += 8;

  // Order value bonus
  if (entry.bestellwert >= 40) score += 15;
  else if (entry.bestellwert >= 20) score += 8;

  const prioritaet: PriorityLevel =
    score >= 100 ? 'kritisch' : score >= 60 ? 'hoch' : score >= 30 ? 'mittel' : 'niedrig';
  return { prioritaet, score };
}

const PRIO_COLORS: Record<PriorityLevel, string> = {
  kritisch: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300',
  hoch: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300',
  mittel: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300',
  niedrig: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300',
};

const PRIO_LABELS: Record<PriorityLevel, string> = {
  kritisch: 'Kritisch',
  hoch: 'Hoch',
  mittel: 'Mittel',
  niedrig: 'Niedrig',
};

export function KitchenPhase1099PrioritaetsWarteschlange({ orders }: Props) {
  const [open, setOpen] = useState(false);

  const queue = useMemo<PrioEntry[]>(() => {
    const pending = orders.filter(o => PENDING_STATUSES.includes(o.status ?? ''));
    return pending
      .map(o => {
        const minutesUntilEta = calcMinutesUntilEta(o);
        const wartezeit_min = calcWartezeit(o);
        const bestellwert =
          o.total ??
          (o.items ?? []).reduce((s, i) => s + (i.price ?? 0), 0);
        const itemCount = (o.items ?? []).length;
        const base = { orderId: o.id, displayId: o.id.slice(-4).toUpperCase(), customerName: o.customer_name ?? 'Kunde', minutesUntilEta, wartezeit_min, bestellwert, itemCount };
        const { prioritaet, score } = calcPriority(base);
        return { ...base, prioritaet, prioritaetsScore: score };
      })
      .sort((a, b) => b.prioritaetsScore - a.prioritaetsScore)
      .slice(0, 12);
  }, [orders]);

  const kritischCount = queue.filter(e => e.prioritaet === 'kritisch').length;

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Prioritäts-Warteschlange
          </span>
          {queue.length > 0 && (
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold border',
              kritischCount > 0
                ? 'bg-red-100 text-red-700 border-red-300'
                : 'bg-amber-100 text-amber-700 border-amber-300',
            )}>
              {queue.length} offen{kritischCount > 0 ? ` · ${kritischCount} kritisch` : ''}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-3">
          {queue.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Keine offenen Bestellungen in der Warteschlange.
            </p>
          )}

          {queue.map((entry, idx) => (
            <div
              key={entry.orderId}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-3',
                entry.prioritaet === 'kritisch'
                  ? 'border-red-300 bg-red-50 dark:bg-red-900/10'
                  : entry.prioritaet === 'hoch'
                    ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/10'
                    : 'border-border bg-muted/20',
              )}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                #{idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold">
                    #{entry.displayId}
                  </span>
                  <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                    {entry.customerName}
                  </span>
                  <span className={cn(
                    'rounded-full border px-1.5 py-0.5 text-[10px] font-bold',
                    PRIO_COLORS[entry.prioritaet],
                  )}>
                    {PRIO_LABELS[entry.prioritaet]}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    ETA: {entry.minutesUntilEta <= 0 ? 'Überfällig' : `${entry.minutesUntilEta} Min`}
                  </span>
                  <span>Warten: {entry.wartezeit_min} Min</span>
                  {entry.bestellwert > 0 && (
                    <span className="font-medium text-foreground">
                      {entry.bestellwert.toFixed(2)} €
                    </span>
                  )}
                  <span>{entry.itemCount} Artikel</span>
                </div>
                {entry.minutesUntilEta <= PREP_BUFFER_MIN && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    Jetzt zubereiten — ETA in {entry.minutesUntilEta <= 0 ? 'Kürze überschritten' : `${entry.minutesUntilEta} Min`}
                  </div>
                )}
              </div>
            </div>
          ))}

          {queue.length > 0 && (
            <p className="text-[10px] text-muted-foreground text-center pt-1">
              Score basiert auf ETA-Dringlichkeit, Wartezeit und Bestellwert.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
