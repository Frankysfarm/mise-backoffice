'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Minus, AlertTriangle, Activity, RefreshCw } from 'lucide-react';

interface KpiMetric {
  key: string;
  label: string;
  wert: number;
  einheit: string;
  ziel: number;
  delta_pct: number;
  invertiert: boolean; // true = niedrigerer Wert ist besser
}

interface StundenPunkt {
  h: number;
  label: string;
  bestellungen: number;
  umsatz: number;
}

interface DashboardData {
  metrics: KpiMetric[];
  gesamt_score: number;
  insight: string;
  stunden: StundenPunkt[];
  alert_count: number;
}

const MOCK_DATA: DashboardData = {
  gesamt_score: 78,
  insight: 'Lieferzeit 12% über Ziel — Stopp-Koordination optimieren',
  alert_count: 2,
  metrics: [
    { key: 'bestellungen', label: 'Bestellungen', wert: 47, einheit: '', ziel: 55, delta_pct: +8.2, invertiert: false },
    { key: 'umsatz', label: 'Umsatz', wert: 1284, einheit: '€', ziel: 1500, delta_pct: +12.1, invertiert: false },
    { key: 'lieferzeit', label: 'Ø Lieferzeit', wert: 28.4, einheit: 'min', ziel: 25, delta_pct: +12.0, invertiert: true },
    { key: 'puenktlichkeit', label: 'Pünktlichkeit', wert: 84, einheit: '%', ziel: 90, delta_pct: -3.4, invertiert: false },
    { key: 'bewertung', label: 'Kundenbewertung', wert: 4.6, einheit: '⭐', ziel: 4.7, delta_pct: +2.2, invertiert: false },
    { key: 'fahrer_aktiv', label: 'Aktive Fahrer', wert: 6, einheit: '', ziel: 8, delta_pct: -25.0, invertiert: false },
    { key: 'sla_rate', label: 'SLA-Erfüllung', wert: 88, einheit: '%', ziel: 95, delta_pct: -4.1, invertiert: false },
    { key: 'storno_rate', label: 'Storno-Rate', wert: 3.2, einheit: '%', ziel: 2.0, delta_pct: +18.0, invertiert: true },
    { key: 'stopp_effizienz', label: 'Stopp-Effizienz', wert: 2.8, einheit: 'min', ziel: 2.5, delta_pct: +10.7, invertiert: true },
    { key: 'umsatz_fahrer', label: 'Umsatz/Fahrer', wert: 214, einheit: '€', ziel: 200, delta_pct: +7.0, invertiert: false },
  ],
  stunden: [
    { h: 11, label: '11', bestellungen: 4, umsatz: 112 },
    { h: 12, label: '12', bestellungen: 9, umsatz: 248 },
    { h: 13, label: '13', bestellungen: 12, umsatz: 331 },
    { h: 14, label: '14', bestellungen: 7, umsatz: 195 },
    { h: 15, label: '15', bestellungen: 5, umsatz: 138 },
    { h: 16, label: '16', bestellungen: 3, umsatz: 84 },
    { h: 17, label: '17', bestellungen: 7, umsatz: 176 },
  ],
};

function getAmpel(metric: KpiMetric): 'gruen' | 'gelb' | 'rot' {
  const ratio = metric.wert / metric.ziel;
  if (metric.invertiert) {
    if (ratio <= 1.05) return 'gruen';
    if (ratio <= 1.2) return 'gelb';
    return 'rot';
  } else {
    if (ratio >= 0.95) return 'gruen';
    if (ratio >= 0.8) return 'gelb';
    return 'rot';
  }
}

const AMPEL_BG: Record<string, string> = { gruen: 'bg-emerald-50 border-emerald-200', gelb: 'bg-yellow-50 border-yellow-200', rot: 'bg-red-50 border-red-300' };
const AMPEL_TEXT: Record<string, string> = { gruen: 'text-emerald-700', gelb: 'text-yellow-700', rot: 'text-red-700' };
const AMPEL_DOT: Record<string, string> = { gruen: 'bg-emerald-500', gelb: 'bg-yellow-400', rot: 'bg-red-500' };

