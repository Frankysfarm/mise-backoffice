'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, TrendingDown, AlertTriangle, Activity, RefreshCw, Zap } from 'lucide-react';

interface KpiKachel {
  key: string;
  label: string;
  wert: number;
  einheit: string;
  ziel: number;
  delta_pct: number;
  invertiert: boolean;
  prognose: number | null;
}

interface ZoneRow {
  name: string;
  bestellungen: number;
  lieferzeit_min: number;
  sla_pct: number;
}

interface DashboardData {
  metrics: KpiKachel[];
  gesamt_score: number;
  insight: string;
  zonen: ZoneRow[];
  last_updated: string;
}

const MOCK: DashboardData = {
  gesamt_score: 81,
  insight: 'Zone Nord 8% über Ziellieferzeit — Fahrer-Umverteilung empfohlen',
  last_updated: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  metrics: [
    { key: 'bestellungen', label: 'Bestellungen', wert: 54, einheit: '', ziel: 60, delta_pct: +6.0, invertiert: false, prognose: 68 },
    { key: 'umsatz', label: 'Umsatz', wert: 1432, einheit: '€', ziel: 1600, delta_pct: +9.2, invertiert: false, prognose: 1820 },
    { key: 'lieferzeit', label: 'Ø Lieferzeit', wert: 27.1, einheit: 'min', ziel: 25, delta_pct: +8.4, invertiert: true, prognose: 26.0 },
    { key: 'puenktlichkeit', label: 'Pünktlichkeit', wert: 87, einheit: '%', ziel: 90, delta_pct: -2.2, invertiert: false, prognose: 89 },
    { key: 'bewertung', label: 'Kundenbewertung', wert: 4.7, einheit: '⭐', ziel: 4.7, delta_pct: +1.1, invertiert: false, prognose: null },
    { key: 'aktive_fahrer', label: 'Aktive Fahrer', wert: 7, einheit: '', ziel: 8, delta_pct: -12.5, invertiert: false, prognose: null },
    { key: 'sla', label: 'SLA-Erfüllung', wert: 91, einheit: '%', ziel: 95, delta_pct: -1.8, invertiert: false, prognose: 93 },
    { key: 'storno', label: 'Storno-Rate', wert: 2.8, einheit: '%', ziel: 2.0, delta_pct: +15.0, invertiert: true, prognose: 2.4 },
  ],
  zonen: [
    { name: 'Mitte', bestellungen: 22, lieferzeit_min: 24.5, sla_pct: 94 },
    { name: 'Nord', bestellungen: 14, lieferzeit_min: 31.2, sla_pct: 82 },
    { name: 'Süd', bestellungen: 11, lieferzeit_min: 26.8, sla_pct: 89 },
    { name: 'West', bestellungen: 7, lieferzeit_min: 22.1, sla_pct: 97 },
  ],
};

function ampel(m: KpiKachel): 'gruen' | 'gelb' | 'rot' {
  const ratio = m.invertiert ? m.ziel / m.wert : m.wert / m.ziel;
  if (ratio >= 0.95) return 'gruen';
  if (ratio >= 0.80) return 'gelb';
  return 'rot';
}

const ampelCls = { gruen: 'bg-emerald-500', gelb: 'bg-yellow-400', rot: 'bg-red-500' };
const ampelTxt = { gruen: 'text-emerald-700', gelb: 'text-yellow-700', rot: 'text-red-700' };
const ampelBg  = { gruen: 'bg-emerald-50 border-emerald-200', gelb: 'bg-yellow-50 border-yellow-200', rot: 'bg-red-50 border-red-200' };

function fmt(wert: number, einheit: string) {
  if (einheit === '€') return `${wert.toLocaleString('de-DE')}€`;
  if (einheit === 'min') return `${wert}min`;
  if (einheit === '%') return `${wert}%`;
  if (einheit === '⭐') return `${wert}★`;
  return `${wert}`;
}

