'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, ChevronDown, ChevronUp, Flame } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1454 — Live-Backlog-Priorisierung (Kitchen)
// Aktive Bestellungen sortiert nach Dringlichkeit mit Countdown + Farbkodierung

interface OrderItem {
  name?: string | null;
  quantity?: number | null;
}

interface Order {
  id: string;
  status?: string | null;
  bestellt_am?: string | null;
  items?: OrderItem[] | null;
  pick_up_time?: string | null;
  angestrebte_lieferzeit?: string | null;
  kunde_name?: string | null;
}

interface Props {
  orders: Order[];
}

const AKTIVE_STATUSES = new Set(['pending', 'confirmed', 'accepted', 'preparing', 'in_zubereitung']);

function getUrgencyColor(remainMin: number | null): {
  bg: string; border: string; badge: string; ring: string; text: string; label: string;
} {
  if (remainMin === null) return {
    bg: 'bg-slate-50', border: 'border-slate-200', badge: 'bg-slate-400 text-white',
    ring: 'stroke-slate-300', text: 'text-slate-600', label: 'Unbekannt',
  };
  if (remainMin <= 0) return {
    bg: 'bg-red-50', border: 'border-red-300', badge: 'bg-red-600 text-white',
    ring: 'stroke-red-500', text: 'text-red-700', label: 'ÜBERFÄLLIG',
  };
  if (remainMin <= 5) return {
    bg: 'bg-orange-50', border: 'border-orange-300', badge: 'bg-orange-500 text-white',
    ring: 'stroke-orange-400', text: 'text-orange-700', label: 'Kritisch',
  };
  if (remainMin <= 12) return {
    bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-400 text-white',
    ring: 'stroke-amber-400', text: 'text-amber-700', label: 'Dringend',
  };
  return {
    bg: 'bg-matcha-50', border: 'border-matcha-200', badge: 'bg-matcha-500 text-white',
    ring: 'stroke-matcha-400', text: 'text-matcha-700', label: 'Normal',
  };
}

function CountdownRing({ remainMin, totalMin }: { remainMin: number | null; totalMin: number }) {
  const colors = getUrgencyColor(remainMin);
  const pct = remainMin === null ? 0 : Math.max(0, Math.min(1, remainMin / totalMin));
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;

  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0 -rotate-90">
      <circle cx="24" cy="24" r={r} fill="none" className="stroke-muted" strokeWidth="4" />
      <circle
        cx="24" cy="24" r={r} fill="none"
        className={colors.ring}
        strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
      <text
        x="24" y="24"
        textAnchor="middle" dominantBaseline="central"
        className="rotate-90 fill-current text-foreground"
        style={{ fontSize: 10, fontWeight: 700, transform: 'rotate(90deg)', transformOrigin: '24px 24px' }}
      >
        {remainMin === null ? '?' : remainMin <= 0 ? '!' : `${remainMin}`}
      </text>
    </svg>
  );
}

export function KitchenPhase1454LiveBacklogPriorisierung({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const now = Date.now();

  const rows = useMemo(() => {
    return orders
      .filter(o => AKTIVE_STATUSES.has(o.status ?? ''))
      .map(o => {
        const bestelltAm = o.bestellt_am ? new Date(o.bestellt_am).getTime() : null;
        const targetTime = o.pick_up_time
          ? new Date(o.pick_up_time).getTime()
          : o.angestrebte_lieferzeit
          ? new Date(o.angestrebte_lieferzeit).getTime()
          : bestelltAm ? bestelltAm + 25 * 60 * 1000 : null;

        const waitedMin = bestelltAm ? Math.floor((now - bestelltAm) / 60000) : null;
        const remainMin = targetTime ? Math.floor((targetTime - now) / 60000) : null;
        const totalMin = bestelltAm && targetTime ? Math.round((targetTime - bestelltAm) / 60000) : 25;

        const itemCount = o.items?.reduce((s, it) => s + (it.quantity ?? 1), 0) ?? 0;
        const displayName = o.items?.slice(0, 2).map(i => i.name ?? '—').join(', ') ?? '—';

        return { order: o, waitedMin, remainMin, totalMin: Math.max(totalMin, 1), itemCount, displayName };
      })
      .sort((a, b) => {
        const ar = a.remainMin ?? 999;
        const br = b.remainMin ?? 999;
        return ar - br;
      });
  }, [orders, now]);

  if (rows.length === 0) return null;

  const critical = rows.filter(r => (r.remainMin ?? 999) <= 5).length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Backlog-Priorisierung</span>
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
            {rows.length} aktiv
          </span>
          {critical > 0 && (
            <span className="rounded-full bg-red-500 text-white px-2 py-0.5 text-[10px] font-black animate-pulse">
              {critical} kritisch
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {rows.map(({ order, waitedMin, remainMin, totalMin, itemCount, displayName }) => {
            const colors = getUrgencyColor(remainMin);
            return (
              <div key={order.id} className={cn('flex items-center gap-3 px-4 py-2.5', colors.bg, colors.border.replace('border-', 'border-l-4 border-l-').split(' ')[0])}>
                <CountdownRing remainMin={remainMin} totalMin={totalMin} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-[10px] font-black uppercase px-1.5 py-0.5 rounded', colors.badge)}>
                      {colors.label}
                    </span>
                    <span className="text-xs font-bold truncate">{order.kunde_name ?? `#${order.id.slice(-4)}`}</span>
                    <span className="text-[10px] text-muted-foreground">{itemCount} Artikel</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate mt-0.5">{displayName}</div>
                  {waitedMin !== null && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Wartet {waitedMin} Min</span>
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {remainMin !== null ? (
                    <>
                      <div className={cn('font-mono text-lg font-black tabular-nums', colors.text)}>
                        {remainMin <= 0 ? '+' + Math.abs(remainMin) : remainMin}
                      </div>
                      <div className="text-[8px] text-muted-foreground">
                        {remainMin <= 0 ? 'Überfällig' : 'Min verbl.'}
                      </div>
                    </>
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
