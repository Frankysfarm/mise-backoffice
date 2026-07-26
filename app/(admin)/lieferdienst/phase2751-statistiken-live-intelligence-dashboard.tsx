'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Clock, Bike, Euro, Star, AlertTriangle, BarChart3, Target } from 'lucide-react';

interface ZoneKpi {
  zone: string;
  bestellungen: number;
  umsatz_eur: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_pct: number;
}

interface StundeDatapoint {
  stunde: number;
  bestellungen: number;
}

interface ApiData {
  schicht_bestellungen: number;
  schicht_umsatz_eur: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_pct: number;
  aktive_fahrer: number;
  ziel_bestellungen: number;
  ziel_umsatz_eur: number;
  storno_quote_pct: number;
  avg_bewertung: number;
  delta_bestellungen_pct: number;   // vs. letzter Schicht
  delta_umsatz_pct: number;
  zonen: ZoneKpi[];
  stunden_verlauf: StundeDatapoint[];
}

const MOCK: ApiData = {
  schicht_bestellungen: 47,
  schicht_umsatz_eur: 1340.50,
  avg_lieferzeit_min: 28.4,
  puenktlichkeit_pct: 87,
  aktive_fahrer: 4,
  ziel_bestellungen: 60,
  ziel_umsatz_eur: 1800,
  storno_quote_pct: 2.1,
  avg_bewertung: 4.6,
  delta_bestellungen_pct: 12,
  delta_umsatz_pct: 8.5,
  zonen: [
    { zone: 'Innenstadt', bestellungen: 22, umsatz_eur: 640, avg_lieferzeit_min: 24, puenktlichkeit_pct: 92 },
    { zone: 'Nordstadt',  bestellungen: 15, umsatz_eur: 420, avg_lieferzeit_min: 31, puenktlichkeit_pct: 84 },
    { zone: 'Südwest',    bestellungen: 10, umsatz_eur: 280, avg_lieferzeit_min: 34, puenktlichkeit_pct: 80 },
  ],
  stunden_verlauf: [
    { stunde: 17, bestellungen: 4 },
    { stunde: 18, bestellungen: 9 },
    { stunde: 19, bestellungen: 14 },
    { stunde: 20, bestellungen: 12 },
    { stunde: 21, bestellungen: 8 },
  ],
};