export function LieferdienstPhase2746StatistikLiveCommandPro({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<DashboardData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/statistik-live-command?location_id=${locationId}`);
      if (res.ok) {
        const d = await res.json();
        setData({ ...d, last_updated: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) });
      }
    } catch { /* Mock-Fallback */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 60000); return () => clearInterval(id); }, [load]);

  const kritis = data.metrics.filter(m => ampel(m) === 'rot');

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-indigo-600" />
        <span className="font-semibold text-sm text-slate-800">Statistiken Live Command Pro</span>
        {loading && <RefreshCw className="h-3 w-3 text-slate-400 animate-spin ml-1" />}
        <span className="ml-auto text-[10px] text-slate-400">aktualisiert {data.last_updated}</span>
      </div>

      {/* Gesamt-Score */}
      <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-slate-50 border border-indigo-100 p-3">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center justify-center h-12 w-12 rounded-full border-4 border-indigo-200 bg-white shrink-0">
            <span className="text-lg font-black text-indigo-700 leading-none">{data.gesamt_score}</span>
            <span className="text-[8px] text-indigo-400">/100</span>
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-semibold text-indigo-700 mb-0.5">Schicht-Score</div>
            <div className="h-1.5 rounded-full bg-indigo-100 overflow-hidden mb-1">
              <div className={`h-full rounded-full transition-all ${data.gesamt_score >= 80 ? 'bg-indigo-500' : data.gesamt_score >= 65 ? 'bg-yellow-400' : 'bg-red-500'}`}
                style={{ width: `${data.gesamt_score}%` }} />
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-600">
              <Zap className="h-3 w-3 text-indigo-400" />
              <span className="italic">{data.insight}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alert-Strip */}
      {kritis.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
          <span className="text-xs text-red-700 font-medium">
            {kritis.length} KPI{kritis.length > 1 ? 's' : ''} kritisch: {kritis.map(k => k.label).join(', ')}
          </span>
        </div>
      )}

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 gap-2">
        {data.metrics.map(m => {
          const a = ampel(m);
          const isPos = m.invertiert ? m.delta_pct < 0 : m.delta_pct > 0;
          return (
            <div key={m.key} className={`rounded-lg border p-2 ${ampelBg[a]}`}>
              <div className="flex items-start justify-between gap-1">
                <span className="text-[10px] text-slate-500 leading-tight">{m.label}</span>
                {isPos
                  ? <TrendingUp className="h-3 w-3 text-emerald-500 shrink-0" />
                  : <TrendingDown className="h-3 w-3 text-red-500 shrink-0" />
                }
              </div>
              <div className={`text-sm font-bold ${ampelTxt[a]}`}>{fmt(m.wert, m.einheit)}</div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[9px] text-slate-400">Ziel: {fmt(m.ziel, m.einheit)}</span>
                <span className={`text-[9px] font-semibold ${isPos ? 'text-emerald-600' : 'text-red-600'}`}>
                  {m.delta_pct > 0 ? '+' : ''}{m.delta_pct.toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-white/70 overflow-hidden">
                <div className={`h-full rounded-full ${ampelCls[a]}`}
                  style={{ width: `${Math.min(100, m.invertiert ? (m.ziel / m.wert) * 100 : (m.wert / m.ziel) * 100)}%` }} />
              </div>
              {m.prognose != null && (
                <div className="text-[9px] text-slate-400 mt-0.5">Prognose: {fmt(m.prognose, m.einheit)}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Zonen-Ranking */}
      <div>
        <div className="text-[10px] font-semibold text-slate-600 mb-1.5">Zonen-Ranking</div>
        <div className="space-y-1">
          {data.zonen.sort((a, b) => b.sla_pct - a.sla_pct).map((z, i) => (
            <div key={z.name} className="flex items-center gap-2 text-xs">
              <span className="text-[10px] text-slate-400 w-4">#{i + 1}</span>
              <span className="w-12 font-medium text-slate-700">{z.name}</span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${z.sla_pct >= 90 ? 'bg-emerald-500' : z.sla_pct >= 80 ? 'bg-yellow-400' : 'bg-red-500'}`}
                  style={{ width: `${z.sla_pct}%` }} />
              </div>
              <span className={`text-[10px] font-bold w-10 text-right ${z.sla_pct >= 90 ? 'text-emerald-700' : z.sla_pct >= 80 ? 'text-yellow-700' : 'text-red-700'}`}>
                {z.sla_pct}%
              </span>
              <span className="text-[9px] text-slate-400">{z.lieferzeit_min}min</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1 text-[10px] text-slate-400">
        <Activity className="h-3 w-3" />
        Live · 60-Sek-Polling · Mock-Fallback aktiv
      </div>
    </div>
  );
}
