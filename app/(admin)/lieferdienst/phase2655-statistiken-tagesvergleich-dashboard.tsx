'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart2, ChevronDown, ChevronUp, Clock, TrendingDown, TrendingUp, Users, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

interface KpiKachel {
  key: string;
  label: string;
  heute: number;
  gestern: number;
  einheit: string;
  ziel: number | null;
  hoeher_besser: boolean;
}

interface StundeData {
  stunde: number;
  heute: number;
  gestern: number;
}

interface ApiData {
  kpis: KpiKachel[];
  stunden: StundeData[];
  aktuelle_stunde: number;
  alert_kpis: string[];
  gesamt_trend: 'positiv' | 'neutral' | 'negativ';
}

const MOCK: ApiData = {
  gesamt_trend: 'positiv',
  aktuelle_stunde: 14,
  alert_kpis: ['Lieferzeit'],
  kpis: [
    { key: 'bestellungen', label: 'Bestellungen', heute: 142, gestern: 119, einheit: '', ziel: 150, hoeher_besser: true },
    { key: 'umsatz', label: 'Umsatz', heute: 2840, gestern: 2310, einheit: '€', ziel: 3000, hoeher_besser: true },
    { key: 'lieferzeit', label: 'Lieferzeit', heute: 34, gestern: 31, einheit: 'min', ziel: 32, hoeher_besser: false },
    { key: 'puenktlichkeit', label: 'Pünktlichkeit', heute: 77, gestern: 82, einheit: '%', ziel: 85, hoeher_besser: true },
    { key: 'bewertung', label: 'Bewertung', heute: 4.5, gestern: 4.4, einheit: '★', ziel: 4.5, hoeher_besser: true },
    { key: 'fahrer', label: 'Fahrer aktiv', heute: 8, gestern: 7, einheit: '', ziel: null, hoeher_besser: true },
    { key: 'sla', label: 'SLA ≤35min', heute: 81, gestern: 78, einheit: '%', ziel: 85, hoeher_besser: true },
    { key: 'storno', label: 'Storno-Quote', heute: 3.2, gestern: 4.1, einheit: '%', ziel: 3.0, hoeher_besser: false },
  ],
  stunden: [
    { stunde: 11, heute: 8, gestern: 6 },
    { stunde: 12, heute: 19, gestern: 14 },
    { stunde: 13, heute: 24, gestern: 20 },
    { stunde: 14, heute: 21, gestern: 16 },
    { stunde: 15, heute: 0, gestern: 18 },
    { stunde: 16, heute: 0, gestern: 20 },
    { stunde: 17, heute: 0, gestern: 25 },
    { stunde: 18, heute: 0, gestern: 28 },
    { stunde: 19, heute: 0, gestern: 24 },
    { stunde: 20, heute: 0, gestern: 18 },
  ],
};

function ampelKpi(k: KpiKachel): { border: string; bg: string; value: string } {
  if (k.ziel === null) return { border: 'border-gray-600', bg: 'bg-gray-800', value: 'text-gray-300' };
  const ok = k.hoeher_besser ? k.heute >= k.ziel : k.heute <= k.ziel;
  const warn = k.hoeher_besser ? k.heute >= k.ziel * 0.9 : k.heute <= k.ziel * 1.1;
  if (ok) return { border: 'border-green-500/50', bg: 'bg-green-950/20', value: 'text-green-400' };
  if (warn) return { border: 'border-amber-500/50', bg: 'bg-amber-950/20', value: 'text-amber-400' };
  return { border: 'border-red-500/50', bg: 'bg-red-950/20', value: 'text-red-400' };
}

function TrendIcon({ heute, gestern, higherBetter }: { heute: number; gestern: number; higherBetter: boolean }) {
  const better = higherBetter ? heute > gestern : heute < gestern;
  const worse = higherBetter ? heute < gestern : heute > gestern;
  const pct = gestern === 0 ? 0 : Math.abs(((heute - gestern) / gestern) * 100).toFixed(1);
  if (better) return <span className="flex items-center gap-0.5 text-[9px] text-green-400"><TrendingUp className="h-2.5 w-2.5" />+{pct}%</span>;
  if (worse) return <span className="flex items-center gap-0.5 text-[9px] text-red-400"><TrendingDown className="h-2.5 w-2.5" />-{pct}%</span>;
  return <span className="text-[9px] text-gray-500">±0%</span>;
}