function Delta({ pct }: { pct: number }) {
  const pos = pct >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-medium ${pos ? 'text-emerald-600' : 'text-red-500'}`}>
      {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {pos ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

function zielPct(ist: number, ziel: number): number {
  return Math.min(100, Math.round((ist / ziel) * 100));
}

export function LieferdienstPhase2751StatistikenLiveIntelligenceDashboard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/schicht-statistiken?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  const bestellZielPct = zielPct(data.schicht_bestellungen, data.ziel_bestellungen);
  const umsatzZielPct  = zielPct(data.schicht_umsatz_eur,   data.ziel_umsatz_eur);
  const maxBestellungen = Math.max(...data.stunden_verlauf.map(h => h.bestellungen), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-gray-900">Schicht-Statistiken</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        <span className="text-[10px] text-gray-400">{data.aktive_fahrer} Fahrer aktiv</span>
      </div>

      {/* Top-KPI-Grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Bestellungen */}
        <div className="bg-indigo-50 rounded-lg p-2.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-indigo-600 font-medium">Bestellungen</span>
            <Delta pct={data.delta_bestellungen_pct} />
          </div>
          <div className="text-xl font-extrabold text-indigo-900">{data.schicht_bestellungen}</div>
          <div className="space-y-0.5">
            <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${bestellZielPct}%` }} />
            </div>
            <div className="flex items-center gap-0.5 text-[10px] text-indigo-500">
              <Target className="w-2.5 h-2.5" /> Ziel: {data.ziel_bestellungen} ({bestellZielPct}%)
            </div>
          </div>
        </div>

        {/* Umsatz */}
        <div className="bg-emerald-50 rounded-lg p-2.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-emerald-600 font-medium">Umsatz</span>
            <Delta pct={data.delta_umsatz_pct} />
          </div>
          <div className="text-xl font-extrabold text-emerald-900">
            €{data.schicht_umsatz_eur.toFixed(0)}
          </div>
          <div className="space-y-0.5">
            <div className="h-1.5 bg-emerald-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${umsatzZielPct}%` }} />
            </div>
            <div className="flex items-center gap-0.5 text-[10px] text-emerald-500">
              <Target className="w-2.5 h-2.5" /> Ziel: €{data.ziel_umsatz_eur.toFixed(0)} ({umsatzZielPct}%)
            </div>
          </div>
        </div>
      </div>

      {/* Qualitäts-KPIs */}
      <div className="grid grid-cols-4 gap-1.5">
        <div className="flex flex-col items-center p-1.5 bg-gray-50 rounded-lg">
          <Clock className="w-3 h-3 text-gray-400 mb-0.5" />
          <span className="text-[10px] text-gray-400">Lieferz.</span>
          <span className={`text-xs font-bold ${data.avg_lieferzeit_min <= 30 ? 'text-emerald-700' : 'text-yellow-600'}`}>
            {data.avg_lieferzeit_min.toFixed(0)}m
          </span>
        </div>
        <div className="flex flex-col items-center p-1.5 bg-gray-50 rounded-lg">
          <Bike className="w-3 h-3 text-gray-400 mb-0.5" />
          <span className="text-[10px] text-gray-400">Pünktl.</span>
          <span className={`text-xs font-bold ${data.puenktlichkeit_pct >= 85 ? 'text-emerald-700' : 'text-yellow-600'}`}>
            {data.puenktlichkeit_pct}%
          </span>
        </div>
        <div className="flex flex-col items-center p-1.5 bg-gray-50 rounded-lg">
          <Star className="w-3 h-3 text-yellow-400 mb-0.5" />
          <span className="text-[10px] text-gray-400">Bewert.</span>
          <span className={`text-xs font-bold ${data.avg_bewertung >= 4.5 ? 'text-emerald-700' : 'text-yellow-600'}`}>
            {data.avg_bewertung.toFixed(1)}★
          </span>
        </div>
        <div className="flex flex-col items-center p-1.5 bg-gray-50 rounded-lg">
          <AlertTriangle className="w-3 h-3 text-gray-400 mb-0.5" />
          <span className="text-[10px] text-gray-400">Storno</span>
          <span className={`text-xs font-bold ${data.storno_quote_pct <= 3 ? 'text-emerald-700' : 'text-red-600'}`}>
            {data.storno_quote_pct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Stundenverlauf Mini-Chart */}
      <div>
        <span className="text-[10px] text-gray-400 mb-1.5 block">Bestellungen / Stunde</span>
        <div className="flex items-end gap-1 h-10">
          {data.stunden_verlauf.map(h => {
            const barH = Math.round((h.bestellungen / maxBestellungen) * 100);
            return (
              <div key={h.stunde} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full rounded-t-sm bg-indigo-400" style={{ height: `${barH}%` }} />
                <span className="text-[9px] text-gray-400">{h.stunde}h</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Zonen-Tabelle */}
      <div>
        <span className="text-[10px] text-gray-400 mb-1 block">Zonen-Übersicht</span>
        <div className="space-y-1">
          {data.zonen.map(z => (
            <div key={z.zone} className="flex items-center gap-2 text-xs">
              <span className="w-20 text-gray-600 font-medium truncate">{z.zone}</span>
              <span className="w-6 text-center text-gray-500">{z.bestellungen}</span>
              <span className="w-14 text-right text-emerald-700 font-medium">€{z.umsatz_eur}</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${z.puenktlichkeit_pct >= 85 ? 'bg-emerald-400' : z.puenktlichkeit_pct >= 75 ? 'bg-yellow-400' : 'bg-red-400'}`}
                  style={{ width: `${z.puenktlichkeit_pct}%` }}
                />
              </div>
              <span className={`w-8 text-right text-[10px] ${z.puenktlichkeit_pct >= 85 ? 'text-emerald-600' : 'text-yellow-600'}`}>
                {z.puenktlichkeit_pct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-1.5">
        <span>Schicht Live · 60-Sek-Polling</span>
        <span className="flex items-center gap-1"><Euro className="w-3 h-3" /> Ø €{(data.schicht_umsatz_eur / Math.max(data.schicht_bestellungen, 1)).toFixed(2)}/Bestellung</span>
      </div>
    </div>
  );
}
