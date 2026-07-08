'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface ArtikelTrend {
  name: string;
  heute: number;
  vorwoche: number;
  delta_pct: number;
  ampel: 'gruen' | 'amber' | 'rot';
}

interface TrendData {
  artikel: ArtikelTrend[];
  generatedAt: string;
}

const MOCK: TrendData = {
  artikel: [
    { name: 'Margherita', heute: 24, vorwoche: 18, delta_pct: 33, ampel: 'gruen' },
    { name: 'Burger Classic', heute: 14, vorwoche: 16, delta_pct: -13, ampel: 'amber' },
    { name: 'Caesar Salad', heute: 6, vorwoche: 11, delta_pct: -45, ampel: 'rot' },
    { name: 'Pasta Arrabbiata', heute: 20, vorwoche: 15, delta_pct: 33, ampel: 'gruen' },
    { name: 'Tiramisu', heute: 9, vorwoche: 8, delta_pct: 13, ampel: 'gruen' },
  ],
  generatedAt: new Date().toISOString(),
};

export function KitchenPhase842ArtikelTrend({ locationId }: Props) {
  const [data, setData] = useState<TrendData | null>(null);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/artikel-trend?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setData(MOCK);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 900_000);
    return () => clearInterval(iv);
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || data.artikel.length === 0) return null;

  const maxHeute = Math.max(...data.artikel.map(a => a.heute), 1);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-matcha-600" />
        <span className="text-sm font-bold text-stone-800">Artikel-Popularität heute vs. Vorwoche</span>
        <span className="ml-auto text-[10px] text-stone-400">15-Min-Update</span>
      </div>

      <div className="space-y-2">
        {data.artikel.map(a => {
          const barW = Math.round((a.heute / maxHeute) * 100);
          const isUp = a.delta_pct > 5;
          const isDown = a.delta_pct < -5;
          const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
          const iconColor = a.ampel === 'gruen' ? 'text-matcha-600' : a.ampel === 'amber' ? 'text-amber-500' : 'text-red-500';
          const barColor = a.ampel === 'gruen' ? 'bg-matcha-500' : a.ampel === 'amber' ? 'bg-amber-400' : 'bg-red-400';

          return (
            <div key={a.name} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-[12px] font-medium text-stone-700 truncate">{a.name}</span>
                <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                  <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${barW}%` }} />
                </div>
                <span className="w-6 shrink-0 text-right text-[11px] font-bold tabular-nums text-stone-700">{a.heute}</span>
                <div className={`flex items-center gap-0.5 w-14 justify-end shrink-0 ${iconColor}`}>
                  <Icon className="h-3 w-3" />
                  <span className="text-[11px] font-bold">
                    {a.delta_pct > 0 ? '+' : ''}{a.delta_pct}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-[10px] text-stone-400 pt-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-matcha-500 inline-block" />+5%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />±5%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />-5%</span>
      </div>
    </div>
  );
}
