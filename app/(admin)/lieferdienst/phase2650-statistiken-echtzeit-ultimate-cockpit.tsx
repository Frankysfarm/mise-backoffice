'use client';
import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, ChevronDown, ChevronUp, Clock, Euro, Package, Star, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Kpi {
  label: string;
  wert: string;
  trend: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  ziel: string;
}

interface Stunde {
  stunde: number;
  bestellungen: number;
  umsatz_eur: number;
}

interface ZoneKpi {
  zone: string;
  bestellungen: number;
  avg_liefer_min: number;
}

interface ApiData {
  kpis: Kpi[];
  stunden: Stunde[];
  zonen: ZoneKpi[];
  alerts: string[];
  letzte_aktualisierung: string;
}

const MOCK: ApiData = {
  alerts: ['Stornoquote 4,2% — über Ziel 3%!', 'Ø Lieferzeit 31 Min — Fahrer prüfen'],
  letzte_aktualisierung: new Date().toISOString(),
  kpis: [
    { label: 'Bestellungen',  wert: '163',      trend:  12, ampel: 'gruen', ziel: '150' },
    { label: 'Umsatz',        wert: '€ 3.287',  trend:   8, ampel: 'gruen', ziel: '€ 3.000' },
    { label: 'Ø Lieferzeit',  wert: '31 Min',   trend:  -4, ampel: 'rot',   ziel: '28 Min' },
    { label: 'Pünktlichkeit', wert: '82%',       trend:   1, ampel: 'gelb',  ziel: '90%' },
    { label: 'Bewertung',     wert: '4,6 ★',    trend:   0, ampel: 'gruen', ziel: '4,5 ★' },
    { label: 'Aktive Fahrer', wert: '7',         trend:   1, ampel: 'gruen', ziel: '6+' },
    { label: 'SLA-Rate',      wert: '89%',       trend:  -2, ampel: 'gelb',  ziel: '95%' },
    { label: 'Stornoquote',   wert: '4,2%',      trend:   2, ampel: 'rot',   ziel: '<3%' },
    { label: 'Ø Bestellwert', wert: '€ 20,2',   trend:   1, ampel: 'gruen', ziel: '€ 18' },
    { label: 'Auslastung',    wert: '76%',       trend:   5, ampel: 'gruen', ziel: '70%' },
  ],
  stunden: [
    { stunde: 11, bestellungen: 9,  umsatz_eur: 181 },
    { stunde: 12, bestellungen: 25, umsatz_eur: 501 },
    { stunde: 13, bestellungen: 34, umsatz_eur: 683 },
    { stunde: 14, bestellungen: 19, umsatz_eur: 381 },
    { stunde: 15, bestellungen: 16, umsatz_eur: 319 },
    { stunde: 16, bestellungen: 23, umsatz_eur: 463 },
    { stunde: 17, bestellungen: 37, umsatz_eur: 759 },
  ],
  zonen: [
    { zone: 'Mitte',  bestellungen: 62, avg_liefer_min: 27 },
    { zone: 'Nord',   bestellungen: 48, avg_liefer_min: 32 },
    { zone: 'West',   bestellungen: 35, avg_liefer_min: 29 },
    { zone: 'Süd',    bestellungen: 18, avg_liefer_min: 38 },
  ],
};

function ampelCls(a: 'gruen' | 'gelb' | 'rot') {
  if (a === 'rot')  return { bg: 'bg-red-950/30 border-red-800', val: 'text-red-300' };
  if (a === 'gelb') return { bg: 'bg-amber-950/25 border-amber-700', val: 'text-amber-300' };
  return { bg: 'bg-green-950/20 border-green-800', val: 'text-green-300' };
}

