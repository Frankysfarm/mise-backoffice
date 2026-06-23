'use client';

/**
 * DispatchZonenbilanzKarte — Phase 486
 * Zonen-Performance-Karte für Dispatcher:
 * - Beste und schlechteste Lieferzone heute
 * - Metriken: Bestellanzahl, Ø-Lieferzeit, Pünktlichkeitsquote
 * - Farbkodierung: grün (Beste) / rot (Schlechteste)
 * - 5-Min-Refresh via Mock-Fallback (echte API: GET /api/delivery/admin/zonen-bilanz)
 */

import { useEffect, useState } from 'react';
import { MapPin, TrendingUp, TrendingDown, RefreshCw, Trophy, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ZoneStats = {
  zone: string;
  bestellungen: number;
  avgLieferzeitMin: number;
  puenktlichkeitPct: number;
  score: number;
};

const MOCK_ZONES: ZoneStats[] = [
  { zone: 'Zone A', bestellungen: 14, avgLieferzeitMin: 22, puenktlichkeitPct: 92, score: 89 },
  { zone: 'Zone B', bestellungen: 11, avgLieferzeitMin: 28, puenktlichkeitPct: 82, score: 75 },
  { zone: 'Zone C', bestellungen: 9,  avgLieferzeitMin: 35, puenktlichkeitPct: 67, score: 58 },
  { zone: 'Zone D', bestellungen: 6,  avgLieferzeitMin: 41, puenktlichkeitPct: 55, score: 43 },
];

function ZoneKachel({
  zone,
  rank,
}: {
  zone: ZoneStats;
  rank: 'best' | 'worst';
}) {
  const isBest = rank === 'best';
  return (
    <div
      className={cn(
        'flex-1 rounded-xl border p-3 space-y-2',
        isBest
          ? 'border-matcha-300 bg-matcha-50'
          : 'border-red-200 bg-red-50',
      )}
    >
      <div className="flex items-center gap-1.5">
        {isBest
          ? <Trophy className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
          : <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
        }
        <span className={cn('text-[10px] font-black uppercase tracking-wider', isBest ? 'text-matcha-800' : 'text-red-800')}>
          {isBest ? 'Beste Zone' : 'Schwächste Zone'}
        </span>
      </div>
      <div className={cn('text-lg font-black', isBest ? 'text-matcha-900' : 'text-red-900')}>
        {zone.zone}
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-[10px] text-stone-500">Bestellungen</span>
          <span className={cn('text-[11px] font-bold tabular-nums', isBest ? 'text-matcha-800' : 'text-red-800')}>{zone.bestellungen}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-stone-500">Ø Lieferzeit</span>
          <span className={cn('text-[11px] font-bold tabular-nums', isBest ? 'text-matcha-800' : 'text-red-800')}>{zone.avgLieferzeitMin} Min</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-stone-500">Pünktlich</span>
          <span className={cn('text-[11px] font-bold tabular-nums', isBest ? 'text-matcha-800' : 'text-red-800')}>{zone.puenktlichkeitPct}%</span>
        </div>
      </div>
      {/* Score Bar */}
      <div className="space-y-0.5">
        <div className="h-1.5 rounded-full bg-white/80 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', isBest ? 'bg-matcha-500' : 'bg-red-400')}
            style={{ width: `${zone.score}%` }}
          />
        </div>
        <div className={cn('text-[9px] font-bold text-right', isBest ? 'text-matcha-700' : 'text-red-700')}>
          Score {zone.score}/100
        </div>
      </div>
    </div>
  );
}

export function DispatchZonenbilanzKarte({ locationId }: { locationId?: string | null }) {
  const [zones, setZones] = useState<ZoneStats[]>(MOCK_ZONES);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    async function load() {
      if (!locationId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/zonen-bilanz?location_id=${locationId}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.zones) && data.zones.length > 0) {
            setZones(data.zones);
          }
        }
      } catch {
        // Mock-Fallback bleibt
      } finally {
        setLoading(false);
        setLastUpdate(new Date());
      }
    }
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const sorted = [...zones].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  if (!best || !worst || best.zone === worst.zone) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-2.5 bg-stone-50">
        <MapPin className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider text-stone-800">
          Zonen-Bilanz Heute
        </span>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-stone-400">
          {loading && <RefreshCw className="h-3 w-3 animate-spin" />}
          <span>{lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
      <div className="flex gap-2.5 p-3">
        <ZoneKachel zone={best} rank="best" />
        <ZoneKachel zone={worst} rank="worst" />
      </div>
      {sorted.length > 2 && (
        <div className="border-t border-stone-100 px-4 py-2 bg-stone-50">
          <div className="flex gap-4 overflow-x-auto scrollbar-none">
            {sorted.slice(1, -1).map((z) => (
              <div key={z.zone} className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold text-stone-600">{z.zone}</span>
                <div className="h-1 w-16 rounded-full bg-stone-200 overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${z.score}%` }} />
                </div>
                <span className="text-[9px] tabular-nums text-stone-500">{z.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
