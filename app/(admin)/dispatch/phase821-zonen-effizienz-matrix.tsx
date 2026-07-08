'use client';

import { useEffect, useState } from 'react';
import { Map, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string | null;
}

interface ZoneEfzienz {
  zone: string;
  avgLieferzeitMin: number;
  puentlichkeitPct: number;
  anzahlLieferungen: number;
  trendVsGestern: number;
  effizienzScore: number;
}

interface MatrixData {
  zonen: ZoneEfzienz[];
  aktualisiert: string;
}

const MOCK: MatrixData = {
  zonen: [
    { zone: 'Innenstadt', avgLieferzeitMin: 24, puentlichkeitPct: 92, anzahlLieferungen: 18, trendVsGestern: 4, effizienzScore: 91 },
    { zone: 'Nordend', avgLieferzeitMin: 31, puentlichkeitPct: 84, anzahlLieferungen: 12, trendVsGestern: -2, effizienzScore: 76 },
    { zone: 'Sachsenhausen', avgLieferzeitMin: 28, puentlichkeitPct: 88, anzahlLieferungen: 15, trendVsGestern: 1, effizienzScore: 83 },
    { zone: 'Bornheim', avgLieferzeitMin: 35, puentlichkeitPct: 79, anzahlLieferungen: 9, trendVsGestern: -5, effizienzScore: 68 },
    { zone: 'Westend', avgLieferzeitMin: 26, puentlichkeitPct: 90, anzahlLieferungen: 11, trendVsGestern: 3, effizienzScore: 87 },
  ],
  aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
};

function scoreStyle(score: number) {
  if (score >= 85) return 'text-emerald-700 bg-emerald-50';
  if (score >= 70) return 'text-amber-700 bg-amber-50';
  return 'text-red-700 bg-red-50';
}

export function DispatchPhase821ZonenEffizienzMatrix({ locationId }: Props) {
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/zones?location_id=${locationId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const zonen: ZoneEfzienz[] = Array.isArray(json.zones)
        ? json.zones.map((z: any) => ({
            zone: z.name ?? z.zone ?? 'Zone',
            avgLieferzeitMin: z.avg_delivery_min ?? z.avgTime ?? 30,
            puentlichkeitPct: z.ontime_pct ?? z.punctualityPct ?? 80,
            anzahlLieferungen: z.count ?? z.deliveries ?? 0,
            trendVsGestern: z.trend ?? 0,
            effizienzScore: z.score ?? Math.round((z.ontime_pct ?? 80) * 0.6 + Math.max(0, 100 - (z.avg_delivery_min ?? 30)) * 0.4),
          }))
        : MOCK.zonen;
      setData({ zonen, aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) });
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); const iv = setInterval(load, 90_000); return () => clearInterval(iv); }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="rounded-2xl border border-stone-200 bg-white p-4 text-xs text-stone-400 animate-pulse">Lade Zonen-Matrix…</div>;
  if (!data || data.zonen.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-blue-50">
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-blue-700" />
          <span className="text-sm font-bold text-blue-800">Zonen-Effizienz-Matrix</span>
        </div>
        <span className="text-[10px] text-stone-400">{data.aktualisiert}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-stone-100">
            <tr className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
              <th className="text-left px-4 py-2">Zone</th>
              <th className="text-right px-3 py-2">Ø Zeit</th>
              <th className="text-right px-3 py-2">Pünktl.</th>
              <th className="text-right px-3 py-2">n</th>
              <th className="text-right px-3 py-2">Trend</th>
              <th className="text-right px-4 py-2">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {data.zonen.sort((a, b) => b.effizienzScore - a.effizienzScore).map((z) => {
              const TrendIcon = z.trendVsGestern > 0 ? TrendingUp : z.trendVsGestern < 0 ? TrendingDown : Minus;
              const trendCol = z.trendVsGestern > 0 ? 'text-emerald-500' : z.trendVsGestern < 0 ? 'text-red-500' : 'text-stone-300';
              return (
                <tr key={z.zone} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-2.5 font-semibold text-stone-700 truncate max-w-[100px]">{z.zone}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-bold">{z.avgLieferzeitMin} Min</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <span className={cn('font-bold', z.puentlichkeitPct >= 85 ? 'text-emerald-600' : z.puentlichkeitPct >= 70 ? 'text-amber-600' : 'text-red-600')}>
                      {z.puentlichkeitPct}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-stone-500">{z.anzahlLieferungen}</td>
                  <td className="px-3 py-2.5 text-right">
                    <TrendIcon className={cn('h-3 w-3 inline', trendCol)} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums', scoreStyle(z.effizienzScore))}>
                      {z.effizienzScore}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
