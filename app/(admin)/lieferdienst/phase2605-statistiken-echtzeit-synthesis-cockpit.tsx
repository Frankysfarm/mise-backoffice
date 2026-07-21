'use client';

import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import { Activity, AlertTriangle, Clock, Euro, Package, Star, TrendingDown, TrendingUp, Users } from 'lucide-react';

interface KPI {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  alert?: boolean;
  icon: React.ReactNode;
  color: 'green' | 'amber' | 'rose' | 'blue';
}

const COLOR_MAP = {
  green: { bg: 'bg-matcha-50',  border: 'border-matcha-200',  text: 'text-matcha-700',  badge: 'bg-matcha-100' },
  amber: { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100' },
  rose:  { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700',    badge: 'bg-rose-100' },
  blue:  { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    badge: 'bg-blue-100' },
};

const MOCK_STUNDEN: Array<{ h: string; bestellungen: number; umsatz: number }> = [
  { h: '10', bestellungen: 4, umsatz: 120 },
  { h: '11', bestellungen: 7, umsatz: 210 },
  { h: '12', bestellungen: 15, umsatz: 450 },
  { h: '13', bestellungen: 18, umsatz: 540 },
  { h: '14', bestellungen: 11, umsatz: 330 },
  { h: '15', bestellungen: 8, umsatz: 240 },
  { h: '16', bestellungen: 9, umsatz: 270 },
  { h: '17', bestellungen: 16, umsatz: 480 },
  { h: '18', bestellungen: 22, umsatz: 660 },
  { h: '19', bestellungen: 25, umsatz: 750 },
  { h: '20', bestellungen: 20, umsatz: 600 },
  { h: '21', bestellungen: 12, umsatz: 360 },
];

type ChartMode = 'bestellungen' | 'umsatz';

export function LieferdienstPhase2605StatistikenEchtzeitSynthesisCockpit({
  bestellungen = 87,
  umsatz = 2640,
  lieferzeit = 28,
  aktiveFahrer = 6,
  slaQuote = 91,
  bewertung = 4.6,
  stornoquote = 3.2,
  neukundenAnteil = 18,
  stundenDaten,
}: {
  bestellungen?: number;
  umsatz?: number;
  lieferzeit?: number;
  aktiveFahrer?: number;
  slaQuote?: number;
  bewertung?: number;
  stornoquote?: number;
  neukundenAnteil?: number;
  stundenDaten?: Array<{ h: string; bestellungen: number; umsatz: number }>;
}) {
  const [chartMode, setChartMode] = useState<ChartMode>('bestellungen');
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const iv = setInterval(() => setLastUpdate(new Date()), 5 * 60_000);
    return () => clearInterval(iv);
  }, []);

  const data = stundenDaten ?? MOCK_STUNDEN;
  const maxVal = Math.max(...data.map(d => chartMode === 'bestellungen' ? d.bestellungen : d.umsatz));
  const currentHour = new Date().getHours().toString();

  const kpis: KPI[] = [
    {
      label: 'Bestellungen',
      value: bestellungen.toString(),
      sub: 'heute gesamt',
      trend: +5,
      icon: <Package className="h-4 w-4" />,
      color: 'green',
    },
    {
      label: 'Umsatz',
      value: `${umsatz.toLocaleString('de-DE')} €`,
      sub: 'heute gesamt',
      trend: +8,
      icon: <Euro className="h-4 w-4" />,
      color: 'green',
    },
    {
      label: 'Ø Lieferzeit',
      value: `${lieferzeit} Min`,
      sub: 'Ziel ≤30 Min',
      alert: lieferzeit > 35,
      trend: lieferzeit > 30 ? -3 : +2,
      icon: <Clock className="h-4 w-4" />,
      color: lieferzeit > 35 ? 'rose' : lieferzeit > 30 ? 'amber' : 'green',
    },
    {
      label: 'Aktive Fahrer',
      value: aktiveFahrer.toString(),
      sub: 'online',
      icon: <Users className="h-4 w-4" />,
      color: aktiveFahrer < 3 ? 'rose' : 'blue',
    },
    {
      label: 'SLA-Quote',
      value: `${slaQuote} %`,
      sub: 'Ziel ≥95 %',
      alert: slaQuote < 85,
      trend: slaQuote >= 90 ? +2 : -4,
      icon: <Activity className="h-4 w-4" />,
      color: slaQuote >= 95 ? 'green' : slaQuote >= 85 ? 'amber' : 'rose',
    },
    {
      label: 'Bewertung',
      value: `${bewertung.toFixed(1)} ★`,
      sub: 'Kundenzufriedenheit',
      icon: <Star className="h-4 w-4" />,
      color: bewertung >= 4.5 ? 'green' : bewertung >= 4.0 ? 'amber' : 'rose',
    },
    {
      label: 'Stornoquote',
      value: `${stornoquote.toFixed(1)} %`,
      sub: 'Ziel <3 %',
      alert: stornoquote >= 5,
      trend: stornoquote < 3 ? +1 : -2,
      icon: <AlertTriangle className="h-4 w-4" />,
      color: stornoquote < 3 ? 'green' : stornoquote < 5 ? 'amber' : 'rose',
    },
    {
      label: 'Neukunden',
      value: `${neukundenAnteil} %`,
      sub: 'Anteil heute',
      icon: <TrendingUp className="h-4 w-4" />,
      color: 'blue',
    },
  ];

  const alertCount = kpis.filter(k => k.alert).length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-gradient-to-r from-stone-50 to-white">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100">
            <Activity className="h-3.5 w-3.5 text-matcha-700" />
          </div>
          <div>
            <div className="text-xs font-black tracking-wide uppercase text-char">Statistiken · Echtzeit-Synthese</div>
            <div className="text-[10px] text-stone-400">
              Aktualisiert {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · 5-Min-Polling
            </div>
          </div>
        </div>
        {alertCount > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5">
            <AlertTriangle className="h-3 w-3 text-rose-600" />
            <span className="text-[10px] font-bold text-rose-600">{alertCount} Alerts</span>
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-y divide-stone-100">
        {kpis.map(k => {
          const cs = COLOR_MAP[k.color];
          return (
            <div key={k.label} className={cn('px-3 py-3 relative', k.alert && 'ring-1 ring-inset ring-rose-300')}>
              <div className="flex items-center justify-between mb-1">
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-lg', cs.badge, cs.text)}>
                  {k.icon}
                </div>
                {k.trend !== undefined && (
                  <div className={cn('flex items-center gap-0.5 text-[9px] font-bold',
                    k.trend > 0 ? 'text-matcha-600' : 'text-rose-600'
                  )}>
                    {k.trend > 0
                      ? <TrendingUp className="h-2.5 w-2.5" />
                      : <TrendingDown className="h-2.5 w-2.5" />}
                    {Math.abs(k.trend)}%
                  </div>
                )}
              </div>
              <div className={cn('text-lg font-black leading-none', cs.text)}>{k.value}</div>
              <div className="text-[9px] text-stone-400 mt-0.5">{k.sub ?? k.label}</div>
              {k.alert && (
                <div className="absolute top-1.5 right-1.5">
                  <AlertTriangle className="h-3 w-3 text-rose-500" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="border-t border-stone-100">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-[10px] font-black text-stone-500 uppercase tracking-wide">Stundenverlauf</span>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz'] as ChartMode[]).map(m => (
              <button
                key={m}
                onClick={() => setChartMode(m)}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[9px] font-bold transition-colors',
                  chartMode === m ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200',
                )}
              >
                {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz (€)'}
              </button>
            ))}
          </div>
        </div>

        <div className="px-2 pb-3 h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="h" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #e7e5e4' }}
                labelFormatter={l => `${l}:00 Uhr`}
                formatter={(v: number) => chartMode === 'umsatz' ? [`${v} €`, 'Umsatz'] : [v, 'Bestellungen']}
              />
              <Bar dataKey={chartMode} radius={[3, 3, 0, 0]}>
                {data.map(d => (
                  <Cell key={d.h} fill={d.h === currentHour ? '#4a7c59' : '#d6d3d1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
