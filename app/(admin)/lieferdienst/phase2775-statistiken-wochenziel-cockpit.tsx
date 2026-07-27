'use client';

import { useState, useEffect, useCallback } from 'react';
import { Target, AlertTriangle, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';

interface ZielKpi {
  key: string;
  label: string;
  ist: number;
  ziel: number;
  unit: string;
  higher_is_better: boolean;
  ampel: 'gruen' | 'gelb' | 'rot';
  fortschritt_pct: number;
}

interface ApiData {
  kpis: ZielKpi[];
  gesamt_zielerreichung_pct: number;
  woche_label: string;
  alert_count: number;
}

const MOCK: ApiData = {
  kpis: [
    { key: 'umsatz',       label: 'Wochenumsatz',   ist: 8420,  ziel: 10000, unit: '€',   higher_is_better: true,  ampel: 'gelb',  fortschritt_pct: 84 },
    { key: 'bestellungen', label: 'Bestellungen',   ist: 214,   ziel: 250,   unit: '',    higher_is_better: true,  ampel: 'gelb',  fortschritt_pct: 86 },
    { key: 'puenktlich',   label: 'Pünktlichkeit',  ist: 87.3,  ziel: 90,    unit: '%',   higher_is_better: true,  ampel: 'gelb',  fortschritt_pct: 97 },
    { key: 'lieferzeit',   label: 'Ø Lieferzeit',   ist: 23.1,  ziel: 25,    unit: 'min', higher_is_better: false, ampel: 'gruen', fortschritt_pct: 100 },
    { key: 'bewertung',    label: 'Ø Bewertung',    ist: 4.5,   ziel: 4.5,   unit: '★',   higher_is_better: true,  ampel: 'gruen', fortschritt_pct: 100 },
    { key: 'storno',       label: 'Stornoquote',    ist: 3.4,   ziel: 3,     unit: '%',   higher_is_better: false, ampel: 'rot',   fortschritt_pct: 88 },
  ],
  gesamt_zielerreichung_pct: 92,
  woche_label: 'KW 30',
  alert_count: 1,
};

const AMPEL_BG: Record<string, string> = { gruen: 'bg-emerald-50 border-emerald-200', gelb: 'bg-yellow-50 border-yellow-200', rot: 'bg-red-50 border-red-200' };
const AMPEL_BAR: Record<string, string> = { gruen: 'bg-emerald-400', gelb: 'bg-yellow-400', rot: 'bg-red-400' };
const AMPEL_TEXT: Record<string, string> = { gruen: 'text-emerald-700', gelb: 'text-yellow-700', rot: 'text-red-700' };

interface Props { locationId: string | null; }

export function LieferdienstPhase2775StatistikenWochenZielCockpit({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/lieferdienst/statistiken-wochenziel?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  const scoreColor = data.gesamt_zielerreichung_pct >= 90 ? 'text-emerald-600' : data.gesamt_zielerreichung_pct >= 75 ? 'text-yellow-600' : 'text-red-600';
  const alertKpis = data.kpis.filter(k => k.ampel === 'rot');
  const erreichteZiele = data.kpis.filter(k => k.fortschritt_pct >= 100).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs font-semibold text-gray-900">Wochenziel-Cockpit</span>
          <span className="text-[10px] text-gray-400">{data.woche_label}</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {data.alert_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-bold">
              <AlertTriangle className="w-3 h-3" /> {data.alert_count}
            </span>
          )}
        </div>
      </div>

      {/* Gesamt-Zielerreichung */}
      <div className="flex items-center gap-3 bg-indigo-50 rounded-lg px-3 py-2">
        <div className="flex-1">
          <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${data.gesamt_zielerreichung_pct >= 90 ? 'bg-emerald-400' : data.gesamt_zielerreichung_pct >= 75 ? 'bg-yellow-400' : 'bg-red-400'}`}
              style={{ width: `${data.gesamt_zielerreichung_pct}%` }}
            />
          </div>
        </div>
        <span className={`text-sm font-bold min-w-[36px] text-right ${scoreColor}`}>{data.gesamt_zielerreichung_pct}%</span>
        <div className="flex items-center gap-0.5 text-[10px] text-indigo-500">
          <CheckCircle2 className="w-3 h-3" /> {erreichteZiele}/{data.kpis.length}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {data.kpis.map((k) => (
          <div key={k.key} className={`rounded-lg border p-2 ${AMPEL_BG[k.ampel]}`}>
            <p className="text-[8px] text-gray-500 truncate mb-0.5">{k.label}</p>
            <p className={`text-xs font-bold leading-none ${AMPEL_TEXT[k.ampel]}`}>
              {k.unit === '€' ? `${k.ist.toFixed(0)}€` : `${k.ist.toFixed(k.unit === '%' || k.unit === '★' ? 1 : 0)}${k.unit !== '€' ? k.unit : ''}`}
            </p>
            <p className="text-[8px] text-gray-400 mt-0.5">
              Ziel: {k.unit === '€' ? `${k.ziel}€` : `${k.ziel}${k.unit !== '€' ? k.unit : ''}`}
            </p>
            <div className="w-full h-0.5 bg-gray-200 rounded-full overflow-hidden mt-1">
              <div className={`h-full rounded-full ${AMPEL_BAR[k.ampel]}`} style={{ width: `${Math.min(100, k.fortschritt_pct)}%` }} />
            </div>
            <div className={`flex items-center gap-0.5 mt-0.5 text-[8px] ${k.ampel === 'gruen' ? 'text-emerald-600' : k.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-600'}`}>
              {k.fortschritt_pct >= 100 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
              {k.fortschritt_pct.toFixed(0)}%
            </div>
          </div>
        ))}
      </div>

      {alertKpis.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
          <span className="text-[10px] text-red-700 font-semibold">Ziel verfehlt: {alertKpis.map(k => k.label).join(', ')}</span>
        </div>
      )}

      <p className="text-[9px] text-gray-400 text-right">API: /api/delivery/lieferdienst/statistiken-wochenziel · 60s</p>
    </div>
  );
}
