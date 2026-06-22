'use client';

/**
 * KitchenKochstartAmpelBoard — Phase 405
 * Übersichtliche Ampel-Tabelle aller aktiven Bestellungen nach Kochstart-Dringlichkeit.
 * Rot: Kochstart überfällig oder < 3 Min | Gelb: 3–10 Min | Grün: > 10 Min
 */

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, Flame, AlertTriangle, CheckCircle2, Timer, RefreshCw } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items?: { name: string; menge: number }[];
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type AmpelLevel = 'rot' | 'gelb' | 'gruen' | 'fertig';

interface AmpelEntry {
  orderId: string;
  bestellnummer: string;
  kundeName: string;
  status: string;
  secsUntilCookStart: number;
  readyTargetIso: string | null;
  prepMin: number;
  level: AmpelLevel;
  timingStatus: string;
}

function useTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function formatCountdown(secs: number): string {
  if (secs < 0) {
    const abs = Math.abs(secs);
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    return `-${m}:${String(s).padStart(2, '0')}`;
  }
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function deriveLevel(secsUntilCookStart: number, timingStatus: string): AmpelLevel {
  if (timingStatus === 'done' || timingStatus === 'ready') return 'fertig';
  if (secsUntilCookStart < 0 || secsUntilCookStart <= 180) return 'rot';
  if (secsUntilCookStart <= 600) return 'gelb';
  return 'gruen';
}

const LEVEL_STYLE: Record<AmpelLevel, { border: string; bg: string; dot: string; label: string; textColor: string }> = {
  rot:    { border: 'border-red-300',    bg: 'bg-red-50',    dot: 'bg-red-500',    label: 'JETZT KOCHEN', textColor: 'text-red-700'    },
  gelb:   { border: 'border-amber-300',  bg: 'bg-amber-50',  dot: 'bg-amber-400',  label: 'Bald starten', textColor: 'text-amber-700'  },
  gruen:  { border: 'border-matcha-300', bg: 'bg-matcha-50', dot: 'bg-matcha-500', label: 'Zeit vorhanden', textColor: 'text-matcha-700' },
  fertig: { border: 'border-gray-200',   bg: 'bg-gray-50',   dot: 'bg-gray-400',   label: 'Fertig',       textColor: 'text-gray-500'   },
};

export function KitchenKochstartAmpelBoard({
  orders,
  timings,
}: {
  orders: Order[];
  timings: KitchenTiming[];
}) {
  useTick();
  const [collapsed, setCollapsed] = useState(false);

  const now = Date.now();

  const entries: AmpelEntry[] = [];

  for (const t of timings) {
    if (!['scheduled', 'cooking', 'done', 'ready'].includes(t.status)) continue;
    const order = orders.find((o) => o.id === t.order_id);
    if (!order) continue;
    if (!['bestätigt', 'in_zubereitung', 'fertig'].includes(order.status)) continue;

    let secsUntilCookStart = 9999;
    if (t.cook_start_at) {
      secsUntilCookStart = Math.floor((new Date(t.cook_start_at).getTime() - now) / 1000);
    } else if (order.bestellt_am) {
      // Fallback: Bestellzeit + Zubereitungszeit
      const prepMs = (order.geschaetzte_zubereitung_min ?? 15) * 60_000;
      const orderTime = new Date(order.bestellt_am).getTime();
      secsUntilCookStart = Math.floor((orderTime + prepMs - now) / 1000);
    }

    const level = deriveLevel(secsUntilCookStart, t.status);

    entries.push({
      orderId: order.id,
      bestellnummer: order.bestellnummer,
      kundeName: order.kunde_name,
      status: order.status,
      secsUntilCookStart,
      readyTargetIso: t.ready_target,
      prepMin: t.prep_min ?? order.geschaetzte_zubereitung_min ?? 15,
      level,
      timingStatus: t.status,
    });
  }

  // Sort: rot first, then gelb, then gruen, then fertig; within each level by secsUntilCookStart asc
  entries.sort((a, b) => {
    const levelOrder: Record<AmpelLevel, number> = { rot: 0, gelb: 1, gruen: 2, fertig: 3 };
    const lo = levelOrder[a.level] - levelOrder[b.level];
    if (lo !== 0) return lo;
    return a.secsUntilCookStart - b.secsUntilCookStart;
  });

  const rotCount  = entries.filter((e) => e.level === 'rot').length;
  const gelbCount = entries.filter((e) => e.level === 'gelb').length;

  if (entries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-matcha-50 to-white border-b border-gray-100"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-matcha-100 flex items-center justify-center">
            <ChefHat size={16} className="text-matcha-700" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-gray-900">Kochstart-Ampel</div>
            <div className="text-[11px] text-gray-500">
              {entries.length} Bestellung{entries.length !== 1 ? 'en' : ''}
              {rotCount > 0 && (
                <span className="ml-1.5 text-red-600 font-bold">• {rotCount} sofort</span>
              )}
              {gelbCount > 0 && (
                <span className="ml-1.5 text-amber-600 font-semibold">• {gelbCount} bald</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rotCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold animate-pulse">
              <Flame size={10} />
              {rotCount}
            </span>
          )}
          <span className="text-gray-400 text-xs">{collapsed ? '▼' : '▲'}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="divide-y divide-gray-100">
          {entries.map((entry) => {
            const style = LEVEL_STYLE[entry.level];
            const isOverdue = entry.secsUntilCookStart < 0 && entry.level === 'rot';
            return (
              <div
                key={entry.orderId}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 transition-colors',
                  style.bg,
                  'border-l-4',
                  style.border,
                )}
              >
                {/* Ampel-Dot */}
                <div className="shrink-0 flex flex-col items-center gap-0.5">
                  <span className={cn('w-3 h-3 rounded-full', style.dot, entry.level === 'rot' && 'animate-pulse')} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-900">#{entry.bestellnummer}</span>
                    <span className="text-[11px] text-gray-500 truncate">{entry.kundeName}</span>
                  </div>
                  <div className={cn('text-[11px] font-semibold', style.textColor)}>
                    {style.label} · {entry.prepMin} Min Zubereitung
                    {entry.readyTargetIso && (
                      <span className="text-gray-400 font-normal ml-1">
                        · Fertig um {formatTime(entry.readyTargetIso)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Countdown */}
                {entry.level !== 'fertig' && (
                  <div className="shrink-0 text-right">
                    <div className={cn(
                      'text-sm font-mono font-bold',
                      isOverdue ? 'text-red-600' : style.textColor,
                    )}>
                      {isOverdue && <AlertTriangle size={11} className="inline mr-0.5" />}
                      {formatCountdown(entry.secsUntilCookStart)}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {isOverdue ? 'überfällig' : 'bis Start'}
                    </div>
                  </div>
                )}
                {entry.level === 'fertig' && (
                  <CheckCircle2 size={16} className="shrink-0 text-gray-400" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