function kpiIcon(label: string) {
  if (label.includes('Fahrer'))  return <Users size={11} />;
  if (label.includes('Bestellungen') || label.includes('SLA')) return <Package size={11} />;
  if (label.includes('Lieferzeit') || label.includes('Pünktlichkeit')) return <Clock size={11} />;
  if (label.includes('Bewertung')) return <Star size={11} />;
  if (label.includes('Umsatz') || label.includes('Bestellwert') || label.includes('Storno')) return <Euro size={11} />;
  return <Activity size={11} />;
}

export function LieferdienstPhase2650StatistikEchtzeitUltimateCockpit({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [chartMode, setChartMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/lieferdienst/stats?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (locationId) load(); else setData(MOCK);
    const p = setInterval(load, 120_000);
    return () => clearInterval(p);
  }, [locationId]);

  const d = data ?? MOCK;

  return (
    <div className="rounded-xl border border-gray-700 shadow mb-4 overflow-hidden bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="text-sm font-bold text-white">Statistiken Echtzeit Ultimate Cockpit</span>
          {d.alerts.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
              <AlertTriangle className="h-2.5 w-2.5" />{d.alerts.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </button>

      {open && (
        <div className="border-t border-gray-700 p-3 space-y-4">
          {/* Alerts */}
          {d.alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-red-950/30 border border-red-800 px-3 py-2 text-xs text-red-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />{a}
            </div>
          ))}

          {/* KPI-Grid 5×2 */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {d.kpis.map(k => {
              const c = ampelCls(k.ampel);
              return (
                <div key={k.label} className={`rounded-lg border p-2 ${c.bg}`}>
                  <div className="flex items-center gap-1 text-gray-500 mb-1">
                    {kpiIcon(k.label)}
                    <span className="text-[9px] truncate">{k.label}</span>
                  </div>
                  <div className={`text-sm font-black tabular-nums ${c.val}`}>{k.wert}</div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className={`text-[9px] flex items-center gap-0.5 ${k.trend > 0 ? 'text-green-400' : k.trend < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                      {k.trend > 0 ? <TrendingUp size={9} /> : k.trend < 0 ? <TrendingDown size={9} /> : null}
                      {k.trend > 0 ? `+${k.trend}%` : k.trend < 0 ? `${k.trend}%` : '—'}
                    </span>
                    <span className="text-[8px] text-gray-600">Ziel {k.ziel}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stundenverlauf-Chart */}
          <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-300">Stundenverlauf</span>
              <div className="flex gap-1">
                {(['bestellungen','umsatz'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setChartMode(m)}
                    className={`text-[9px] font-bold px-2 py-0.5 rounded transition-colors ${chartMode === m ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                  >
                    {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ height: 100 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.stunden} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} tickFormatter={h => `${h}h`} />
                  <Tooltip
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
                    labelFormatter={h => `${h}:00 Uhr`}
                  />
                  <Bar dataKey={chartMode === 'bestellungen' ? 'bestellungen' : 'umsatz_eur'} radius={[3, 3, 0, 0]}>
                    {d.stunden.map((_, i) => (
                      <Cell key={i} fill={i === d.stunden.length - 1 ? '#3b82f6' : '#4b5563'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Zonen-Ranking */}
          <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-3">
            <p className="text-xs font-semibold text-gray-300 mb-2">Zonen-Ranking</p>
            <div className="space-y-1.5">
              {d.zonen.map((z, i) => (
                <div key={z.zone} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-3 text-right">{i + 1}</span>
                  <span className="text-xs text-gray-300 w-14 truncate">{z.zone}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-700"
                      style={{ width: `${(z.bestellungen / d.zonen[0].bestellungen) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 w-6 text-right tabular-nums">{z.bestellungen}</span>
                  <span className="text-[9px] text-gray-500 flex items-center gap-0.5">
                    <Clock size={9} />{z.avg_liefer_min}m
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[9px] text-gray-600 text-right">
            Aktualisiert: {new Date(d.letzte_aktualisierung).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · 2-Min-Polling
          </div>
        </div>
      )}
    </div>
  );
}
