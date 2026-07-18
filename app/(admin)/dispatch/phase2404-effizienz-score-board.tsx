'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';

interface FaktorDetails {
  f_touren: number;
  f_reaktion: number;
  f_abbruch: number;
  f_km: number;
  f_pause: number;
}

interface FahrerScore {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_vw: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
  rang: number;
  faktoren: FaktorDetails;
}

interface ApiData {
  fahrer: FahrerScore[];
  team_avg_score: number;
  team_avg_score_vw: number;
  alert_count: number;
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-700 bg-green-50 border-green-200';
  if (a === 'gelb') return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

function scoreBarColor(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={12} className="text-green-600" />;
  if (trend === 'fallend') return <TrendingDown size={12} className="text-red-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

const PODIUM = ['🥇', '🥈', '🥉'];

export function DispatchPhase2404EffizienzScoreBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-effizienz-score?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const hasAlert = (data?.alert_count ?? 0) > 0;

  return (
    <div className={`rounded-xl border mb-3 ${hasAlert ? 'border-orange-300 bg-orange-50' : 'border-indigo-200 bg-indigo-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Star size={16} className={hasAlert ? 'text-orange-600' : 'text-indigo-600'} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-orange-800' : 'text-indigo-800'}`}>
            Effizienz-Score-Board {data ? `— Team-Ø ${data.team_avg_score}/100` : ''}
          </span>
          {hasAlert && (
            <span className="text-xs bg-orange-200 text-orange-800 rounded-full px-2 py-0.5">
              {data!.alert_count} Alert{data!.alert_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!data ? (
            <p className="text-xs text-gray-500">Lade…</p>
          ) : (
            <>
              {/* KPI Row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white border border-indigo-100 p-2 text-center">
                  <div className="text-lg font-bold text-indigo-700">{data.team_avg_score}</div>
                  <div className="text-xs text-gray-500">Ø heute</div>
                </div>
                <div className="rounded-lg bg-white border border-indigo-100 p-2 text-center">
                  <div className="text-lg font-bold text-gray-700">{data.team_avg_score_vw}</div>
                  <div className="text-xs text-gray-500">Vorwoche</div>
                </div>
                <div className="rounded-lg bg-white border border-indigo-100 p-2 text-center">
                  <div className="text-lg font-bold text-green-700">≥75</div>
                  <div className="text-xs text-gray-500">Ziel</div>
                </div>
              </div>

              {/* Alert banner */}
              {hasAlert && (
                <div className="flex items-start gap-2 bg-orange-100 border border-orange-200 rounded-lg p-2">
                  <AlertTriangle size={14} className="text-orange-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-orange-800">
                    Score &lt;50 (rot): {data.fahrer.filter(f => f.alert).map(f => f.fahrer_name).join(', ')} — Sofort-Coaching empfohlen!
                  </p>
                </div>
              )}

              {/* Podium Top-3 */}
              {data.fahrer.length >= 3 && (
                <div className="grid grid-cols-3 gap-2">
                  {data.fahrer.slice(0, 3).map((f, i) => (
                    <div key={f.fahrer_id} className={`rounded-lg border p-2 text-center ${ampelColor(f.ampel)}`}>
                      <div className="text-lg">{PODIUM[i]}</div>
                      <div className="text-xs font-semibold truncate">{f.fahrer_name}</div>
                      <div className="text-sm font-bold">{f.score}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Full driver list */}
              <div className="space-y-1.5">
                {data.fahrer.map(f => (
                  <div
                    key={f.fahrer_id}
                    className={`rounded-lg border px-3 py-2 ${ampelColor(f.ampel)}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
                        <span className="text-sm font-medium truncate">{f.fahrer_name}</span>
                        {f.alert && <AlertTriangle size={12} className="text-orange-600 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 text-xs shrink-0">
                        <TrendIcon trend={f.trend} />
                        <span className="font-bold">{f.score}/100</span>
                        {f.trend_delta !== 0 && (
                          <span className={f.trend_delta > 0 ? 'text-green-600' : 'text-red-500'}>
                            ({f.trend_delta > 0 ? '+' : ''}{f.trend_delta})
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Mini score bar */}
                    <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${scoreBarColor(f.ampel)}`}
                        style={{ width: `${f.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Ampel legend */}
              <div className="flex gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />≥75 Gut</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />50–74 Ok</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />&lt;50 Alert</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
