'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Activity, Users, Timer, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1468 — Live-Küchen-Kapazität (Kitchen)
// Farbkodierter Kapazitätsring: aktive Bestellungen vs. Kapazitätsgrenze;
// Zeitschätzung bis Entlastung; 60s-Polling; nach Phase1467.

interface Order {
  id: string;
  status?: string | null;
}

interface Props {
  orders: Order[];
  kapazitaetLimit?: number;
}

const ACTIVE_STATUSES = new Set(['neu', 'bestätigt', 'in_zubereitung']);

function getStatus(pct: number): 'niedrig' | 'mittel' | 'hoch' | 'ueberlastet' {
  if (pct < 50) return 'niedrig';
  if (pct < 75) return 'mittel';
  if (pct < 100) return 'hoch';
  return 'ueberlastet';
}

const STATUS_CFG = {
  niedrig:    { ring: 'stroke-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', label: 'Ruhig',       border: 'border-emerald-200 dark:border-emerald-800' },
  mittel:     { ring: 'stroke-amber-400',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',         label: 'Mittel',      border: 'border-amber-200 dark:border-amber-800' },
  hoch:       { ring: 'stroke-orange-500',  badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',     label: 'Ausgelastet', border: 'border-orange-200 dark:border-orange-800' },
  ueberlastet:{ ring: 'stroke-rose-500',    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',             label: 'Überlastet',  border: 'border-rose-300 dark:border-rose-700' },
};

const R = 28;
const CIRC = 2 * Math.PI * R;

export function KitchenPhase1468LiveKuechenKapazitaet({ orders, kapazitaetLimit = 8 }: Props) {
  const [ts, setTs] = useState(Date.now());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setTs(Date.now()), 60_000);
    return () => clearInterval(iv);
  }, []);

  const activeCount = orders.filter((o) => ACTIVE_STATUSES.has(o.status ?? '')).length;
  const inZubCount = orders.filter((o) => o.status === 'in_zubereitung').length;
  const pct = Math.min(100, Math.round((activeCount / kapazitaetLimit) * 100));
  const status = getStatus(pct);
  const cfg = STATUS_CFG[status];
  const dash = (pct / 100) * CIRC;

  return (
    <Card className={cn('overflow-hidden', cfg.border)}>
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition"
        onClick={() => setCollapsed((c) => !c)}
      >
        <Activity className="h-4 w-4 shrink-0 text-matcha-600" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">Live-Kapazität</span>
        <span className={cn('ml-2 text-[10px] font-bold rounded-full px-2 py-0.5', cfg.badge)}>{cfg.label}</span>
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
        {collapsed ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {!collapsed && (
        <div className="flex items-center gap-5 px-5 py-4">
          {/* Ring */}
          <div className="shrink-0 relative flex items-center justify-center">
            <svg width={72} height={72}>
              <circle cx={36} cy={36} r={R} fill="none" strokeWidth={7} className="stroke-muted" />
              <circle
                cx={36} cy={36} r={R} fill="none" strokeWidth={7}
                className={cn('transition-all duration-700', cfg.ring)}
                strokeDasharray={`${dash} ${CIRC}`}
                strokeLinecap="round"
                transform="rotate(-90 36 36)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-black tabular-nums leading-none">{pct}%</span>
            </div>
          </div>
          {/* Stats */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Aktiv:</span>
              <span className="font-bold tabular-nums">{activeCount} / {kapazitaetLimit}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Timer className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">In Zubereitung:</span>
              <span className="font-bold tabular-nums">{inZubCount}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700',
                  status === 'niedrig' ? 'bg-emerald-500' :
                  status === 'mittel' ? 'bg-amber-400' :
                  status === 'hoch' ? 'bg-orange-500' : 'bg-rose-500'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            {status === 'ueberlastet' && (
              <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                Kapazitätsgrenze erreicht — Priorisierung empfohlen
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
