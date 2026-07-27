'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, Euro, Package, TrendingDown, TrendingUp, Users, XCircle } from 'lucide-react';

interface KpiCard {
  key: string;
  label: string;
  value: number;
  unit: string;
  ziel: number;
  higher_is_better: boolean;
  delta_pct: number | null;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  kpis: KpiCard[];
  gesamt_score: number;
  aktive_fahrer: number;
  alert_count: number;
  schicht_umsatz: number;
  schicht_bestellungen: number;
}

const MOCK: ApiData = {
  kpis: [
    { key: 'umsatz',      label: 'Umsatz',        value: 1842,  unit: '€',   ziel: 2000, higher_is_better: true,  delta_pct:  8.2, ampel: 'gelb'  },
    { key: 'bestellungen', label: 'Bestellungen',  value: 47,    unit: '',    ziel: 60,   higher_is_better: true,  delta_pct: 12.4, ampel: 'gelb'  },
    { key: 'puenktlich',  label: 'Pünktlichkeit',  value: 84.2,  unit: '%',   ziel: 90,   higher_is_better: true,  delta_pct: -2.1, ampel: 'gelb'  },
    { key: 'lieferzeit',  label: 'Ø Lieferzeit',   value: 22.4,  unit: 'min', ziel: 25,   higher_is_better: false, delta_pct: -3.5, ampel: 'gruen' },
    { key: 'storno',      label: 'Stornoquote',    value: 2.1,   unit: '%',   ziel: 3,    higher_is_better: false, delta_pct:  0.3, ampel: 'gruen' },
    { key: 'bewertung',   label: 'Ø Bewertung',    value: 4.6,   unit: '★',   ziel: 4.5,  higher_is_better: true,  delta_pct:  0.1, ampel: 'gruen' },
  ],
  gesamt_score: 78,
  aktive_fahrer: 5,
  alert_count: 1,
  schicht_umsatz: 1842,
  schicht_bestellungen: 47,
};

const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-emerald-50 border-emerald-200',
  gelb:  'bg-yellow-50 border-yellow-200',
  rot:   'bg-red-50 border-red-200',
};
const AMPEL_DOT: Record<string, string> = {
  gruen: 'bg-emerald-400',
  gelb:  'bg-yellow-400',
  rot:   'bg-red-400',
};
const AMPEL_VALUE: Record<string, string> = {
  gruen: 'text-emerald-700',
  gelb:  'text-yellow-700',
  rot:   'text-red-700',
};

const KPI_ICON: Record<string, React.ReactNode> = {
  umsatz:       <Euro className="w-3 h-3" />,
  bestellungen: <Package className="w-3 h-3" />,
  puenktlich:   <CheckCircle2 className="w-3 h-3" />,
  lieferzeit:   <Clock className="w-3 h-3" />,
  storno:       <XCircle className="w-3 h-3" />,
  bewertung:    <Activity className="w-3 h-3" />,
};

interface Props {
  locationId: string | null;
}

export function LieferdienstPhase2770StatistikenLiveCockpitKomplett({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/lieferdienst/statistiken-cockpit?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        if (!json.error) setData(json);
      }
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const scoreColor =
    data.gesamt_score >= 80 ? 'text-emerald-600' :
    data.gesamt_score >= 65 ? 'text-yellow-600' : 'text-red-600';

  const alertKpis = data.kpis.filter((k) => k.ampel === 'rot');

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-violet-500" />
          <span className="text-xs font-semibold text-gray-900">Statistiken Live-Cockpit</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {data.alert_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-bold">
              <AlertTriangle className="w-3 h-3" /> {data.alert_count}
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <Users className="w-3 h-3" /> {data.aktive_fahrer} online
          </span>
        </div>
      </div>

      {/* Gesamt-Score */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                data.gesamt_score >= 80 ? 'bg-emerald-400' :
                data.gesamt_score >= 65 ? 'bg-yellow-400' : 'bg-red-400'
              }`}
              style={{ width: `${data.gesamt_score}%` }}
            />
          </div>
        </div>
        <span className={`text-sm font-bold ${scoreColor} min-w-[32px] text-right`}>{data.gesamt_score}</span>
        <span className="text-[9px] text-gray-400">Score</span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {data.kpis.map((k) => (
          <div key={k.key} className={`rounded-lg border p-2 ${AMPEL_BG[k.ampel]}`}>
            <div className="flex items-center gap-1 mb-1">
              <span className={`${AMPEL_VALUE[k.ampel]}`}>{KPI_ICON[k.key]}</span>
              <span className="text-[8px] text-gray-500 truncate">{k.label}</span>
            </div>
            <p className={`text-sm font-bold leading-none ${AMPEL_VALUE[k.ampel]}`}>
              {k.unit === '€' ? `${(k.value).toFixed(0)}€` : `${k.value.toFixed(k.unit === '%' || k.unit === '★' ? 1 : 0)}${k.unit !== '€' ? k.unit : ''}`}
            </p>
            {k.delta_pct !== null && (
              <div className={`flex items-center gap-0.5 mt-0.5 text-[8px] ${
                (k.higher_is_better ? k.delta_pct >= 0 : k.delta_pct <= 0) ? 'text-emerald-600' : 'text-red-500'
              }`}>
                {(k.higher_is_better ? k.delta_pct >= 0 : k.delta_pct <= 0)
                  ? <TrendingUp className="w-2.5 h-2.5" />
                  : <TrendingDown className="w-2.5 h-2.5" />
                }
                {Math.abs(k.delta_pct).toFixed(1)}%
              </div>
            )}
            <div className="w-full h-0.5 bg-gray-200 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full rounded-full ${AMPEL_DOT[k.ampel]}`}
                style={{
                  width: `${Math.min(100, k.higher_is_better
                    ? (k.value / k.ziel) * 100
                    : (k.ziel / Math.max(k.value, 0.1)) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Alert Strip */}
      {alertKpis.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
          <span className="text-[10px] text-red-700 font-semibold">
            Kritisch: {alertKpis.map((k) => k.label).join(', ')}
          </span>
        </div>
      )}

      <div className="flex justify-between text-[9px] text-gray-400 border-t border-gray-100 pt-1">
        <span>Schicht: {data.schicht_bestellungen} Bestellungen</span>
        <span className="font-medium">{(data.schicht_umsatz / 100).toFixed(2).replace('.', ',')} €</span>
        {/* API: /api/delivery/lieferdienst/statistiken-cockpit */}
      </div>
    </div>
  );
}
