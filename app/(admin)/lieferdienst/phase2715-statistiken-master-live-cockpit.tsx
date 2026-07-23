'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3, Euro, Clock, Star, Bike, Target, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPI {
  key: string;
  label: string;
  wert: number | null;
  einheit: string;
  ziel: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  delta_pct: number | null;
  besser_wenn: 'hoch' | 'niedrig';
}

interface ApiResponse {
  kpis: KPI[];
  gesamt_score: number;
  insight: string | null;
  schicht_umsatz: number;
  schicht_lieferungen: number;
}

const MOCK: ApiResponse = {
  kpis: [
    { key: 'umsatz',          label: 'Umsatz',            wert: 1840,  einheit: '€',    ziel: 2000, ampel: 'gelb',  delta_pct: 8.2,   besser_wenn: 'hoch' },
    { key: 'lieferungen',     label: 'Lieferungen',       wert: 47,    einheit: '',     ziel: 55,   ampel: 'gelb',  delta_pct: 11.3,  besser_wenn: 'hoch' },
    { key: 'avg_lieferzeit',  label: 'Ø Lieferzeit',      wert: 28,    einheit: 'min',  ziel: 30,   ampel: 'gruen', delta_pct: -4.5,  besser_wenn: 'niedrig' },
    { key: 'sla_rate',        label: 'SLA-Rate',          wert: 91,    einheit: '%',    ziel: 90,   ampel: 'gruen', delta_pct: 2.1,   besser_wenn: 'hoch' },
    { key: 'storno_rate',     label: 'Storno-Rate',       wert: 3.2,   einheit: '%',    ziel: 5,    ampel: 'gruen', delta_pct: -8.0,  besser_wenn: 'niedrig' },
    { key: 'bewertung',       label: 'Ø Bewertung',       wert: 4.7,   einheit: '★',    ziel: 4.5,  ampel: 'gruen', delta_pct: 1.5,   besser_wenn: 'hoch' },
    { key: 'fahrer_aktiv',    label: 'Aktive Fahrer',     wert: 6,     einheit: '',     ziel: 7,    ampel: 'gelb',  delta_pct: null,  besser_wenn: 'hoch' },
    { key: 'leerfahrten',     label: 'Leerfahrten',       wert: 2,     einheit: '',     ziel: 3,    ampel: 'gruen', delta_pct: -33.3, besser_wenn: 'niedrig' },
  ],
  gesamt_score: 82,
  insight: 'Lieferzeit liegt unter Ziel — gute Schicht. Umsatz kann noch zulegen.',
  schicht_umsatz: 1840,
  schicht_lieferungen: 47,
};

const AMPEL = {
  gruen: { text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-500' },
  gelb:  { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-400' },
  rot:   { text: 'text-red-700',   bg: 'bg-red-50',   border: 'border-red-200',   dot: 'bg-red-500'   },
};

function scoreRing(score: number) {
  if (score >= 85) return 'text-green-600';
  if (score >= 65) return 'text-amber-600';
  return 'text-red-600';
}

export function LieferdienstPhase2715StatistikenMasterLiveCockpit({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);

  const fetchData = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/statistiken-intelligence?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (d?.kpis?.length) setData(d);
      }
    } catch {}
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 60_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const rotKpis = data.kpis.filter(k => k.ampel === 'rot');

  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-semibold text-purple-800">Statistiken Master Live-Cockpit</span>
        </div>
        <div className={cn('text-sm font-bold tabular-nums', scoreRing(data.gesamt_score))}>
          Score {data.gesamt_score}/100
        </div>
      </div>

      {/* Alert: Rote KPIs */}
      {rotKpis.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700">Unter Ziel: {rotKpis.map(k => k.label).join(', ')}</p>
        </div>
      )}

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 gap-2">
        {data.kpis.map(kpi => {
          const c = AMPEL[kpi.ampel];
          const delta = kpi.delta_pct;
          const isGoodDelta = kpi.besser_wenn === 'hoch' ? (delta ?? 0) > 0 : (delta ?? 0) < 0;

          return (
            <div key={kpi.key} className={cn('rounded-lg border p-2', c.bg, c.border)}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">{kpi.label}</span>
                <div className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className={cn('text-lg font-bold tabular-nums', c.text)}>
                  {kpi.wert !== null ? kpi.wert : '–'}
                </span>
                <span className="text-xs text-gray-400">{kpi.einheit}</span>
              </div>
              {delta !== null && (
                <div className={cn('flex items-center gap-0.5 text-xs mt-0.5', isGoodDelta ? 'text-green-600' : 'text-red-500')}>
                  {isGoodDelta ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>{delta > 0 ? '+' : ''}{delta.toFixed(1)}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Insight */}
      {data.insight && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 p-2">
          <TrendingUp className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700">{data.insight}</p>
        </div>
      )}

      {/* Schicht-Summary Footer */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-purple-200">
        <div className="text-center">
          <p className="text-xs text-gray-500">Schicht-Umsatz</p>
          <p className="text-base font-bold text-gray-800">{data.schicht_umsatz.toLocaleString('de-DE')} €</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">Lieferungen</p>
          <p className="text-base font-bold text-gray-800">{data.schicht_lieferungen}</p>
        </div>
      </div>
    </div>
  );
}
