'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, XCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerSQ {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  gesamt_touren: number;
  stornierungen: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  vw_quote_pct: number;
  rang: number;
}

interface ApiData {
  fahrer: FahrerSQ[];
  team_durchschnitt: number;
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

function QuoteBar({ pct }: { pct: number }) {
  const width = Math.min(100, (pct / 20) * 100);
  const color = pct < 5 ? 'bg-green-500' : pct <= 10 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-24">
      <div className={`absolute left-0 top-0 h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
      <div className="absolute top-0 h-full border-l border-dashed border-gray-400" style={{ left: '25%' }} title="5%" />
      <div className="absolute top-0 h-full border-l border-dashed border-gray-600" style={{ left: '50%' }} title="10%" />
    </div>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={12} className="text-red-500" />;
  if (trend === 'fallend') return <TrendingDown size={12} className="text-green-600" />;
  return <Minus size={12} className="text-gray-400" />;
}

export function DispatchPhase2441StornoQuoteBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-storno-quote?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const alerts = data?.fahrer.filter(f => f.quote_pct > 10) ?? [];
  const hasAlert = alerts.length > 0;
  const sorted = data ? [...data.fahrer].sort((a, b) => a.quote_pct - b.quote_pct) : [];
  const top3 = sorted.slice(0, 3);

  return (
    <div className={`rounded-xl border mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-indigo-200 bg-indigo-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <XCircle size={16} className={hasAlert ? 'text-red-600' : 'text-indigo-600'} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-red-800' : 'text-indigo-800'}`}>
            Storno-Quote-Board
            {data ? ` — Team-Ø ${data.team_durchschnitt.toFixed(1)}%` : ''}
          </span>
          {hasAlert && (
            <span className="text-xs bg-red-200 text-red-800 rounded-full px-2 py-0.5">
              {alerts.length} über 10%
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
              {/* KPI-Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white border border-indigo-100 p-2 text-center">
                  <div className="text-lg font-bold text-indigo-700">{data.team_durchschnitt.toFixed(1)}%</div>
                  <div className="text-xs text-gray-500">Team-Ø heute</div>
                </div>
                <div className="rounded-lg bg-white border border-indigo-100 p-2 text-center">
                  <div className="text-lg font-bold text-gray-700">
                    {data.fahrer.length > 0
                      ? (data.fahrer.reduce((s, f) => s + f.vw_quote_pct, 0) / data.fahrer.length).toFixed(1)
                      : '—'}%
                  </div>
                  <div className="text-xs text-gray-500">Vorwoche</div>
                </div>
                <div className="rounded-lg bg-white border border-green-100 p-2 text-center">
                  <div className="text-lg font-bold text-green-700">&lt;5%</div>
                  <div className="text-xs text-gray-500">Ziel</div>
                </div>
              </div>

              {/* Alert-Banner */}
              {hasAlert && (
                <div className="flex items-start gap-2 bg-red-100 border border-red-200 rounded-lg p-2">
                  <AlertTriangle size={13} className="text-red-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-800">
                    Storno-Quote &gt;10%: {alerts.map(f => f.fahrer_name).join(', ')} — Ursache klären und Fahrwegoptimierung prüfen!
                  </p>
                </div>
              )}

              {/* Podium Top-3 (niedrigste Quote) */}
              {top3.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 font-medium">Beste Storno-Quote heute</div>
                  <div className="flex gap-2">
                    {top3.map((f, i) => (
                      <div key={f.fahrer_id} className="flex-1 rounded-lg bg-white border border-gray-100 p-2 text-center">
                        <div className="text-base">{['🥇','🥈','🥉'][i]}</div>
                        <div className="text-xs font-semibold truncate">{f.fahrer_name.split(' ')[0]}</div>
                        <div className="text-sm font-bold text-green-700">{f.quote_pct.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fahrerliste */}
              <div className="space-y-1.5">
                {sorted.map(f => (
                  <div key={f.fahrer_id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${ampelColor(f.ampel)}`}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
                    <span className="text-xs font-medium flex-1 truncate">{f.fahrer_name}</span>
                    <QuoteBar pct={f.quote_pct} />
                    <span className="text-xs font-bold w-10 text-right">{f.quote_pct.toFixed(1)}%</span>
                    <div className="flex items-center gap-0.5">
                      <TrendIcon trend={f.trend} />
                    </div>
                    <span className="text-xs text-gray-400 w-16 text-right">{f.stornierungen}/{f.gesamt_touren} Touren</span>
                  </div>
                ))}
              </div>

              {/* Ampel-Legende */}
              <div className="flex gap-3 text-xs text-gray-500 pt-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> &lt;5%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 5–10%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &gt;10%</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
