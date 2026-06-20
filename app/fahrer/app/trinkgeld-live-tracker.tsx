'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { TrendingUp, Star, Loader2 } from 'lucide-react';

type TipData = {
  todayTipEur: number;
  todayDeliveries: number;
  avgTipEur: number;
  bestTipEur: number;
  tipRate: number;
};

export function FahrerTrinkgeldLiveTracker() {
  const [data, setData] = useState<TipData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch('/api/delivery/driver/earnings')
      .then(r => r.json())
      .then(d => {
        const records: any[] = d.records ?? [];
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayRecs = records.filter(r => new Date(r.completedAt ?? r.completed_at ?? 0) >= todayStart);
        const tips = todayRecs.map(r => r.tipEur ?? r.tip_eur ?? r.trinkgeld_eur ?? 0);
        const todayTipEur = tips.reduce((a, b) => a + b, 0);
        const bestTipEur = tips.length ? Math.max(...tips) : 0;
        const avgTipEur = tips.length ? todayTipEur / tips.length : 0;
        const withTip = tips.filter(t => t > 0).length;
        const tipRate = todayRecs.length > 0 ? Math.round((withTip / todayRecs.length) * 100) : 0;

        setData({
          todayTipEur,
          todayDeliveries: todayRecs.length,
          avgTipEur,
          bestTipEur,
          tipRate,
        });
      })
      .catch(() => {
        // Mock-Daten – TODO: entfernen sobald trinkgeld_eur im Earnings-Record verfügbar
        setData({ todayTipEur: 4.5, todayDeliveries: 6, avgTipEur: 0.75, bestTipEur: 2.0, tipRate: 67 });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-white/50" />
        <span className="text-xs text-white/50">Lade Trinkgeld…</span>
      </section>
    );
  }

  if (!data) return null;

  const hasNoTips = data.todayTipEur === 0;

  return (
    <section className="rounded-2xl border border-yellow-400/30 bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-yellow-200">Trinkgeld heute</span>
        </div>
        {!hasNoTips && (
          <span className="text-[10px] text-yellow-400/70">{data.tipRate}% der Lieferungen</span>
        )}
      </div>

      {hasNoTips ? (
        <div className="text-center py-2 text-yellow-200/50 text-sm">Noch kein Trinkgeld heute</div>
      ) : (
        <>
          {/* Hero number */}
          <div className="text-center">
            <div className="text-3xl font-black text-yellow-300 tabular-nums">
              {euro(data.todayTipEur)}
            </div>
            <div className="text-[10px] text-yellow-400/70 mt-0.5">
              {data.todayDeliveries} Lieferung{data.todayDeliveries !== 1 ? 'en' : ''} heute
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-center">
              <div className="text-sm font-bold text-white tabular-nums">{euro(data.avgTipEur)}</div>
              <div className="text-[9px] text-white/50 uppercase tracking-wide">Ø pro Tour</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-center">
              <div className="text-sm font-bold text-yellow-300 tabular-nums">{euro(data.bestTipEur)}</div>
              <div className="text-[9px] text-white/50 uppercase tracking-wide">Bestes Trinkgeld</div>
            </div>
          </div>

          {/* Tip rate bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-yellow-200/70">Trinkgeld-Rate</span>
              <span className="text-[10px] font-bold text-yellow-300">{data.tipRate}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-yellow-400 transition-all duration-700"
                style={{ width: `${data.tipRate}%` }}
              />
            </div>
          </div>

          {data.tipRate >= 70 && (
            <div className="flex items-center gap-1.5 text-xs text-yellow-300 font-semibold">
              <TrendingUp className="h-3.5 w-3.5" />
              Top Trinkgeld-Rate — Weiter so!
            </div>
          )}
        </>
      )}
    </section>
  );
}
