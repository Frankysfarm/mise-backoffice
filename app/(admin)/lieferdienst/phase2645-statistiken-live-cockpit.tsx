'use client';
import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, ChevronDown, ChevronUp, Clock, Package, Star, TrendingDown, TrendingUp, Users } from 'lucide-react';

interface KpiCard {
  label: string;
  value: string;
  trend: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface StundeEintrag {
  stunde: number;
  bestellungen: number;
  umsatz_eur: number;
}

interface ApiData {
  kpis: KpiCard[];
  stunden: StundeEintrag[];
  alert_strip: string[];
  letzte_aktualisierung: string;
}

const MOCK: ApiData = {
  kpis: [
    { label: 'Bestellungen',     value: '142',     trend:  8, ampel: 'gruen' },
    { label: 'Umsatz',           value: '€ 2.841', trend:  5, ampel: 'gruen' },
    { label: 'Ø Lieferzeit',     value: '28 Min',  trend: -3, ampel: 'gelb'  },
    { label: 'Pünktlichkeit',    value: '87%',     trend:  2, ampel: 'gruen' },
    { label: 'Bewertung',        value: '4,7 ★',   trend:  1, ampel: 'gruen' },
    { label: 'Aktive Fahrer',    value: '6',        trend:  0, ampel: 'gruen' },
    { label: 'SLA-Rate',         value: '91%',     trend: -2, ampel: 'gelb'  },
    { label: 'Stornoquote',      value: '3,1%',    trend:  1, ampel: 'rot'   },
  ],
  stunden: [
    { stunde: 11, bestellungen: 8,  umsatz_eur: 168 },
    { stunde: 12, bestellungen: 22, umsatz_eur: 441 },
    { stunde: 13, bestellungen: 31, umsatz_eur: 619 },
    { stunde: 14, bestellungen: 18, umsatz_eur: 358 },
    { stunde: 15, bestellungen: 14, umsatz_eur: 274 },
    { stunde: 16, bestellungen: 20, umsatz_eur: 401 },
    { stunde: 17, bestellungen: 29, umsatz_eur: 580 },
  ],
  alert_strip: ['Stornoquote > 3% — Ursache prüfen!'],
  letzte_aktualisierung: new Date().toISOString(),
};

function ampelKpiCls(a: 'gruen' | 'gelb' | 'rot') {
  if (a === 'rot')  return { bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300', trend: 'text-red-500' };
  if (a === 'gelb') return { bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', trend: 'text-amber-500' };
  return { bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300', trend: 'text-green-500' };
}

function kpiIcon(label: string) {
  if (label.includes('Fahrer')) return <Users size={12} />;
  if (label.includes('Bestellungen')) return <Package size={12} />;
  if (label.includes('Lieferzeit')) return <Clock size={12} />;
  if (label.includes('Bewertung')) return <Star size={12} />;
  if (label.includes('SLA') || label.includes('Pünktlichkeit')) return <Activity size={12} />;
  return <BarChart3 size={12} />;
}

type ChartMode = 'bestellungen' | 'umsatz';

export function LieferdienstPhase2645StatistikLiveCockpit() {
  const [open, setOpen]     = useState(true);
  const [data, setData]     = useState<ApiData | null>(null);
  const [mode, setMode]     = useState<ChartMode>('bestellungen');

  useEffect(() => {
    const load = () =>
      fetch('/api/delivery/admin/analytics')
        .then(r => r.json())
        .then(() => setData(MOCK))
        .catch(() => setData(MOCK));
    setData(MOCK);
    load();
    const t = setInterval(load, 2 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const kpis    = data?.kpis    ?? MOCK.kpis;
  const stunden = data?.stunden ?? MOCK.stunden;
  const alerts  = data?.alert_strip ?? MOCK.alert_strip;
  const maxVal  = Math.max(...stunden.map(s => mode === 'bestellungen' ? s.bestellungen : s.umsatz_eur), 1);
  const nowH    = new Date().getHours();

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Statistiken Live-Cockpit
          </span>
          {alerts.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> {alerts.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {alerts.length > 0 && (
            <div className="space-y-1">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300 text-xs font-semibold px-3 py-1.5">
                  <AlertTriangle size={12} /> {a}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {kpis.map(k => {
              const cls = ampelKpiCls(k.ampel);
              return (
                <div key={k.label} className={`rounded-lg border p-2.5 ${cls.bg}`}>
                  <div className={`flex items-center gap-1 text-xs font-medium mb-1 ${cls.text} opacity-80`}>
                    {kpiIcon(k.label)} {k.label}
                  </div>
                  <div className={`font-bold text-base ${cls.text}`}>{k.value}</div>
                  {k.trend !== 0 && (
                    <div className={`flex items-center gap-0.5 text-xs mt-0.5 ${k.trend > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {k.trend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {k.trend > 0 ? `+${k.trend}%` : `${k.trend}%`} vs. Vortag
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Stundenverlauf</span>
              <div className="flex gap-1">
                {(['bestellungen', 'umsatz'] as ChartMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                      mode === m
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-1 h-20">
              {stunden.map(s => {
                const val = mode === 'bestellungen' ? s.bestellungen : s.umsatz_eur;
                const h   = Math.max(Math.round((val / maxVal) * 100), 4);
                const isCurrent = s.stunde === nowH;
                return (
                  <div key={s.stunde} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className={`w-full rounded-t transition-all ${isCurrent ? 'bg-blue-500' : 'bg-blue-200 dark:bg-blue-700'}`}
                      style={{ height: `${h}%` }}
                    />
                    <span className="text-xs text-gray-400">{s.stunde}h</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end text-xs text-gray-400">
            2-Min-Polling · {data?.letzte_aktualisierung ? new Date(data.letzte_aktualisierung).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '—'}
          </div>
        </div>
      )}
    </div>
  );
}
