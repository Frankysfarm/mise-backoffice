'use client';

/**
 * TrinkgeldUebersicht — Today's tips dashboard for the Lieferdienst manager.
 *
 * Uses GET /api/delivery/admin/tips?action=dashboard to show:
 *  - Total tips today in €
 *  - Average tip per tipped order
 *  - Per-driver tip distribution (top 5)
 *  - Tip rate % (how many orders received a tip)
 *
 * Only renders if tips have been collected today (totalEur > 0).
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Star, TrendingUp } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DriverTip {
  driverName: string;
  totalEur: number;
  count: number;
  avgEur: number;
}

interface TipDashboard {
  today: {
    totalEur: number;
    ordersWithTip: number;
    totalOrders: number;
    avgTipEur: number;
    tipRatePct: number;
  };
  drivers: DriverTip[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// ── Main Component ────────────────────────────────────────────────────────────

export function TrinkgeldUebersicht({ locationId }: { locationId: string }) {
  const [data, setData] = useState<TipDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/tips?action=dashboard`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then((d: TipDashboard | null) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  if (loading) return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 flex items-center gap-2 text-xs text-stone-400">
      <Loader2 size={13} className="animate-spin" />
      Lade Trinkgeld-Daten…
    </div>
  );

  // Don't render if no tips today
  if (!data || !data.today || data.today.totalEur <= 0) return null;

  const { today, drivers } = data;
  const topDrivers = [...drivers]
    .sort((a, b) => b.totalEur - a.totalEur)
    .slice(0, 5);

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-amber-100">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700 shrink-0">
          <Star size={14} className="fill-amber-400 text-amber-400" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-bold uppercase tracking-wider text-char">Trinkgelder Heute</div>
          <div className="text-[11px] text-amber-700 mt-0.5">
            {today.ordersWithTip} von {today.totalOrders} Bestellungen · {today.tipRatePct.toFixed(0)} % Tip-Rate
          </div>
        </div>
        <div className="text-xl font-black tabular-nums text-amber-700">{fmtEur(today.totalEur)}</div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 px-4 py-3">
        <div className="rounded-xl bg-white border border-amber-100 p-3">
          <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Ø Trinkgeld/Bestellung</div>
          <div className="text-lg font-black text-amber-700 mt-0.5 tabular-nums">{fmtEur(today.avgTipEur)}</div>
        </div>
        <div className="rounded-xl bg-white border border-amber-100 p-3">
          <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide flex items-center gap-1">
            <TrendingUp size={9} /> Tip-Rate
          </div>
          <div className={cn(
            'text-lg font-black tabular-nums mt-0.5',
            today.tipRatePct >= 30 ? 'text-matcha-700' : today.tipRatePct >= 15 ? 'text-amber-700' : 'text-stone-500',
          )}>
            {today.tipRatePct.toFixed(1)} %
          </div>
        </div>
      </div>

      {/* Driver breakdown */}
      {topDrivers.length > 0 && (
        <div className="px-4 pb-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">Top Fahrer nach Trinkgeld</div>
          <div className="space-y-1.5">
            {topDrivers.map((d, i) => {
              const pct = today.totalEur > 0 ? (d.totalEur / today.totalEur) * 100 : 0;
              return (
                <div key={d.driverName} className="flex items-center gap-2">
                  <span className="w-4 text-[10px] font-bold text-stone-400 tabular-nums">{i + 1}.</span>
                  <span className="text-[11px] font-semibold text-char truncate min-w-0 flex-1">{d.driverName}</span>
                  <div className="w-20 h-2 bg-amber-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] font-bold text-amber-700 tabular-nums w-14 text-right shrink-0">
                    {fmtEur(d.totalEur)}
                  </span>
                  <span className="text-[10px] text-stone-400 w-10 text-right shrink-0">{d.count}x</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
