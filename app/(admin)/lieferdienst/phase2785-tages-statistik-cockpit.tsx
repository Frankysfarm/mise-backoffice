'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus, Euro, Package, Star, Clock } from 'lucide-react';

interface KpiKarte { label: string; wert: string | number; einheit: string; delta_pct: number; ampel: 'gruen' | 'gelb' | 'rot'; icon: React.ReactNode; }
interface StundeRow { stunde: string; bestellungen: number; umsatz: number; avg_lieferzeit: number; }
interface ApiData { bestellungen_heute: number; umsatz_heute: number; avg_lieferzeit_min: number; avg_bewertung: number; bestellungen_delta: number; umsatz_delta: number; lieferzeit_delta: number; bewertung_delta: number; stunden: StundeRow[]; }

const MOCK: ApiData = {
  bestellungen_heute: 142,
  umsatz_heute: 4318.50,
  avg_lieferzeit_min: 28.4,
  avg_bewertung: 4.6,
  bestellungen_delta: 12,
  umsatz_delta: 8,
  lieferzeit_delta: -6,
  bewertung_delta: 3,
  stunden: [
    { stunde: '11', bestellungen: 8, umsatz: 240, avg_lieferzeit: 24 },
    { stunde: '12', bestellungen: 24, umsatz: 720, avg_lieferzeit: 31 },
    { stunde: '13', bestellungen: 31, umsatz: 940, avg_lieferzeit: 34 },
    { stunde: '14', bestellungen: 18, umsatz: 540, avg_lieferzeit: 27 },
    { stunde: '17', bestellungen: 12, umsatz: 360, avg_lieferzeit: 25 },
    { stunde: '18', bestellungen: 28, umsatz: 840, avg_lieferzeit: 29 },
    { stunde: '19', bestellungen: 21, umsatz: 638.5, avg_lieferzeit: 26 },
  ],
};

interface Props { locationId: string | null; }

export function LieferdienstPhase2785TagesStatistikCockpit({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/tages-statistik?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  const kpis: KpiKarte[] = [
    { label: 'Bestellungen', wert: data.bestellungen_heute, einheit: '', delta_pct: data.bestellungen_delta, ampel: data.bestellungen_delta >= 0 ? 'gruen' : 'rot', icon: <Package className="w-3.5 h-3.5" /> },
    { label: 'Umsatz', wert: `€${(data.umsatz_heute / 1000).toFixed(1)}k`, einheit: '', delta_pct: data.umsatz_delta, ampel: data.umsatz_delta >= 0 ? 'gruen' : 'rot', icon: <Euro className="w-3.5 h-3.5" /> },
    { label: 'Lieferzeit', wert: data.avg_lieferzeit_min.toFixed(0), einheit: 'min', delta_pct: data.lieferzeit_delta, ampel: data.lieferzeit_delta <= 0 ? 'gruen' : data.lieferzeit_delta <= 10 ? 'gelb' : 'rot', icon: <Clock className="w-3.5 h-3.5" /> },
    { label: 'Bewertung', wert: data.avg_bewertung.toFixed(1), einheit: '★', delta_pct: data.bewertung_delta, ampel: data.avg_bewertung >= 4.5 ? 'gruen' : data.avg_bewertung >= 4.0 ? 'gelb' : 'rot', icon: <Star className="w-3.5 h-3.5" /> },
  ];

  const maxBestellungen = Math.max(...data.stunden.map(s => s.bestellungen), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">Tages-Statistik Cockpit</span>
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {kpis.map((kpi) => {
          const kpiColor = kpi.ampel === 'gruen' ? 'text-emerald-600' : kpi.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
          const kpiBg = kpi.ampel === 'gruen' ? 'bg-emerald-50' : kpi.ampel === 'gelb' ? 'bg-yellow-50' : 'bg-red-50';
          const DeltaIcon = (kpi.ampel === 'gruen') ? <TrendingUp className="w-2.5 h-2.5" /> : kpi.ampel === 'rot' ? <TrendingDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />;
          return (
            <div key={kpi.label} className={`${kpiBg} rounded-xl p-3 space-y-1`}>
              <div className={`flex items-center gap-1 ${kpiColor}`}>{kpi.icon}<span className="text-[10px] text-gray-500">{kpi.label}</span></div>
              <div className={`text-2xl font-bold ${kpiColor}`}>{kpi.wert}<span className="text-sm font-normal ml-0.5">{kpi.einheit}</span></div>
              <div className={`flex items-center gap-0.5 text-[10px] ${kpiColor}`}>
                {DeltaIcon}
                <span>{kpi.delta_pct > 0 ? '+' : ''}{kpi.delta_pct}% vs. gestern</span>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <div className="text-[10px] text-gray-500 mb-2">Bestellungen nach Stunde</div>
        <div className="flex items-end gap-1 h-16">
          {data.stunden.map((std) => (
            <div key={std.stunde} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full bg-blue-200 rounded-t-sm hover:bg-blue-400 transition-colors cursor-default"
                style={{ height: `${(std.bestellungen / maxBestellungen) * 52}px`, minHeight: 2 }}
                title={`${std.stunde}h: ${std.bestellungen} Best. · €${std.umsatz.toFixed(0)} · ${std.avg_lieferzeit}min`} />
              <span className="text-[8px] text-gray-400">{std.stunde}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[9px] text-gray-400 text-center border-t border-gray-100 pt-1">
        Tagesstatistik · 1-Min-Polling · vs. Vortag
      </div>
    </div>
  );
}
