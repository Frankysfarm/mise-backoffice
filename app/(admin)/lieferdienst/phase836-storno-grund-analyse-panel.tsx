'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface TopGrund {
  grund: string;
  count14d: number;
  count7d: number;
  trend: 'steigend' | 'fallend' | 'stabil';
}

interface ZoneRate {
  zone: string;
  rate14d: number;
  rate7d: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  storno14d: number;
  total14d: number;
}

interface WochentagRate {
  tag: string;
  wd: number;
  rate14d: number;
  rate7d: number;
  trend: 'steigend' | 'fallend' | 'stabil';
}

interface ApiData {
  gesamtRate: number;
  stornos14d: number;
  bestellungen14d: number;
  topGruende: TopGrund[];
  jeZone: ZoneRate[];
  jeWochentag: WochentagRate[];
  aktualisiert: string;
}

function TrendIcon({ trend }: { trend: 'steigend' | 'fallend' | 'stabil' }) {
  if (trend === 'steigend') return <TrendingUp className="h-3.5 w-3.5 text-red-500" />;
  if (trend === 'fallend') return <TrendingDown className="h-3.5 w-3.5 text-matcha-600" />;
  return <Minus className="h-3.5 w-3.5 text-stone-400" />;
}

function zoneColor(rate: number): string {
  if (rate >= 15) return 'bg-red-500';
  if (rate >= 8) return 'bg-amber-400';
  return 'bg-matcha-500';
}

function wdColor(rate: number): string {
  if (rate >= 15) return 'bg-red-400 text-red-900';
  if (rate >= 8) return 'bg-amber-300 text-amber-900';
  return 'bg-matcha-200 text-matcha-800';
}

export function LieferdienstPhase836StornoGrundAnalysePanel({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/storno-grund-analyse?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch { /* noop */ }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 300_000);
    return () => clearInterval(iv);
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;

  const maxZoneRate = Math.max(...data.jeZone.map(z => z.rate14d), 1);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center justify-between px-5 py-4 border-b border-stone-100 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-700">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-char">Storno-Grund-Analyse</div>
            <div className="text-xs text-stone-400">
              {data.stornos14d} Stornos · {data.gesamtRate}% Rate (14d)
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {expanded && (
        <div className="p-5 space-y-5">
          {/* Top-Gründe Tabelle */}
          <div>
            <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Top-Stornogründe</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-stone-400 border-b border-stone-100">
                    <th className="text-left py-1.5 font-medium">Grund</th>
                    <th className="text-right py-1.5 font-medium w-16">14d</th>
                    <th className="text-right py-1.5 font-medium w-16">7d</th>
                    <th className="text-right py-1.5 font-medium w-10">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topGruende.map((g) => (
                    <tr key={g.grund} className="border-b border-stone-50">
                      <td className="py-1.5 text-stone-700">{g.grund}</td>
                      <td className="py-1.5 text-right tabular-nums text-stone-600">{g.count14d}</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold text-stone-800">{g.count7d}</td>
                      <td className="py-1.5 text-right flex justify-end"><TrendIcon trend={g.trend} /></td>
                    </tr>
                  ))}
                  {data.topGruende.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-stone-400">Keine Stornodaten</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Zonen-Storno-Rate Balkendiagramm */}
          {data.jeZone.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Stornorate je Zone</div>
              <div className="space-y-2">
                {data.jeZone.map((z) => (
                  <div key={z.zone} className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-stone-600 w-16 shrink-0">Zone {z.zone}</span>
                    <div className="flex-1 h-5 bg-stone-100 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all ${zoneColor(z.rate14d)}`}
                        style={{ width: `${Math.min(100, (z.rate14d / maxZoneRate) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums font-semibold text-stone-700 w-12 text-right">
                      {z.rate14d}%
                    </span>
                    <TrendIcon trend={z.trend} />
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex gap-4 text-[10px] text-stone-400">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-matcha-500" /> &lt;8%</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> 8–14%</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" /> ≥15%</span>
              </div>
            </div>
          )}

          {/* Wochentag-Heatmap */}
          <div>
            <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Wochentag-Heatmap (14d)</div>
            <div className="grid grid-cols-7 gap-1">
              {data.jeWochentag.map((w) => (
                <div key={w.wd} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-lg py-2 text-center text-[10px] font-bold ${wdColor(w.rate14d)}`}
                  >
                    {w.rate14d}%
                  </div>
                  <span className="text-[9px] text-stone-400">{w.tag.slice(0, 2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[10px] text-stone-400 text-right">
            {new Date(data.aktualisiert).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
          </div>
        </div>
      )}
    </div>
  );
}
