'use client';

import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChevronDown, ChevronUp, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Order {
  id: string;
  status?: string;
  created_at?: string;
  prep_time?: number;
  scheduled_pickup?: string;
  items?: { name?: string; product_name?: string }[];
}

interface Props {
  orders: Order[];
  className?: string;
}

type Farbzone = 'gruen' | 'gelb' | 'rot' | 'kritisch';

function getElapsedMin(created_at?: string): number {
  if (!created_at) return 0;
  return Math.round((Date.now() - new Date(created_at).getTime()) / 60_000);
}

function getFarbe(elapsed: number, prepTarget: number): Farbzone {
  const ratio = elapsed / prepTarget;
  if (ratio < 0.6) return 'gruen';
  if (ratio < 0.85) return 'gelb';
  if (ratio < 1.0) return 'rot';
  return 'kritisch';
}

const FARBE_CONFIG: Record<Farbzone, { bg: string; border: string; text: string; label: string }> = {
  gruen:    { bg: 'bg-green-950',  border: 'border-green-800',  text: 'text-green-300',  label: 'Im Plan' },
  gelb:     { bg: 'bg-yellow-950', border: 'border-yellow-800', text: 'text-yellow-300', label: 'Bald fällig' },
  rot:      { bg: 'bg-red-950',    border: 'border-red-800',    text: 'text-red-300',    label: 'Kritisch' },
  kritisch: { bg: 'bg-red-900',    border: 'border-red-600',    text: 'text-red-200',    label: 'Überfällig!' },
};

const ACTIVE = new Set(['new', 'accepted', 'angenommen', 'preparing', 'in_preparation']);
const PREP_DEFAULT = 15;
const POLL_MS = 10_000;

export function KitchenPhase2054SmartTimingFarbkodierungsLiveMatrix({ orders, className }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), POLL_MS);
    return () => clearInterval(iv);
  }, []);

  const rows = useMemo(() => {
    return orders
      .filter(o => ACTIVE.has(o.status ?? ''))
      .map(o => {
        const elapsed = getElapsedMin(o.created_at);
        const target = o.prep_time ?? PREP_DEFAULT;
        const remaining = Math.max(0, target - elapsed);
        const farbe = getFarbe(elapsed, target);
        const pct = Math.min(100, Math.round((elapsed / target) * 100));
        const label = (o.items?.[0]?.product_name ?? o.items?.[0]?.name ?? `#${o.id.slice(-4)}`).slice(0, 22);
        return { id: o.id, elapsed, remaining, farbe, pct, label };
      })
      .sort((a, b) => {
        const order: Farbzone[] = ['kritisch', 'rot', 'gelb', 'gruen'];
        return order.indexOf(a.farbe) - order.indexOf(b.farbe);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, tick]);

  const counts = useMemo(() => {
    const c = { gruen: 0, gelb: 0, rot: 0, kritisch: 0 };
    rows.forEach(r => c[r.farbe]++);
    return c;
  }, [rows]);

  return (
    <div className={cn('rounded-xl border border-gray-800 bg-gray-900 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          Smart-Timing Farbkodierung Live
          {rows.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-blue-900 text-blue-300">
              {rows.length}
            </span>
          )}
          {counts.kritisch > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-red-900 text-red-300 animate-pulse">
              {counts.kritisch} überfällig
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Ampel-Übersicht */}
          <div className="grid grid-cols-4 gap-1.5">
            {(['gruen', 'gelb', 'rot', 'kritisch'] as Farbzone[]).map(f => {
              const cfg = FARBE_CONFIG[f];
              return (
                <div key={f} className={cn('rounded-lg px-2 py-1.5 text-center border', cfg.bg, cfg.border)}>
                  <div className={cn('text-sm font-black', cfg.text)}>{counts[f]}</div>
                  <div className="text-[9px] text-gray-400">{cfg.label}</div>
                </div>
              );
            })}
          </div>

          {rows.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Keine aktiven Bestellungen
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {rows.map(r => {
                const cfg = FARBE_CONFIG[r.farbe];
                return (
                  <div
                    key={r.id}
                    className={cn('rounded-lg border px-3 py-2 flex items-center gap-3', cfg.bg, cfg.border)}
                  >
                    {r.farbe === 'kritisch' && (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 animate-pulse" />
                    )}
                    {r.farbe === 'gruen' && (
                      <Zap className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    )}
                    {(r.farbe === 'gelb' || r.farbe === 'rot') && (
                      <Clock className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-200 truncate">{r.label}</div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-gray-700 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-1000',
                            r.farbe === 'gruen' ? 'bg-green-500' :
                            r.farbe === 'gelb'  ? 'bg-yellow-400' :
                            r.farbe === 'rot'   ? 'bg-red-500' :
                                                  'bg-red-400 animate-pulse',
                          )}
                          style={{ width: `${r.pct}%` }}
                        />
                      </div>
                    </div>
                    <div className={cn('text-right shrink-0', cfg.text)}>
                      <div className="text-xs font-black tabular-nums">
                        {r.farbe === 'kritisch' ? `+${r.elapsed - (r.elapsed - r.remaining)}` : r.remaining}
                        <span className="text-[9px] font-normal text-gray-400"> Min</span>
                      </div>
                      <div className="text-[9px] text-gray-500">{r.elapsed} vergangen</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
