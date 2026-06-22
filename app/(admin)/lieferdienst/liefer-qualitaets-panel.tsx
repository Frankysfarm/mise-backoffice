'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Star, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface TagesAggregat {
  driverId:   string;
  driverName: string | null;
  datum:      string;
  avgScore:   number;
  count:      number;
}

function scoreColor(s: number) {
  if (s >= 85) return 'bg-emerald-500';
  if (s >= 70) return 'bg-amber-400';
  if (s >= 50) return 'bg-orange-400';
  return 'bg-red-500';
}

function scoreLabel(s: number) {
  if (s >= 85) return 'text-emerald-700';
  if (s >= 70) return 'text-amber-700';
  if (s >= 50) return 'text-orange-700';
  return 'text-red-700';
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export function LieferQualitaetsPanel({ locationId }: { locationId: string | null }) {
  const [open, setOpen]         = useState(false);
  const [data, setData]         = useState<TagesAggregat[]>([]);
  const [loading, setLoading]   = useState(false);
  const [computing, setComp]    = useState(false);
  const locationRef             = useRef(locationId);
  locationRef.current           = locationId;

  const load = useCallback(async () => {
    const loc = locationRef.current;
    if (!loc) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/liefer-qualitaet?location_id=${encodeURIComponent(loc)}&action=aggregat&days=7`);
      const j = await r.json() as { aggregat?: TagesAggregat[] };
      if (j.aggregat) setData(j.aggregat);
    } catch {/* ignore */}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (open && locationId) load();
  }, [open, locationId, load]);

  const handleCompute = async () => {
    if (!locationId) return;
    setComp(true);
    try {
      await fetch('/api/delivery/admin/liefer-qualitaet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compute', location_id: locationId }),
      });
      await load();
    } catch {/* ignore */}
    finally { setComp(false); }
  };

  // Build grid: rows = drivers, cols = dates
  const dates   = Array.from(new Set(data.map((d) => d.datum))).sort();
  const drivers = Array.from(new Set(data.map((d) => d.driverId)));
  const driverNames = new Map<string, string | null>();
  data.forEach((d) => driverNames.set(d.driverId, d.driverName));
  const scoreMap = new Map<string, TagesAggregat>();
  data.forEach((d) => scoreMap.set(`${d.driverId}::${d.datum}`, d));

  // Overall avg
  const allScores = data.map((d) => d.avgScore);
  const overallAvg = allScores.length > 0
    ? Math.round((allScores.reduce((s, n) => s + n, 0) / allScores.length) * 10) / 10
    : null;

  // Trend: compare last 3 days vs prior 4 days
  const sortedDates = [...dates].sort();
  const recentDates = sortedDates.slice(-3);
  const priorDates  = sortedDates.slice(0, sortedDates.length - 3);
  const recentScores = data.filter((d) => recentDates.includes(d.datum)).map((d) => d.avgScore);
  const priorScores  = data.filter((d) => priorDates.includes(d.datum)).map((d) => d.avgScore);
  const recentAvg = recentScores.length > 0 ? recentScores.reduce((s, n) => s + n, 0) / recentScores.length : null;
  const priorAvg  = priorScores.length > 0  ? priorScores.reduce((s, n) => s + n, 0) / priorScores.length  : null;
  const trend = recentAvg !== null && priorAvg !== null
    ? recentAvg - priorAvg > 2 ? 'up' : recentAvg - priorAvg < -2 ? 'down' : 'stable'
    : 'stable';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Star className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-char">Liefer-Qualitäts-Index</div>
            <div className="text-xs text-stone-400">
              {overallAvg !== null
                ? `Ø ${overallAvg.toFixed(1)} / 100 · ${data.length} Datenpunkte`
                : '7-Tage Qualitätsheatmap je Fahrer'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {overallAvg !== null && (
            <div className={`flex items-center gap-1 text-xs font-semibold ${scoreLabel(overallAvg)}`}>
              {trend === 'up'     && <TrendingUp className="h-3.5 w-3.5" />}
              {trend === 'down'   && <TrendingDown className="h-3.5 w-3.5" />}
              {trend === 'stable' && <Minus className="h-3.5 w-3.5" />}
              {overallAvg.toFixed(1)}
            </div>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-stone-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-500">Score: Pünktlichkeit 40% · Vollständigkeit 30% · Kundenbewertung 30%</p>
            <button
              onClick={handleCompute}
              disabled={computing}
              className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${computing ? 'animate-spin' : ''}`} />
              Neu berechnen
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-4 gap-2">
              {[1,2,3,4,5,6,7,8].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-stone-100 animate-pulse" />
              ))}
            </div>
          ) : drivers.length === 0 ? (
            <p className="text-center text-sm text-stone-400 py-6">Keine Qualitätsdaten für die letzten 7 Tage.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left font-semibold text-stone-500 pb-2 pr-4 whitespace-nowrap">Fahrer</th>
                    {dates.map((d) => (
                      <th key={d} className="text-center font-semibold text-stone-500 pb-2 px-1 whitespace-nowrap min-w-[60px]">
                        {fmtDate(d)}
                      </th>
                    ))}
                    <th className="text-center font-semibold text-stone-500 pb-2 pl-4 whitespace-nowrap">Ø Woche</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {drivers.map((driverId) => {
                    const name   = driverNames.get(driverId) ?? driverId.slice(0, 8);
                    const scores = dates.map((d) => scoreMap.get(`${driverId}::${d}`) ?? null);
                    const valid  = scores.filter(Boolean).map((s) => s!.avgScore);
                    const avg    = valid.length > 0
                      ? Math.round((valid.reduce((s, n) => s + n, 0) / valid.length) * 10) / 10
                      : null;

                    return (
                      <tr key={driverId} className="hover:bg-stone-50">
                        <td className="py-2 pr-4 font-medium text-char whitespace-nowrap">{name}</td>
                        {scores.map((s, i) => (
                          <td key={i} className="py-2 px-1 text-center">
                            {s ? (
                              <div className={`inline-flex flex-col items-center gap-0.5`}>
                                <div className={`h-7 w-7 rounded-lg ${scoreColor(s.avgScore)} flex items-center justify-center text-white font-bold text-[10px]`}>
                                  {Math.round(s.avgScore)}
                                </div>
                                <span className="text-[9px] text-stone-400">{s.count}x</span>
                              </div>
                            ) : (
                              <div className="h-7 w-7 rounded-lg bg-stone-100 mx-auto" />
                            )}
                          </td>
                        ))}
                        <td className="py-2 pl-4 text-center">
                          {avg !== null ? (
                            <span className={`font-black text-sm ${scoreLabel(avg)}`}>{avg.toFixed(1)}</span>
                          ) : (
                            <span className="text-stone-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Legende */}
          <div className="flex flex-wrap gap-3 text-[10px] text-stone-500 pt-1 border-t border-stone-100">
            {[
              { color: 'bg-emerald-500', label: '≥85 Sehr gut' },
              { color: 'bg-amber-400',   label: '≥70 Gut' },
              { color: 'bg-orange-400',  label: '≥50 Mittel' },
              { color: 'bg-red-500',     label: '<50 Kritisch' },
            ].map((e) => (
              <div key={e.label} className="flex items-center gap-1.5">
                <div className={`h-3 w-3 rounded ${e.color}`} />
                {e.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
