'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Flame, ChevronDown, ChevronUp, Play, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1459 — Smart-Timing-Cockpit (Kitchen)
// Farbkodiertes Countdown-Cockpit: Bestellungen nach Dringlichkeit sortiert,
// SVG-Countdown-Ringe, Kochstart-Empfehlung und Ampel-Farbkodierung.

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
  prep_time?: number | null;
}

interface Props {
  orders: Order[];
  locationId?: string | null;
}

const ACTIVE = new Set(['pending', 'confirmed', 'accepted', 'preparing', 'in_zubereitung', 'ready_to_pick']);
const WINDOW_MIN = 30;

function getColor(rem: number | null): { bg: string; ring: string; badge: string; text: string; label: string } {
  if (rem === null) return { bg: 'bg-slate-50', ring: '#94a3b8', badge: 'bg-slate-400', text: 'text-slate-600', label: '—' };
  if (rem <= 0)  return { bg: 'bg-red-50',    ring: '#dc2626', badge: 'bg-red-600',    text: 'text-red-700',   label: 'ÜBERFÄLLIG' };
  if (rem <= 5)  return { bg: 'bg-orange-50', ring: '#f97316', badge: 'bg-orange-500', text: 'text-orange-700', label: 'Kritisch' };
  if (rem <= 12) return { bg: 'bg-amber-50',  ring: '#f59e0b', badge: 'bg-amber-400',  text: 'text-amber-700', label: 'Dringend' };
  return          { bg: 'bg-emerald-50',       ring: '#22c55e', badge: 'bg-emerald-500', text: 'text-emerald-700', label: 'Normal' };
}

function Ring({ rem, total, color }: { rem: number | null; total: number; color: string }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const pct = rem === null ? 0 : Math.max(0, Math.min(1, rem / total));
  const dash = pct * circ;
  const cx = 26;
  return (
    <svg width={52} height={52} viewBox="0 0 52 52" className="-rotate-90 shrink-0">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e2e8f0" strokeWidth={5} />
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

export function KitchenPhase1459SmartTimingCockpit({ orders, locationId }: Props) {
  const [open, setOpen] = useState(true);
  const now = Date.now();

  const rows = useMemo(() => {
    return orders
      .filter(o => o.status && ACTIVE.has(o.status))
      .map(o => {
        const target = o.angestrebte_lieferzeit
          ? new Date(o.angestrebte_lieferzeit).getTime()
          : o.bestellt_am
            ? new Date(o.bestellt_am).getTime() + WINDOW_MIN * 60_000
            : null;
        const rem = target !== null ? Math.floor((target - now) / 60_000) : null;
        const c = getColor(rem);
        const label = o.items?.map(i => `${i.quantity ?? 1}× ${i.name ?? '?'}`).join(', ') || '—';
        return { ...o, rem, c, label };
      })
      .sort((a, b) => {
        const av = a.rem ?? 9999;
        const bv = b.rem ?? 9999;
        return av - bv;
      });
  }, [orders, now]);

  const urgent = rows.filter(r => r.rem !== null && r.rem <= 5).length;

  if (rows.length === 0) return null;

  return (
    <Card className="overflow-hidden border shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-bold">Smart-Timing-Cockpit</span>
          <span className="text-[10px] text-muted-foreground font-medium">({rows.length} aktiv)</span>
          {urgent > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
              {urgent} dringend
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {rows.map(row => {
            const remText = row.rem === null
              ? '—'
              : row.rem <= 0
                ? 'JETZT!'
                : `${row.rem} Min`;
            return (
              <div key={row.id} className={cn('flex items-center gap-3 px-4 py-3', row.c.bg)}>
                <div className="relative">
                  <Ring rem={row.rem} total={WINDOW_MIN} color={row.c.ring} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={cn('text-[10px] font-black tabular-nums', row.c.text)}>
                      {row.rem === null ? '?' : row.rem <= 0 ? '!' : `${row.rem}`}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white', row.c.badge)}>
                      {row.c.label}
                    </span>
                    {row.kunde_name && (
                      <span className="text-[11px] text-muted-foreground">{row.kunde_name}</span>
                    )}
                  </div>
                  <p className="text-xs font-medium mt-0.5 truncate">{row.label}</p>
                </div>
                <div className={cn('text-right shrink-0', row.c.text)}>
                  <div className="text-sm font-black tabular-nums">{remText}</div>
                  {row.rem !== null && row.rem <= 0 && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 mt-0.5">
                      <AlertTriangle className="h-3 w-3" /> Sofort!
                    </div>
                  )}
                  {row.rem !== null && row.rem > 0 && row.rem <= 8 && (
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-orange-600 mt-0.5">
                      <Play className="h-3 w-3" /> Jetzt starten
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && urgent > 0 && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
          <span className="text-xs font-bold text-red-700">
            {urgent} {urgent === 1 ? 'Bestellung kritisch' : 'Bestellungen kritisch'} — sofort bearbeiten!
          </span>
        </div>
      )}
    </Card>
  );
}
