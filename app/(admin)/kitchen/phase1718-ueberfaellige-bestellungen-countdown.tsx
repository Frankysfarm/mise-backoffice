'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlarmClock, ChevronDown, ChevronUp, AlertOctagon } from 'lucide-react';

/**
 * Phase 1718 — Überfällige-Bestellungen-Countdown (Kitchen)
 *
 * Sortierte Liste aller Bestellungen die ihre Prep-Zeit überschritten haben.
 * Sekunden-Countdown seit Überschreitung. Eskalations-Ring bei ≥3. 1s-Tick.
 */

interface OrderItem {
  id: string;
  name?: string | null;
}

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  bestellt_am?: string | null;
  created_at?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  kunde_name?: string | null;
  items?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
  prep_min_default?: number;
}

interface UeberfaelligEntry {
  id: string;
  label: string;
  faelligMs: number;
  startMs: number;
}

const ACTIVE_STATUS = new Set([
  'accepted', 'confirmed', 'preparing', 'in_progress',
  'in_zubereitung', 'bestätigt', 'angenommen',
]);

const RING_R = 18;
const RING_CIRC = 2 * Math.PI * RING_R;

function EskalationsRing({ count }: { count: number }) {
  const pct = Math.min(1, count / 5);
  const dash = pct * RING_CIRC;

  return (
    <svg width="44" height="44" className="shrink-0">
      <circle cx="22" cy="22" r={RING_R} fill="none" stroke="currentColor"
        className="text-red-100 dark:text-red-900/30" strokeWidth="4" />
      <circle cx="22" cy="22" r={RING_R} fill="none" stroke="currentColor"
        className="text-red-500 dark:text-red-400" strokeWidth="4"
        strokeDasharray={`${dash} ${RING_CIRC}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)" />
      <text x="22" y="27" textAnchor="middle" className="fill-red-600 dark:fill-red-400"
        style={{ fontSize: 13, fontWeight: 900 }}>
        {count}
      </text>
    </svg>
  );
}

export function KitchenPhase1718UeberfaelligeBestellungenCountdown({
  orders,
  prep_min_default = 15,
}: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setTick(t => t + 1), 1_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const liste = useMemo(() => {
    const now = Date.now();
    const entries: UeberfaelligEntry[] = [];

    for (const o of orders) {
      if (!ACTIVE_STATUS.has(o.status)) continue;
      const startMs = o.bestellt_am
        ? new Date(o.bestellt_am).getTime()
        : o.created_at
        ? new Date(o.created_at).getTime()
        : null;
      if (!startMs) continue;

      const prepMs = (o.geschaetzte_zubereitung_min ?? prep_min_default) * 60_000;
      const faelligMs = startMs + prepMs;
      if (now < faelligMs) continue;

      const firstItem = o.items?.[0];
      const label = o.bestellnummer
        ? `#${o.bestellnummer}${o.kunde_name ? ` — ${o.kunde_name}` : ''}`
        : o.kunde_name ?? firstItem?.name ?? 'Bestellung';

      entries.push({ id: o.id, label, faelligMs, startMs });
    }

    return entries.sort((a, b) => a.faelligMs - b.faelligMs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, prep_min_default, tick]);

  if (liste.length === 0) return null;

  const eskalation = liste.length >= 3;

  return (
    <div className={cn(
      'rounded-xl border p-3 mb-3',
      eskalation
        ? 'border-red-300 dark:border-red-700 bg-red-50/40 dark:bg-red-950/10'
        : 'border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-950/10',
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className={cn(
          'flex items-center gap-2 text-sm font-bold',
          eskalation ? 'text-red-700 dark:text-red-300' : 'text-orange-700 dark:text-orange-300',
        )}>
          <AlarmClock className="h-4 w-4" />
          Überfällig
          <span className={cn(
            'rounded-full px-2 py-0.5 text-xs font-black',
            eskalation ? 'bg-red-500 text-white' : 'bg-orange-400 text-white',
          )}>
            {liste.length}
          </span>
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {eskalation && (
            <div className="flex items-center gap-2 rounded-lg border border-red-300 dark:border-red-700 bg-red-100 dark:bg-red-900/30 px-3 py-2">
              <AlertOctagon className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
              <span className="text-xs font-bold text-red-700 dark:text-red-300">
                ESKALATION — {liste.length} Bestellungen überfällig!
              </span>
              <div className="ml-auto">
                <EskalationsRing count={liste.length} />
              </div>
            </div>
          )}

          {liste.slice(0, 8).map(entry => {
            const nowMs = Date.now();
            const overdueSec = Math.max(0, Math.floor((nowMs - entry.faelligMs) / 1_000));
            const overdueMin = Math.floor(overdueSec / 60);
            const overdueSekRest = overdueSec % 60;
            const isSevere = overdueSec > 600;

            return (
              <div key={entry.id} className={cn(
                'flex items-center justify-between gap-2 rounded-lg border px-3 py-2',
                isSevere
                  ? 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                  : 'border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20',
              )}>
                <span className={cn(
                  'text-xs font-medium truncate',
                  isSevere ? 'text-red-700 dark:text-red-300' : 'text-orange-700 dark:text-orange-300',
                )}>
                  {entry.label}
                </span>
                <span className={cn(
                  'text-xs font-black tabular-nums shrink-0 font-mono',
                  isSevere ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400',
                )}>
                  +{overdueMin}:{overdueSekRest.toString().padStart(2, '0')}
                </span>
              </div>
            );
          })}

          <p className="text-[10px] text-muted-foreground pt-1">
            Countdown seit Überschreitung der geschätzten Zubereitungszeit
          </p>
        </div>
      )}
    </div>
  );
}
