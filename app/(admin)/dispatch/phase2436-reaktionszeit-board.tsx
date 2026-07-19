'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerR {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  touren_heute: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  vw_avg_min: number;
  rang: number;
}

interface ApiData {
  fahrer: FahrerR[];
  team_durchschnitt: number;
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-700 bg-green-50 border-green-200';
  if (a === 'gelb') return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-red-500';
}

function barColor(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-red-500';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={12} className="text-green-600" />;
  if (trend === 'fallend') return <TrendingDown size={12} className="text-red-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

function MinBar({ avgMin }: { avgMin: number }) {
  const maxMin = 10;
  const pct = Math.min(100, (avgMin / maxMin) * 100);
  const color = avgMin < 3 ? 'bg-green-500' : avgMin <= 7 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-24">
      <div className={`absolute left-0 top-0 h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      <div className="absolute top-0 h-full border-l border-dashed border-gray-400" style={{ left: '30%' }} title="3 Min" />
      <div className="absolute top-0 h-full border-l border-dashed border-gray-600" style={{ left: '70%' }} title="7 Min" />
    </div>
  );
}

export function DispatchPhase2436ReaktionszeitBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-reaktionszeit?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const alerts = data?.fahrer.filter(f => f.avg_min > 7) ?? [];
  const hasAlert = alerts.length > 0;

  return (
    <div className={`rounded-xl border mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Zap size={16} className={hasAlert ? 'text-red-600' : 'text-blue-600'} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-red-800' : 'text-blue-800'}`}>
            Reaktionszeit-Board
            {data ? ` — Team-Ø ${data.team_durchschnitt.toFixed(1)} Min` : ''}
          </span>
          {hasAlert && (
            <span className="text-xs bg-red-200 text-red-800 rounded-full px-2 py-0.5">
              {alerts.length} über 7 Min
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
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Team-Ø heute', value: `${data.team_durchschnitt.toFixed(1)} Min` },
                  { label: 'Fahrer', value: `${data.fahrer.length}` },
                  { label: 'Ziel', value: '<3 Min' },
                ].map(k => (
                  <div key={k.label} className="bg-white rounded-lg p-2 border border-blue-100 text-center">
                    <p className="text-xs text-gray-500">{k.label}</p>
                    <p className="text-sm font-bold text-blue-800">{k.value}</p>
                  </div>
                ))}
              </div>

              {hasAlert && (
                <div className="flex items-start gap-2 bg-red-100 border border-red-200 rounded-lg p-2">
                  <AlertTriangle size={13} className="text-red-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-800">
                    Über 7 Min: {alerts.map(f => f.fahrer_name).join(', ')} — Fahrer zur schnelleren Abfahrt auffordern!
                  </p>
                </div>
              )}

              {data.fahrer.slice(0, 3).length > 0 && (
                <div className="flex gap-1 mb-1">
                  {(['🥇', '🥈', '🥉'] as const).map((medal, i) => {
                    const f = data.fahrer[i];
                    if (!f) return null;
                    return (
                      <div key={f.fahrer_id} className={`flex-1 rounded-lg p-2 text-center border ${ampelColor(f.ampel)}`}>
                        <span className="text-sm">{medal}</span>
                        <p className="text-xs font-semibold truncate">{f.fahrer_name}</p>
                        <p className="text-sm font-bold">{f.avg_min.toFixed(1)} Min</p>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2">
                {data.fahrer.map(f => (
                  <div key={f.fahrer_id} className="bg-white rounded-lg p-2 border border-blue-100">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${ampelDot(f.ampel)}`} />
                        <span className="text-xs font-medium text-gray-800">{f.fahrer_name}</span>
                        {f.avg_min > 7 && <AlertTriangle size={10} className="text-red-500" />}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TrendIcon trend={f.trend} />
                        <span className="text-xs font-bold text-gray-800">{f.avg_min.toFixed(1)} Min</span>
                        {f.trend_delta !== 0 && (
                          <span className={`text-xs ${f.trend_delta < 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {f.trend_delta > 0 ? '+' : ''}{f.trend_delta} Min
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <MinBar avgMin={f.avg_min} />
                      <span className="text-xs text-gray-400">{f.touren_heute} Touren</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 text-xs text-gray-500 pt-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> &lt;3 Min</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 3–7 Min</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &gt;7 Min</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
