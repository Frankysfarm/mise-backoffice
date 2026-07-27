'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Euro, Clock, Bike, Star, Package, Target, BarChart2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiKachel {
  label: string;
  wert: string;
  einheit?: string;
  delta_pct: number | null;
  farbe: 'gruen' | 'gelb' | 'rot' | 'blau' | 'lila';
  icon: 'euro' | 'clock' | 'bike' | 'star' | 'package' | 'target';
}

interface StundenPunkt { stunde: number; umsatz: number; bestellungen: number; }

interface StatData {
  umsatz_heute: number;
  umsatz_ziel: number;
  bestellungen_heute: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_pct: number;
  storno_quote_pct: number;
  trinkgeld_heute: number;
  aktive_fahrer: number;
  bewertung_avg: number;
  kpis: KpiKachel[];
  stunden_verlauf: StundenPunkt[];
}

const MOCK: StatData = {
  umsatz_heute: 1847.50,
  umsatz_ziel: 2200,
  bestellungen_heute: 73,
  avg_lieferzeit_min: 22.4,
  puenktlichkeit_pct: 88,
  storno_quote_pct: 3.2,
  trinkgeld_heute: 142.80,
  aktive_fahrer: 5,
  bewertung_avg: 4.6,
  kpis: [
    { label: 'Umsatz', wert: '1.847', einheit: '€', delta_pct: 12, farbe: 'gruen', icon: 'euro' },
    { label: 'Bestellungen', wert: '73', delta_pct: 8, farbe: 'blau', icon: 'package' },
    { label: 'Ø Lieferzeit', wert: '22.4', einheit: 'min', delta_pct: -5, farbe: 'gruen', icon: 'clock' },
    { label: 'Pünktlichkeit', wert: '88', einheit: '%', delta_pct: 3, farbe: 'gruen', icon: 'target' },
    { label: 'Storno', wert: '3.2', einheit: '%', delta_pct: -1, farbe: 'gelb', icon: 'package' },
    { label: 'Bewertung', wert: '4.6', einheit: '★', delta_pct: 2, farbe: 'gruen', icon: 'star' },
  ],
  stunden_verlauf: [
    { stunde: 11, umsatz: 120, bestellungen: 5 },
    { stunde: 12, umsatz: 280, bestellungen: 11 },
    { stunde: 13, umsatz: 350, bestellungen: 14 },
    { stunde: 14, umsatz: 210, bestellungen: 8 },
    { stunde: 15, umsatz: 150, bestellungen: 6 },
    { stunde: 16, umsatz: 180, bestellungen: 7 },
    { stunde: 17, umsatz: 290, bestellungen: 12 },
    { stunde: 18, umsatz: 267, bestellungen: 10 },
  ],
};

const ICONS: Record<string, React.ElementType> = {
  euro: Euro, clock: Clock, bike: Bike, star: Star, package: Package, target: Target,
};

const FARB_MAP = {
  gruen: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  gelb: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
  rot: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100' },
  blau: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
  lila: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100' },
};

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const pos = pct > 0;
  const Icon = pos ? TrendingUp : TrendingDown;
  return (
    <span className={cn('flex items-center gap-0.5 text-[9px] font-bold', pos ? 'text-emerald-600' : 'text-red-500')}>
      <Icon className="w-2.5 h-2.5" />{pos ? '+' : ''}{pct}%
    </span>
  );
}

interface Props { locationId?: string | null; }

export function LieferdienstPhase4150StatistikenDashboard({ locationId }: Props) {
  const [data, setData] = useState<StatData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [lastLoad, setLastLoad] = useState(Date.now());

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/stats?location_id=${locationId}&period=heute`);
      if (res.ok) { const j = await res.json(); if (!j.error) { setData(j); setLastLoad(Date.now()); } }
    } catch { /* Mock */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  const umsatzPct = Math.min(100, Math.round((data.umsatz_heute / data.umsatz_ziel) * 100));
  const maxUmsatz = Math.max(...data.stunden_verlauf.map(s => s.umsatz), 1);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BarChart2 className="w-4 h-4 text-violet-500" />
          <span className="text-xs font-bold text-gray-900">Statistiken · Heute</span>
        </div>
        <button
          onClick={() => load()}
          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600"
        >
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          {new Date(lastLoad).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </button>
      </div>

      {/* Umsatz-Ziel Balken */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[9px] text-gray-500">Umsatz heute</div>
            <div className="text-xl font-black text-gray-900">{data.umsatz_heute.toFixed(2).replace('.', ',')} €</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-gray-500">Tagesziel</div>
            <div className="text-sm font-bold text-gray-600">{data.umsatz_ziel.toFixed(0)} €</div>
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', umsatzPct >= 100 ? 'bg-emerald-500' : umsatzPct >= 70 ? 'bg-amber-500' : 'bg-red-400')}
              style={{ width: `${umsatzPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-gray-400">
            <span>{umsatzPct}% des Ziels</span>
            <span>noch {(data.umsatz_ziel - data.umsatz_heute).toFixed(0)} € bis Ziel</span>
          </div>
        </div>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {data.kpis.map(kpi => {
          const Icon = ICONS[kpi.icon] ?? Package;
          const f = FARB_MAP[kpi.farbe];
          return (
            <div key={kpi.label} className={cn('rounded-xl border p-2 space-y-0.5', f.bg, f.border)}>
              <div className="flex items-center justify-between">
                <Icon className={cn('w-3 h-3', f.text)} />
                <DeltaBadge pct={kpi.delta_pct} />
              </div>
              <div className={cn('text-base font-black', f.text)}>
                {kpi.wert}{kpi.einheit && <span className="text-[10px] font-normal ml-0.5">{kpi.einheit}</span>}
              </div>
              <div className="text-[9px] text-gray-500">{kpi.label}</div>
            </div>
          );
        })}
      </div>

      {/* Stunden-Verlauf Balkendiagramm */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
        <div className="text-[10px] font-semibold text-gray-600">Umsatz nach Stunde</div>
        <div className="flex items-end gap-1 h-16">
          {data.stunden_verlauf.map(s => {
            const h = Math.round((s.umsatz / maxUmsatz) * 100);
            const isNow = new Date().getHours() === s.stunde;
            return (
              <div key={s.stunde} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full relative" style={{ height: '48px' }}>
                  <div
                    className={cn('w-full rounded-t absolute bottom-0', isNow ? 'bg-violet-500' : 'bg-violet-200')}
                    style={{ height: `${h}%` }}
                  />
                </div>
                <div className="text-[8px] text-gray-400">{s.stunde}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer + Trinkgeld */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="bg-white rounded-xl border border-gray-200 p-2.5 flex items-center gap-2">
          <Bike className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <div>
            <div className="text-base font-black text-blue-700">{data.aktive_fahrer}</div>
            <div className="text-[9px] text-gray-500">Aktive Fahrer</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-2.5 flex items-center gap-2">
          <Euro className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div>
            <div className="text-base font-black text-amber-700">{data.trinkgeld_heute.toFixed(2).replace('.', ',')} €</div>
            <div className="text-[9px] text-gray-500">Trinkgeld heute</div>
          </div>
        </div>
      </div>
    </div>
  );
}
