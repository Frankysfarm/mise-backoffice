'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Gift } from 'lucide-react';

interface FahrerTQ {
  fahrer_id: string;
  fahrer_name: string;
  trinkgeld_quote: number;
  quote_vw: number;
  trinkgeld_gesamt: number;
  bestellwert_gesamt: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer: FahrerTQ[];
  team_avg_quote: number;
  team_avg_quote_vw: number;
  alert_count: number;
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

function QuoteBar({ quote, max = 20 }: { quote: number; max?: number }) {
  const pct = Math.min(100, (quote / max) * 100);
  const color = quote >= 10 ? 'bg-green-500' : quote >= 5 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-24">
      <div className={`absolute left-0 top-0 h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      <div className="absolute top-0 h-full border-l border-dashed border-gray-400" style={{ left: `${(5 / max) * 100}%` }} />
      <div className="absolute top-0 h-full border-l border-dashed border-gray-600" style={{ left: `${(10 / max) * 100}%` }} />
    </div>
  );
}

export function DispatchPhase2419TrinkgeldQuoteBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-trinkgeld-quote?location_id=${locationId}`);
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
    <div className={`rounded-xl border mb-3 ${hasAlert ? 'border-orange-300 bg-orange-50' : 'border-teal-200 bg-teal-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Gift size={16} className={hasAlert ? 'text-orange-600' : 'text-teal-600'} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-orange-800' : 'text-teal-800'}`}>
            Trinkgeld-Quote-Board
            {data ? ` — Ø ${data.team_avg_quote.toFixed(1)} %` : ''}
          </span>
          {hasAlert && (
            <span className="text-xs bg-orange-200 text-orange-800 rounded-full px-2 py-0.5">
              {data!.alert_count} unter 5 %
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
                  { label: 'Ø heute', value: `${data.team_avg_quote.toFixed(1)} %` },
                  { label: 'Ø VW', value: `${data.team_avg_quote_vw.toFixed(1)} %` },
                  { label: 'Ziel', value: '≥10 %' },
                ].map(k => (
                  <div key={k.label} className="bg-white rounded-lg p-2 border border-teal-100 text-center">
                    <p className="text-xs text-gray-500">{k.label}</p>
                    <p className="text-sm font-bold text-teal-800">{k.value}</p>
                  </div>
                ))}
              </div>

              {hasAlert && (
                <div className="flex items-start gap-2 bg-orange-100 border border-orange-200 rounded-lg p-2">
                  <AlertTriangle size={13} className="text-orange-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-orange-800">
                    Unter 5 %: {data.fahrer.filter(f => f.alert_niedrig).map(f => f.fahrer_name).join(', ')} — Service-Qualität prüfen!
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {data.fahrer.slice(0, 3).length > 0 && (
                  <div className="flex gap-1 mb-1">
                    {(['🥇', '🥈', '🥉'] as const).map((medal, i) => {
                      const f = data.fahrer[i];
                      if (!f) return null;
                      return (
                        <div key={f.fahrer_id} className={`flex-1 rounded-lg p-2 text-center border ${ampelColor(f.ampel)}`}>
                          <span className="text-sm">{medal}</span>
                          <p className="text-xs font-semibold truncate">{f.fahrer_name}</p>
                          <p className="text-sm font-bold">{f.trinkgeld_quote.toFixed(1)} %</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {data.fahrer.map(f => (
                  <div key={f.fahrer_id} className="bg-white rounded-lg p-2 border border-teal-100">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${ampelDot(f.ampel)}`} />
                        <span className="text-xs font-medium text-gray-800">{f.fahrer_name}</span>
                        {f.alert_niedrig && <AlertTriangle size={10} className="text-orange-500" />}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TrendIcon trend={f.trend} />
                        <span className="text-xs font-bold text-gray-800">{f.trinkgeld_quote.toFixed(1)} %</span>
                        {f.trend_delta !== 0 && (
                          <span className={`text-xs ${f.trend_delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {f.trend_delta > 0 ? '+' : ''}{f.trend_delta.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <QuoteBar quote={f.trinkgeld_quote} />
                    <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                      <span>{f.trinkgeld_gesamt.toFixed(2)} € TG · {f.bestellwert_gesamt.toFixed(0)} € BW</span>
                      <span>VW {f.quote_vw.toFixed(1)} %</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 text-xs text-gray-500 pt-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> ≥10 %</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 5–10 %</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt;5 %</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
