'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';

interface ZoneStat {
  zone: string;
  orders: number;
  avgMin: number;
  onTimePct: number;
  revenue: number;
}

const MOCK_ZONES: ZoneStat[] = [
  { zone: 'Innenstadt', orders: 18, avgMin: 24, onTimePct: 92, revenue: 540 },
  { zone: 'Nord',       orders: 11, avgMin: 31, onTimePct: 78, revenue: 310 },
  { zone: 'Süd',        orders: 8,  avgMin: 28, onTimePct: 85, revenue: 224 },
  { zone: 'West',       orders: 5,  avgMin: 38, onTimePct: 60, revenue: 145 },
  { zone: 'Ost',        orders: 4,  avgMin: 35, onTimePct: 75, revenue: 112 },
];

function trendIcon(val: number, target: number, inverse = false) {
  const good = inverse ? val <= target : val >= target;
  const ok   = inverse ? val <= target * 1.15 : val >= target * 0.85;
  if (good) return <TrendingUp size={10} className="text-matcha-500" />;
  if (ok)   return <Minus      size={10} className="text-amber-500" />;
  return        <TrendingDown  size={10} className="text-red-500" />;
}

function onTimeBg(pct: number) {
  if (pct >= 88) return 'text-matcha-700 bg-matcha-50';
  if (pct >= 75) return 'text-amber-700 bg-amber-50';
  return 'text-red-700 bg-red-50';
}
function avgMinBg(min: number) {
  if (min <= 28) return 'text-matcha-700 bg-matcha-50';
  if (min <= 35) return 'text-amber-700 bg-amber-50';
  return 'text-red-700 bg-red-50';
}

export function ZonenVergleichPanel() {
  const [zones, setZones] = useState<ZoneStat[]>(MOCK_ZONES);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/zone-stats', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.zones) && json.zones.length > 0) {
          setZones(json.zones);
        }
      }
    } catch {
      // keep mock
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, []);

  const sorted = [...zones].sort((a, b) => b.orders - a.orders);
  const maxOrders = Math.max(...sorted.map(z => z.orders), 1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-1.5">
          <MapPin size={13} className="text-matcha-600" />
          <span className="text-xs font-semibold text-gray-700">Zonen-Vergleich</span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_44px_52px_52px_52px] gap-1 px-4 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-50">
        <div>Zone</div>
        <div className="text-center">Auft.</div>
        <div className="text-center">Ø Zeit</div>
        <div className="text-center">Pünktl.</div>
        <div className="text-center">Umsatz</div>
      </div>

      <div className="divide-y divide-gray-50">
        {sorted.map((z, idx) => (
          <div key={z.zone} className="grid grid-cols-[1fr_44px_52px_52px_52px] gap-1 items-center px-4 py-2">
            {/* Zone name + bar */}
            <div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-gray-700">{z.zone}</span>
                {idx === 0 && (
                  <span className="text-[8px] bg-matcha-100 text-matcha-700 px-1 rounded-full font-bold">Top</span>
                )}
              </div>
              <div className="mt-0.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-matcha-400 rounded-full"
                  style={{ width: `${(z.orders / maxOrders) * 100}%` }}
                />
              </div>
            </div>

            {/* Orders */}
            <div className="text-center">
              <span className="text-[11px] font-black text-gray-700 tabular-nums">{z.orders}</span>
            </div>

            {/* Avg time */}
            <div className="flex items-center justify-center gap-0.5">
              <span className={cn('text-[10px] font-bold tabular-nums px-1 py-0.5 rounded', avgMinBg(z.avgMin))}>
                {z.avgMin}m
              </span>
              {trendIcon(z.avgMin, 30, true)}
            </div>

            {/* On-time */}
            <div className="flex items-center justify-center gap-0.5">
              <span className={cn('text-[10px] font-bold tabular-nums px-1 py-0.5 rounded', onTimeBg(z.onTimePct))}>
                {z.onTimePct}%
              </span>
              {trendIcon(z.onTimePct, 85)}
            </div>

            {/* Revenue */}
            <div className="text-center">
              <span className="text-[10px] font-semibold text-gray-600 tabular-nums">
                {z.revenue >= 1000 ? `${(z.revenue / 1000).toFixed(1)}k` : `${z.revenue}€`}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-1.5 text-[9px] text-gray-400 border-t border-gray-50">
        Aktualisiert {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
