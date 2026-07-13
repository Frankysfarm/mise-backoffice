'use client';

// Phase 1295 — Live-Gericht-Wartezeit-Uhr (Kitchen)
// Fortschrittsring mit Zubereitungs-Verbleibzeit je aktiver Bestellung + Überfällig-Animation
// Props: orders (aktive Bestellungen mit prep_time_minutes + started_at) · kein API-Call

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderInput {
  id: string;
  display_id?: string;
  status?: string;
  prep_time_minutes?: number;
  started_at?: string;
  created_at?: string;
  items?: Array<{ name?: string; quantity?: number }>;
}

interface Props {
  orders: OrderInput[];
}

function getVerbleibendeSeconds(order: OrderInput): number {
  const base = order.started_at ?? order.created_at ?? new Date().toISOString();
  const startMs = new Date(base).getTime();
  const prepMs = (order.prep_time_minutes ?? 15) * 60 * 1000;
  const fertigMs = startMs + prepMs;
  const verbleibendeMs = fertigMs - Date.now();
  return Math.round(verbleibendeMs / 1000);
}

function formatTime(sek: number): string {
  if (sek <= 0) return 'Überfällig';
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function ProgressRing({
  prozent,
  ueberfaellig,
  label,
}: {
  prozent: number;
  ueberfaellig: boolean;
  label: string;
}) {
  const r = 22;
  const umfang = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, prozent)) * umfang;
  const ringColor = ueberfaellig ? '#ef4444' : prozent > 0.75 ? '#f59e0b' : '#22c55e';

  return (
    <div className="relative flex items-center justify-center w-14 h-14">
      <svg width="56" height="56" className={cn('rotate-[-90deg]', ueberfaellig && 'animate-pulse')}>
        <circle cx="28" cy="28" r={r} strokeWidth="4" stroke="#e5e7eb" fill="none" />
        <circle
          cx="28" cy="28" r={r}
          strokeWidth="4"
          stroke={ringColor}
          fill="none"
          strokeDasharray={`${dash} ${umfang}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {ueberfaellig ? (
          <AlertTriangle className="h-4 w-4 text-red-500" />
        ) : (
          <span className="text-[9px] font-bold text-stone-700 dark:text-stone-200">{label}</span>
        )}
      </div>
    </div>
  );
}

export function KitchenPhase1295LiveGerichtWartezeitUhr({ orders }: Props) {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  // Update every second when open
  useMemo(() => {
    if (!open) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [open]);

  const aktiveBestellungen = useMemo(
    () =>
      orders
        .filter(o => ['accepted', 'preparing', 'cooking', 'in_progress', 'ready'].includes(o.status ?? ''))
        .map(o => {
          const verblSek = getVerbleibendeSeconds(o);
          const prepSek = (o.prep_time_minutes ?? 15) * 60;
          const prozent = prepSek > 0 ? Math.max(0, (prepSek - Math.max(0, verblSek)) / prepSek) : 1;
          return { ...o, verblSek, prozent, ueberfaellig: verblSek <= 0 };
        })
        .sort((a, b) => a.verblSek - b.verblSek),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, tick],
  );

  const ueberfaelligCount = aktiveBestellungen.filter(o => o.ueberfaellig).length;

  if (aktiveBestellungen.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 text-white',
          ueberfaelligCount > 0 ? 'bg-red-600 dark:bg-red-700' : 'bg-indigo-600 dark:bg-indigo-700',
        )}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-semibold">Live-Wartezeit-Uhren</span>
          {ueberfaelligCount > 0 && (
            <span className="text-[10px] font-bold bg-white/20 rounded-full px-2 py-0.5 animate-pulse">
              {ueberfaelligCount}× ÜBERFÄLLIG
            </span>
          )}
          <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">
            {aktiveBestellungen.length} aktiv
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {aktiveBestellungen.map(o => (
              <div
                key={o.id}
                className={cn(
                  'rounded-xl p-3 flex flex-col items-center gap-2 border',
                  o.ueberfaellig
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                    : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700',
                )}
              >
                <ProgressRing
                  prozent={o.prozent}
                  ueberfaellig={o.ueberfaellig}
                  label={formatTime(o.verblSek)}
                />
                <div className="text-center">
                  <div className={cn(
                    'text-[10px] font-bold',
                    o.ueberfaellig ? 'text-red-600 dark:text-red-400' : 'text-stone-700 dark:text-stone-200',
                  )}>
                    #{o.display_id ?? o.id.slice(-4)}
                  </div>
                  <div className={cn(
                    'text-xs font-bold',
                    o.ueberfaellig ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-stone-600 dark:text-stone-300',
                  )}>
                    {formatTime(o.verblSek)}
                  </div>
                  {o.items?.[0] && (
                    <div className="text-[9px] text-stone-400 dark:text-stone-500 truncate max-w-[80px]">
                      {o.items[0].quantity ?? 1}× {o.items[0].name ?? '—'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
