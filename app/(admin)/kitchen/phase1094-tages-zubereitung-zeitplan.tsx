'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, ChevronUp, Clock, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1094 — Tages-Zubereitung-Zeitplan (Kitchen)
// Prognose welche Bestellungen in den nächsten 30 Min eintreffen + empfohlene Vorabzubereitung

interface Item { name?: string; title?: string }
interface Order {
  id: string;
  status: string;
  created_at?: string | null;
  promised_at?: string | null;
  items?: Item[] | null;
}
interface Props { orders: Order[] }

const PENDING_STATUSES = ['neu', 'angenommen', 'confirmed', 'new', 'pending'];

// Keyword → pre-preparation action
const PREP_HINTS: { keywords: string[]; hint: string; icon: string }[] = [
  { keywords: ['pizza', 'flammkuchen'], hint: 'Ofen vorheizen (220°C)', icon: '🔥' },
  { keywords: ['pasta', 'nudel', 'spaghetti', 'linguine', 'penne'], hint: 'Nudelwasser aufsetzen', icon: '🍝' },
  { keywords: ['suppe', 'bouillon', 'brühe'], hint: 'Suppe auf Temperatur bringen', icon: '🥣' },
  { keywords: ['salat', 'bowl', 'wrap'], hint: 'Zutaten kalt bereitstellen', icon: '🥗' },
  { keywords: ['friteuse', 'pommes', 'fries', 'chicken', 'nugget'], hint: 'Friteuse aufheizen (175°C)', icon: '🍟' },
  { keywords: ['burger', 'patty', 'grill'], hint: 'Grill vorheizen', icon: '🍔' },
  { keywords: ['dessert', 'tiramisu', 'brownie', 'kuchen', 'eis'], hint: 'Dessert kühlen / anrichten', icon: '🍰' },
  { keywords: ['reis', 'risotto', 'curry'], hint: 'Reis/Grundlage kochen', icon: '🍚' },
];

function inferPrepHints(items: Item[]): string[] {
  const names = items.map(i => ((i.name ?? '') + ' ' + (i.title ?? '')).toLowerCase()).join(' ');
  return PREP_HINTS.filter(p => p.keywords.some(k => names.includes(k))).map(p => `${p.icon} ${p.hint}`);
}

function minutesUntilEta(order: Order): number {
  const ref = order.promised_at ?? null;
  if (ref) {
    return Math.round((new Date(ref).getTime() - Date.now()) / 60_000);
  }
  const created = order.created_at ? new Date(order.created_at).getTime() : Date.now();
  const eta = created + 35 * 60_000;
  return Math.round((eta - Date.now()) / 60_000);
}

type ZeitplanEntry = {
  orderId: string;
  etaMin: number;
  itemCount: number;
  items: string[];
  prepHints: string[];
  dringlichkeit: 'sofort' | 'bald' | 'geplant';
};

export function KitchenPhase1094TagesZubereitungZeitplan({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const entries = useMemo<ZeitplanEntry[]>(() => {
    return orders
      .filter(o => PENDING_STATUSES.includes(o.status))
      .map(o => {
        const eta = minutesUntilEta(o);
        const items = (o.items ?? []).map(i => i.name ?? i.title ?? '').filter(Boolean);
        const hints = inferPrepHints(o.items ?? []);
        const dringlichkeit: ZeitplanEntry['dringlichkeit'] =
          eta <= 10 ? 'sofort' : eta <= 25 ? 'bald' : 'geplant';
        return {
          orderId: o.id.slice(-6).toUpperCase(),
          etaMin: eta,
          itemCount: (o.items ?? []).length,
          items,
          prepHints: hints,
          dringlichkeit,
        };
      })
      .sort((a, b) => a.etaMin - b.etaMin)
      .slice(0, 8);
  }, [orders]);

  const sofortCount = entries.filter(e => e.dringlichkeit === 'sofort').length;

  if (entries.length === 0) return null;

  const dringStyle = {
    sofort:  { badge: 'bg-red-500 text-white', row: 'border-red-100 bg-red-50/40', label: 'Sofort starten' },
    bald:    { badge: 'bg-amber-400 text-white', row: 'border-amber-100 bg-amber-50/40', label: 'Bald starten' },
    geplant: { badge: 'bg-sky-500 text-white', row: 'border-sky-100 bg-sky-50/40', label: 'Geplant' },
  };

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-orange-500" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Zubereitung-Zeitplan</span>
          {sofortCount > 0 && (
            <span className="animate-pulse rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
              {sofortCount} SOFORT
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {entries.map(e => {
            const s = dringStyle[e.dringlichkeit];
            return (
              <div key={e.orderId} className={cn('px-4 py-3', s.row)}>
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className={cn('text-[11px] font-black tabular-nums', e.etaMin <= 10 ? 'text-red-600' : e.etaMin <= 25 ? 'text-amber-600' : 'text-sky-600')}>
                      {e.etaMin > 0 ? `+${e.etaMin}m` : 'jetzt'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold">#{e.orderId}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black', s.badge)}>{s.label}</span>
                      <span className="text-[10px] text-muted-foreground">{e.itemCount} Artikel</span>
                    </div>

                    {e.items.length > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {e.items.slice(0, 3).join(' · ')}
                        {e.items.length > 3 && ` +${e.items.length - 3}`}
                      </p>
                    )}

                    {e.prepHints.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {e.prepHints.map(hint => (
                          <span key={hint} className="inline-flex items-center gap-1 rounded-full bg-orange-100 border border-orange-200 px-2 py-0.5 text-[10px] font-medium text-orange-700">
                            <Flame className="h-2.5 w-2.5" />
                            {hint}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="px-4 py-2 bg-muted/30 text-[10px] text-muted-foreground">
            {entries.length} Bestellungen · nächste 35 Min · Vorabzubereitung empfohlen
          </div>
        </div>
      )}
    </div>
  );
}
