'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, TrendingDown, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface KpiCard {
  key: string;
  label: string;
  wert: string;
  ziel: string;
  trend: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface StundenPunkt {
  stunde: string;
  bestellungen: number;
  umsatz: number;
}

interface ApiData {
  kpis: KpiCard[];
  stunden: StundenPunkt[];
  alert_count: number;
  letzte_aktualisierung: string;
}

const MOCK: ApiData = {
  kpis: [
    { key: 'bestellungen',  label: 'Bestellungen',      wert: '147',    ziel: '120',  trend:  8,  ampel: 'gruen' },
    { key: 'umsatz',        label: 'Umsatz',             wert: '2.840€', ziel: '2k€',  trend:  12, ampel: 'gruen' },
    { key: 'lieferzeit',    label: 'Ø Lieferzeit',       wert: '28 min', ziel: '≤30',  trend: -2,  ampel: 'gruen' },
    { key: 'ontime',        label: 'On-Time Rate',        wert: '88 %',   ziel: '≥90%', trend: -1,  ampel: 'gelb'  },
    { key: 'bewertung',     label: 'Ø Bewertung',        wert: '4.4 ★',  ziel: '≥4.5', trend:  0,  ampel: 'gelb'  },
    { key: 'fahrer',        label: 'Aktive Fahrer',      wert: '7',      ziel: '6',    trend:  1,  ampel: 'gruen' },
    { key: 'sla',           label: 'SLA-Erfüllung',      wert: '92 %',   ziel: '≥95%', trend: -3,  ampel: 'gelb'  },
    { key: 'storno',        label: 'Stornoquote',        wert: '3.2 %',  ziel: '≤5%',  trend: -1,  ampel: 'gruen' },
    { key: 'trinkgeld',     label: 'Ø Trinkgeld',        wert: '1.80€',  ziel: '≥1€',  trend:  5,  ampel: 'gruen' },
    { key: 'umsatz_fahrer', label: 'Umsatz/Fahrer',      wert: '405€',   ziel: '≥300€',trend:  4,  ampel: 'gruen' },
  ],
  stunden: [
    { stunde: '10', bestellungen: 4,  umsatz: 78  },
    { stunde: '11', bestellungen: 9,  umsatz: 175 },
    { stunde: '12', bestellungen: 22, umsatz: 430 },
    { stunde: '13', bestellungen: 28, umsatz: 548 },
    { stunde: '14', bestellungen: 19, umsatz: 372 },
    { stunde: '15', bestellungen: 12, umsatz: 234 },
    { stunde: '16', bestellungen: 15, umsatz: 292 },
    { stunde: '17', bestellungen: 25, umsatz: 490 },
    { stunde: '18', bestellungen: 13, umsatz: 221 },
  ],
  alert_count: 2,
  letzte_aktualisierung: new Date().toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' }),
};

function ampelCls(a: string) {
  if (a === 'rot')  return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700';
  if (a === 'gelb') return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700';
  return                   'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700';
}

export function LieferdienstPhase2630StatistikenLiveKomplett({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [chartMode, setChartMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/admin/overview?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (locationId) load();
    else setData(MOCK);
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [locationId]);

  const kpis = data?.kpis ?? [];
  const stunden = data?.stunden ?? [];
  const alerts = kpis.filter(k => k.ampel === 'rot');

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Statistiken Live Komplett</span>
          {(data?.alert_count ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 dark:bg-red-900/40 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> {data?.alert_count}
            </span>
          )}
          <span className="text-xs text-gray-400 ml-1">Aktualisiert: {data?.letzte_aktualisierung ?? '—'}</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {alerts.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-xs font-semibold px-3 py-2">
              <AlertTriangle size={14} />
              {alerts.map(k => k.label).join(' · ')} — Unter Zielwert!
            </div>
          )}

          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-2">
            {kpis.map(kpi => (
              <div key={kpi.key} className={`rounded-lg border p-2.5 ${ampelCls(kpi.ampel)}`}>
                <div className="text-xs font-medium opacity-70 mb-0.5">{kpi.label}</div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base">{kpi.wert}</span>
                  <div className="flex items-center gap-0.5 text-xs">
                    {kpi.trend > 0 ? <TrendingUp size={10} className="text-green-500" /> : kpi.trend < 0 ? <TrendingDown size={10} className="text-red-400" /> : null}
                    <span className="opacity-60">{kpi.ziel}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Stundenverlauf Chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Stundenverlauf</span>
              <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-gray-600 text-xs">
                <button
                  onClick={() => setChartMode('bestellungen')}
                  className={`px-2 py-0.5 font-medium transition-colors ${chartMode === 'bestellungen' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                  Bestellungen
                </button>
                <button
                  onClick={() => setChartMode('umsatz')}
                  className={`px-2 py-0.5 font-medium transition-colors ${chartMode === 'umsatz' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                  Umsatz
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={stunden} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="stunde" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => chartMode === 'umsatz' ? [`${v}€`, 'Umsatz'] : [v, 'Bestellungen']}
                  contentStyle={{ fontSize: 11, borderRadius: 6 }}
                />
                <Bar dataKey={chartMode} radius={[3, 3, 0, 0]}>
                  {stunden.map((entry, i) => (
                    <Cell key={i} fill={chartMode === 'bestellungen' ? '#3b82f6' : '#10b981'} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
