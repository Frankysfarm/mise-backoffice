'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerP {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  gesamt_stopps: number;
  puenktlich: number;
  zu_spaet: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  rang: number;
}

interface ApiData {
  fahrer: FahrerP[];
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

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={12} className="text-green-600" />;
  if (trend === 'fallend') return <TrendingDown size={12} className="text-red-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

function QuoteBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-green-500' : pct >= 75 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-24">
      <div className={`absolute left-0 top-0 h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      <div className="absolute top-0 h-full border-l border-dashed border-gray-400" style={{ left: '75%' }} />
      <div className="absolute top-0 h-full border-l border-dashed border-gray-600" style={{ left: '90%' }} />
    </div>
  );
}

export function DispatchPhase2431PuenktlichkeitsBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const alerts = data?.fahrer.filter(f => f.quote_pct < 75) ?? [];
  const hasAlert = alerts.length > 0;

  return (
    <div className={`rounded-xl border mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className={hasAlert ? 'text-red-600' : 'text-blue-600'} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-red-800' : 'text-blue-800'}`}>
            Pünktlichkeits-Board
            {data ? ` — Team-Ø ${data.team_durchschnitt.toFixed(1)}%` : ''}
          </span>
          {hasAlert && (
            <span className="text-xs bg-red-200 text-red-800 rounded-full px-2 py-0.5">
              {alerts.length} unter 75%
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
                  { label: 'Team-Ø heute', value: `${data.team_durchschnitt.toFixed(1)}%` },
                  { label: 'Fahrer', value: `${data.fahrer.length}` },
                  { label: 'Ziel', value: '≥90%' },
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
                    Unter 75%: {alerts.map(f => f.fahrer_name).join(', ')} — Routen und Wartezeiten prüfen!
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
                        <p className="text-sm font-bold">{f.quote_pct.toFixed(1)}%</p>
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
                        {f.quote_pct < 75 && <AlertTriangle size={10} className="text-red-500" />}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TrendIcon trend={f.trend} />
                        <span className="text-xs font-bold text-gray-800">{f.quote_pct.toFixed(1)}%</span>
                        {f.trend_delta !== 0 && (
                          <span className={`text-xs ${f.trend_delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {f.trend_delta > 0 ? '+' : ''}{f.trend_delta}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <QuoteBar pct={f.quote_pct} />
                      <span className="text-xs text-gray-400">{f.puenktlich}/{f.gesamt_stopps} pünktl.</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 text-xs text-gray-500 pt-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> ≥90%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 75–90%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt;75%</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