export function LieferdienstPhase2655StatistikTagesvergleichDashboard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [chartModus, setChartModus] = useState<'bestellungen' | 'umsatz'>('bestellungen');

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/lieferdienst/tagesvergleich?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (locationId) load(); else setData(MOCK);
    const p = setInterval(load, 60_000);
    return () => clearInterval(p);
  }, [locationId]);

  const d = data ?? MOCK;
  const trendColor = d.gesamt_trend === 'positiv' ? 'text-green-400' : d.gesamt_trend === 'negativ' ? 'text-red-400' : 'text-gray-400';

  return (
    <div className="rounded-xl border border-gray-700 shadow mb-4 overflow-hidden bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-purple-400 shrink-0" />
          <span className="text-sm font-bold text-white">Statistiken Tagesvergleich</span>
          <span className={`text-[10px] font-bold ${trendColor}`}>
            {d.gesamt_trend === 'positiv' ? '↑ Besser als gestern' : d.gesamt_trend === 'negativ' ? '↓ Schlechter als gestern' : '→ Ähnlich'}
          </span>
          {d.alert_kpis.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-700 px-2 py-0.5 text-[10px] font-bold text-white">
              <AlertTriangle className="h-2.5 w-2.5" />{d.alert_kpis.join(', ')}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </button>

      {open && (
        <div className="border-t border-gray-700 p-3 space-y-3">
          {/* KPI-Grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {d.kpis.map(k => {
              const amp = ampelKpi(k);
              return (
                <div key={k.key} className={`rounded-lg border ${amp.border} ${amp.bg} p-2`}>
                  <div className="text-[8px] text-gray-400 truncate mb-1">{k.label}</div>
                  <div className={`text-sm font-black tabular-nums ${amp.value}`}>
                    {k.heute}{k.einheit}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[8px] text-gray-600">G {k.gestern}{k.einheit}</span>
                    <TrendIcon heute={k.heute} gestern={k.gestern} higherBetter={k.hoeher_besser} />
                  </div>
                  {k.ziel !== null && (
                    <div className="mt-1 h-0.5 rounded-full bg-gray-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${amp.value === 'text-green-400' ? 'bg-green-500' : amp.value === 'text-amber-400' ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, k.hoeher_besser ? (k.heute / k.ziel) * 100 : (k.ziel / k.heute) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-400 font-semibold">Stundenverlauf (Heute vs Gestern)</span>
              <div className="flex gap-1">
                {(['bestellungen', 'umsatz'] as const).map(m => (
                  <button key={m} onClick={() => setChartModus(m)}
                    className={`text-[9px] rounded px-1.5 py-0.5 font-medium transition-colors ${chartModus === m ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                    {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz €'}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.stunden} barGap={1} barSize={8}>
                  <XAxis dataKey="stunde" tick={{ fontSize: 8, fill: '#6b7280' }} tickFormatter={h => `${h}h`} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6, fontSize: 10 }}
                    labelFormatter={l => `${l}:00 Uhr`}
                    formatter={(v: number, name: string) => [chartModus === 'umsatz' ? `${(v * 20).toFixed(0)}€` : v, name === 'heute' ? 'Heute' : 'Gestern']}
                  />
                  <ReferenceLine x={d.aktuelle_stunde} stroke="#3b82f6" strokeDasharray="3 3" strokeWidth={1} />
                  <Bar dataKey="gestern" name="gestern" radius={[2, 2, 0, 0]}>
                    {d.stunden.map((_, i) => <Cell key={i} fill="#374151" />)}
                  </Bar>
                  <Bar dataKey="heute" name="heute" radius={[2, 2, 0, 0]}>
                    {d.stunden.map((entry, i) => (
                      <Cell key={i} fill={entry.stunde === d.aktuelle_stunde ? '#3b82f6' : entry.heute > 0 ? '#8b5cf6' : '#1f2937'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 justify-center mt-1">
              <span className="flex items-center gap-1 text-[8px] text-gray-500"><span className="inline-block h-2 w-3 bg-gray-600 rounded-sm" />Gestern</span>
              <span className="flex items-center gap-1 text-[8px] text-purple-400"><span className="inline-block h-2 w-3 bg-purple-500 rounded-sm" />Heute</span>
              <span className="flex items-center gap-1 text-[8px] text-blue-400"><span className="inline-block h-2 w-3 bg-blue-500 rounded-sm" />Aktuelle Stunde</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[9px] text-gray-600 px-1">
            <div className="flex items-center gap-1"><Users className="h-2.5 w-2.5" /><span>{d.kpis.find(k => k.key === 'fahrer')?.heute ?? '–'} Fahrer aktiv</span></div>
            <div className="flex items-center gap-1"><Zap className="h-2.5 w-2.5 text-purple-400" /><Clock className="h-2.5 w-2.5" /><span>1-Min-Polling</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
