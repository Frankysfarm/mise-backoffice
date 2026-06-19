'use client';

/**
 * SchichtEchtzeitGewinn — Echtzeit-Gewinnkalkulator für die aktuelle Schicht.
 *
 * Zeigt:
 *  - Umsatz (grün, links)
 *  - Kosten: Fahrerkosten + Plattformgebühr (orange, mitte)
 *  - Netto-Gewinn (matcha/rot je nach Marge, rechts)
 *  - Fortschrittsbalken: Gewinnmarge % vs. Ziel 30%
 *  - Gewinn pro Lieferung
 *
 * Daten: /api/delivery/shifts?action=current_stats, Fallback auf Mock.
 * Aktualisierung: alle 60 Sekunden + Supabase-Realtime bei Order-Updates.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { TrendingUp, Euro, Bike, Zap, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShiftStats {
  revenue: number;
  deliveries: number;
  driverCostPerDelivery: number;
  platformFeePct: number;
}

// ---------------------------------------------------------------------------
// Mock fallback
// ---------------------------------------------------------------------------

const MOCK: ShiftStats = {
  revenue: 387.5,
  deliveries: 23,
  driverCostPerDelivery: 3.5,
  platformFeePct: 5,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcProfit(s: ShiftStats): {
  driverCosts: number;
  platformFee: number;
  totalCosts: number;
  profit: number;
  marginPct: number;
  perDelivery: number;
} {
  const driverCosts = s.deliveries * s.driverCostPerDelivery;
  const platformFee = s.revenue * (s.platformFeePct / 100);
  const totalCosts = driverCosts + platformFee;
  const profit = s.revenue - totalCosts;
  const marginPct = s.revenue > 0 ? (profit / s.revenue) * 100 : 0;
  const perDelivery = s.deliveries > 0 ? profit / s.deliveries : 0;
  return { driverCosts, platformFee, totalCosts, profit, marginPct, perDelivery };
}

function marginColor(pct: number): { text: string; bar: string; bg: string } {
  if (pct >= 30) return { text: 'text-matcha-600', bar: 'bg-matcha-500', bg: 'bg-matcha-50' };
  if (pct >= 15) return { text: 'text-amber-600', bar: 'bg-amber-500', bg: 'bg-amber-50' };
  return { text: 'text-red-600', bar: 'bg-red-500', bg: 'bg-red-50' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SchichtEchtzeitGewinn() {
  const [stats, setStats] = useState<ShiftStats>(MOCK);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/shifts?action=current_stats', {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (
        typeof json.revenue === 'number' &&
        typeof json.deliveries === 'number'
      ) {
        setStats({
          revenue: json.revenue,
          deliveries: json.deliveries,
          driverCostPerDelivery: json.driverCostPerDelivery ?? MOCK.driverCostPerDelivery,
          platformFeePct: json.platformFeePct ?? MOCK.platformFeePct,
        });
      }
    } catch {
      // API unavailable — keep current data (initially mock)
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  // Initial fetch + 60-second polling
  useEffect(() => {
    fetchStats();
    intervalRef.current = setInterval(fetchStats, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchStats]);

  // Supabase realtime: refresh on any order update
  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;
    try {
      const supabase = createClient();
      channel = supabase
        .channel('schicht-echtzeit-gewinn-orders')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'customer_orders' },
          () => { fetchStats(); }
        )
        .subscribe();
    } catch {
      // Supabase not configured in this environment
    }
    return () => {
      if (channel) {
        try { createClient().removeChannel(channel); } catch { /* ignore */ }
      }
    };
  }, [fetchStats]);

  const { driverCosts, platformFee, totalCosts, profit, marginPct, perDelivery } =
    calcProfit(stats);
  const colors = marginColor(marginPct);
  const targetPct = 30;
  const barWidth = Math.min(100, Math.max(0, (marginPct / targetPct) * 100));

  return (
    <div className="w-full bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-matcha-500" />
          <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
            Schicht-Gewinn Live
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">
            {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="p-0.5 rounded text-gray-400 hover:text-matcha-600 transition-colors disabled:opacity-40"
            aria-label="Aktualisieren"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main gauge strip: 3 columns */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {/* LEFT — Umsatz */}
        <div className="flex flex-col items-center justify-center bg-emerald-50 rounded-lg px-2 py-2">
          <div className="flex items-center gap-0.5 mb-0.5">
            <Euro className="w-3 h-3 text-emerald-600" />
            <span className="text-[10px] font-medium text-emerald-700 uppercase tracking-wide">
              Umsatz
            </span>
          </div>
          <span className="text-xl font-black text-emerald-600 tabular-nums leading-none">
            {fmt(stats.revenue)}
          </span>
          <span className="text-[9px] text-emerald-500 mt-0.5">
            {stats.deliveries} Lief.
          </span>
        </div>

        {/* CENTER — Kosten */}
        <div className="flex flex-col items-center justify-center bg-orange-50 rounded-lg px-2 py-2">
          <div className="flex items-center gap-0.5 mb-0.5">
            <Bike className="w-3 h-3 text-orange-600" />
            <span className="text-[10px] font-medium text-orange-700 uppercase tracking-wide">
              Kosten
            </span>
          </div>
          <span className="text-xl font-black text-orange-600 tabular-nums leading-none">
            {fmt(totalCosts)}
          </span>
          <span className="text-[9px] text-orange-500 mt-0.5">
            Fahrer {fmt(driverCosts)} + Plattf. {fmt(platformFee)}
          </span>
        </div>

        {/* RIGHT — Gewinn */}
        <div
          className={`flex flex-col items-center justify-center rounded-lg px-2 py-2 ${colors.bg}`}
        >
          <div className="flex items-center gap-0.5 mb-0.5">
            <TrendingUp className={`w-3 h-3 ${colors.text}`} />
            <span
              className={`text-[10px] font-medium uppercase tracking-wide ${colors.text}`}
            >
              Gewinn
            </span>
          </div>
          <span
            className={`text-xl font-black tabular-nums leading-none ${colors.text}`}
          >
            {profit >= 0 ? '' : '−'}
            {fmt(Math.abs(profit))}
          </span>
          <span className={`text-[9px] mt-0.5 ${colors.text} opacity-80`}>
            {fmt(perDelivery)} / Lief.
          </span>
        </div>
      </div>

      {/* Margin progress bar */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">
            Marge {marginPct.toFixed(1)}%
          </span>
          <span className="text-[10px] text-gray-400">Ziel 30%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        {/* Threshold markers */}
        <div className="relative w-full h-1">
          {/* 15% marker at 50% of bar (15/30) */}
          <div
            className="absolute top-0 w-px h-full bg-orange-300 opacity-60"
            style={{ left: `${(15 / targetPct) * 100}%` }}
          />
          {/* Label */}
          <span
            className="absolute text-[8px] text-orange-400 -translate-x-1/2"
            style={{ left: `${(15 / targetPct) * 100}%`, top: 0 }}
          >
            15%
          </span>
        </div>
      </div>
    </div>
  );
}

export default SchichtEchtzeitGewinn;