export function LieferdienstPhase2741StatistikEchtzeitCockpitPro({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<DashboardData>(MOCK_DATA);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');
  const [lastPoll, setLastPoll] = useState(Date.now());

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/statistik-dashboard?location_id=${locationId}`);
      if (res.ok) {
        setData(await res.json());
        setLastPoll(Date.now());
      }
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const maxVal = Math.max(...data.stunden.map(s => mode === 'bestellungen' ? s.bestellungen : s.umsatz), 1);
  const alerts = data.metrics.filter(m => getAmpel(m) === 'rot');
  const scoreColor = data.gesamt_score >= 85 ? 'text-emerald-600' : data.gesamt_score >= 70 ? 'text-yellow-600' : 'text-red-600';
  const scoreBg = data.gesamt_score >= 85 ? 'bg-emerald-500' : data.gesamt_score >= 70 ? 'bg-yellow-400' : 'bg-red-500';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-indigo-500" />
          <span className="font-semibold text-gray-900 text-sm">Statistik Echtzeit-Cockpit Pro</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
          <div className={`text-sm font-black ${scoreColor}`}>Score {data.gesamt_score}/100</div>
        </div>
      </div>

      {/* Gesamt-Score-Balken */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Gesamtperformance</span>
          <span className={`font-bold ${scoreColor}`}>{data.gesamt_score}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${scoreBg}`}
            style={{ width: `${data.gesamt_score}%` }}
          />
        </div>
      </div>

      {/* Insight-Tipp */}
      {data.insight && (
        <div className="flex items-start gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-800">
          <Activity className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-500" />
          <span>{data.insight}</span>
        </div>
      )}

      {/* Alert-Strip */}
      {alerts.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span><strong>{alerts.length} KPI{alerts.length > 1 ? 's' : ''}</strong> kritisch: {alerts.map(m => m.label).join(', ')}</span>
        </div>
      )}

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 gap-2">
        {data.metrics.map(m => {
          const ampel = getAmpel(m);
          const isGood = (m.invertiert ? m.delta_pct <= 0 : m.delta_pct >= 0);
          return (
            <div key={m.key} className={`rounded-lg border p-2.5 ${AMPEL_BG[ampel]}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-2 h-2 rounded-full ${AMPEL_DOT[ampel]}`} />
                <span className="text-[10px] text-gray-500 font-medium">{m.label}</span>
              </div>
              <div className={`text-base font-black ${AMPEL_TEXT[ampel]}`}>
                {m.einheit === '€' ? `${m.wert.toLocaleString('de-DE')}€` :
                 m.einheit === '⭐' ? `⭐ ${m.wert.toFixed(1)}` :
                 m.einheit === '%' ? `${m.wert}%` :
                 m.einheit === 'min' ? `${m.wert.toFixed(1)}m` :
                 m.wert}
                {m.einheit && !['€','⭐','%','min'].includes(m.einheit) ? ` ${m.einheit}` : ''}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {m.delta_pct > 0.5 ? (
                  <TrendingUp className={`w-3 h-3 ${isGood ? 'text-emerald-500' : 'text-red-500'}`} />
                ) : m.delta_pct < -0.5 ? (
                  <TrendingDown className={`w-3 h-3 ${isGood ? 'text-emerald-500' : 'text-red-500'}`} />
                ) : (
                  <Minus className="w-3 h-3 text-gray-400" />
                )}
                <span className={`text-[10px] font-medium ${isGood ? 'text-emerald-600' : 'text-red-600'}`}>
                  {m.delta_pct > 0 ? '+' : ''}{m.delta_pct.toFixed(1)}% vs. Ziel {m.ziel}{m.einheit === 'min' ? 'm' : m.einheit}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stunden-Chart */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">Stundenverlauf</span>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition ${
                  mode === m ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz €'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end gap-1 h-16">
          {data.stunden.map(s => {
            const val = mode === 'bestellungen' ? s.bestellungen : s.umsatz;
            const pct = (val / maxVal) * 100;
            const now = new Date().getHours();
            const isCurrent = s.h === now;
            return (
              <div key={s.h} className="flex-1 flex flex-col items-center gap-0.5 group">
                <div className="w-full relative flex justify-center" style={{ height: '52px' }}>
                  <div
                    className={`absolute bottom-0 w-full rounded-t transition-all duration-500 ${isCurrent ? 'bg-indigo-500' : 'bg-indigo-200 group-hover:bg-indigo-400'}`}
                    style={{ height: `${Math.max(pct, 4)}%` }}
                  />
                </div>
                <span className="text-[9px] text-gray-400">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-[10px] text-gray-400 text-center">60-Sek-Polling · Ampel grün/gelb/rot je KPI-Ziel · mise Smart Delivery</div>
    </div>
  );
}
