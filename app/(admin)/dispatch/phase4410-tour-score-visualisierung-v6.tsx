'use client';

import { useState, useEffect, useCallback } from 'react';
import { Route, Clock, Zap, MapPin, CheckCircle2, AlertTriangle, TrendingUp, Navigation, Target, Users, RefreshCw, Award } from 'lucide-react';

interface TourStop {
  id: string;
  reihenfolge: number;
  adresse: string;
  bestellnummer: string;
  status: 'ausstehend' | 'aktiv' | 'abgeschlossen';
  eta_min: number | null;
  versp_min: number;
  kunde_name: string | null;
}

interface TourEntry {
  id: string;
  fahrer_name: string;
  score: number;
  score_delta: number;
  rang: number;
  pünktlichkeit_pct: number;
  lieferzeit_avg_min: number;
  aktive_stopps: number;
  abgeschlossene_stopps: number;
  stops: TourStop[];
  laufend: boolean;
  eta_rest_min: number | null;
  km_bisher: number;
  zone: string;
  bewertung_avg: number;
  pakete_gesamt: number;
}

interface ZoneKpi {
  zone: string;
  aktive_touren: number;
  sla_pct: number;
  avg_eta_min: number;
}

interface FleetKpis {
  fleet_score: number;
  aktive_touren: number;
  on_time_pct: number;
  avg_lieferzeit_min: number;
  eta_genauigkeit_pct: number;
  pakete_gesamt: number;
  alert_count: number;
  touren: TourEntry[];
  zonen: ZoneKpi[];
}

const MOCK: FleetKpis = {
  fleet_score: 86,
  aktive_touren: 3,
  on_time_pct: 91,
  avg_lieferzeit_min: 21,
  eta_genauigkeit_pct: 93,
  pakete_gesamt: 14,
  alert_count: 1,
  zonen: [
    { zone: 'A – Mitte',  aktive_touren: 2, sla_pct: 94, avg_eta_min: 19 },
    { zone: 'B – Nord',   aktive_touren: 1, sla_pct: 88, avg_eta_min: 24 },
  ],
  touren: [
    {
      id: 't1', fahrer_name: 'Max M.', score: 93, score_delta: 4, rang: 1,
      pünktlichkeit_pct: 96, lieferzeit_avg_min: 18, aktive_stopps: 1, abgeschlossene_stopps: 2,
      laufend: true, eta_rest_min: 12, km_bisher: 8.4, zone: 'A – Mitte',
      bewertung_avg: 4.9, pakete_gesamt: 5,
      stops: [
        { id: 's1', reihenfolge: 1, adresse: 'Kaiserstr. 7', bestellnummer: '#1040', status: 'abgeschlossen', eta_min: null, versp_min: 0, kunde_name: 'K. Schmidt' },
        { id: 's2', reihenfolge: 2, adresse: 'Elisenstr. 5', bestellnummer: '#1041', status: 'abgeschlossen', eta_min: null, versp_min: 2, kunde_name: 'A. Müller' },
        { id: 's3', reihenfolge: 3, adresse: 'Pontstr. 12',  bestellnummer: '#1042', status: 'aktiv',         eta_min: 12,  versp_min: 0, kunde_name: 'B. Weber' },
      ],
    },
    {
      id: 't2', fahrer_name: 'Lisa K.', score: 81, score_delta: -2, rang: 2,
      pünktlichkeit_pct: 85, lieferzeit_avg_min: 24, aktive_stopps: 2, abgeschlossene_stopps: 1,
      laufend: true, eta_rest_min: 28, km_bisher: 5.1, zone: 'B – Nord',
      bewertung_avg: 4.7, pakete_gesamt: 5,
      stops: [
        { id: 's4', reihenfolge: 1, adresse: 'Alexanderstr. 3', bestellnummer: '#1043', status: 'abgeschlossen', eta_min: null, versp_min: 5, kunde_name: 'T. Bauer' },
        { id: 's5', reihenfolge: 2, adresse: 'Blücherstr. 18',  bestellnummer: '#1044', status: 'aktiv',         eta_min: 14,  versp_min: 4, kunde_name: 'S. Fischer' },
        { id: 's6', reihenfolge: 3, adresse: 'Wilhelmstr. 9',   bestellnummer: '#1045', status: 'ausstehend',    eta_min: 28,  versp_min: 0, kunde_name: 'M. Wagner' },
      ],
    },
    {
      id: 't3', fahrer_name: 'Tom S.', score: 78, score_delta: 1, rang: 3,
      pünktlichkeit_pct: 82, lieferzeit_avg_min: 26, aktive_stopps: 1, abgeschlossene_stopps: 0,
      laufend: true, eta_rest_min: 35, km_bisher: 2.2, zone: 'A – Mitte',
      bewertung_avg: 4.5, pakete_gesamt: 4,
      stops: [
        { id: 's7', reihenfolge: 1, adresse: 'Kármán-Str. 5', bestellnummer: '#1046', status: 'aktiv',    eta_min: 20,  versp_min: 6, kunde_name: 'R. Braun' },
        { id: 's8', reihenfolge: 2, adresse: 'Jülicher Str. 1',bestellnummer: '#1047', status: 'ausstehend', eta_min: 35, versp_min: 0, kunde_name: 'J. Klein' },
      ],
    },
  ],
};

function scoreColor(score: number) {
  if (score >= 90) return 'text-green-600 dark:text-green-400';
  if (score >= 80) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBg(score: number) {
  if (score >= 90) return 'bg-green-500';
  if (score >= 80) return 'bg-yellow-500';
  return 'bg-red-500';
}

function slaBg(pct: number) {
  if (pct >= 90) return 'bg-green-500';
  if (pct >= 80) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function DispatchPhase4410TourScoreVisualisierungV6() {
  const [data, setData] = useState<FleetKpis>(MOCK);
  const [expanded, setExpanded] = useState<string | null>('t1');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/overview', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json?.fleet_score !== undefined) { setData(json); setLastRefresh(new Date()); }
    } catch { /* mock */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const i = setInterval(fetchData, 20_000);
    return () => clearInterval(i);
  }, [fetchData]);

  const fleetScoreColor = scoreColor(data.fleet_score);

  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 bg-amber-500 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-white" />
          <span className="text-sm font-semibold text-white">Tour-Score V6</span>
          <span className="text-xs text-amber-100">Flotten-Visualisierung</span>
        </div>
        <button onClick={fetchData} className="p-1 rounded bg-amber-400 text-white" title="Aktualisieren">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Delay-Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950 border-b border-red-200 dark:border-red-800">
          <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
          <span className="text-xs font-semibold text-red-700 dark:text-red-300">
            {data.alert_count} Tour{data.alert_count > 1 ? 'en' : ''} mit Verspätung — Neuplanung prüfen
          </span>
        </div>
      )}

      {/* Flotten-KPI-Grid */}
      <div className="grid grid-cols-3 gap-px bg-stone-100 dark:bg-stone-800">
        {[
          { label: 'Fleet-Score',    val: `${data.fleet_score}`,           color: fleetScoreColor,            sub: `${data.aktive_touren} aktive Touren` },
          { label: 'Pünktlichkeit',  val: `${data.on_time_pct}%`,          color: data.on_time_pct >= 90 ? 'text-green-600' : 'text-yellow-600', sub: 'Ziel: 90%' },
          { label: 'Pakete heute',   val: `${data.pakete_gesamt}`,          color: 'text-indigo-600',          sub: `Ø ${data.avg_lieferzeit_min}m Lieferzeit` },
        ].map(k => (
          <div key={k.label} className="px-3 py-2.5 bg-white dark:bg-stone-900 text-center">
            <div className={`text-xl font-bold ${k.color}`}>{k.val}</div>
            <div className="text-[10px] text-stone-500">{k.label}</div>
            <div className="text-[9px] text-stone-400 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Zonen-Strip */}
      <div className="px-4 py-2 border-b border-stone-100 dark:border-stone-700">
        <div className="flex items-center gap-1.5 mb-1.5">
          <MapPin className="w-3.5 h-3.5 text-stone-500" />
          <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">Zonen-SLA</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {data.zonen.map(z => (
            <div key={z.zone} className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[10px]">
                <span className="font-medium text-stone-600 dark:text-stone-300 truncate">{z.zone}</span>
                <span className="text-stone-400">{z.sla_pct}% SLA</span>
              </div>
              <div className="h-1.5 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${slaBg(z.sla_pct)} transition-all`} style={{ width: `${z.sla_pct}%` }} />
              </div>
              <div className="text-[9px] text-stone-400">{z.aktive_touren} Touren · Ø {z.avg_eta_min}m ETA</div>
            </div>
          ))}
        </div>
      </div>

      {/* Fahrer-Ranking-Liste */}
      <div className="divide-y divide-stone-100 dark:divide-stone-800">
        {data.touren.map(tour => (
          <div key={tour.id}>
            <button
              className="w-full px-4 py-3 text-left hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
              onClick={() => setExpanded(expanded === tour.id ? null : tour.id)}
            >
              <div className="flex items-center gap-3">
                {/* Rang-Badge */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${scoreBg(tour.score)}`}>
                  {tour.rang}
                </div>
                {/* Fahrer-Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-stone-800 dark:text-stone-100">{tour.fahrer_name}</span>
                    <span className="text-[10px] text-stone-400 truncate">{tour.zone}</span>
                    {tour.laufend && (
                      <span className="text-[10px] bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">Aktiv</span>
                    )}
                  </div>
                  {/* Stopp-Sequenz */}
                  <div className="flex items-center gap-1 mt-1">
                    {tour.stops.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-0.5">
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[8px] font-bold ${
                          s.status === 'abgeschlossen' ? 'bg-green-500' :
                          s.status === 'aktiv' ? 'bg-blue-500' : 'bg-stone-300 dark:bg-stone-600'
                        }`}>{i + 1}</div>
                        {s.versp_min > 3 && <span className="text-[8px] text-red-500">+{s.versp_min}m</span>}
                        {i < tour.stops.length - 1 && <span className="text-stone-300 dark:text-stone-600 text-[10px]">–</span>}
                      </div>
                    ))}
                    {tour.eta_rest_min && (
                      <span className="text-[10px] text-stone-400 ml-1">~{tour.eta_rest_min}m rest.</span>
                    )}
                  </div>
                </div>
                {/* Score */}
                <div className="text-right shrink-0">
                  <div className={`text-xl font-bold ${scoreColor(tour.score)}`}>{tour.score}</div>
                  <div className={`text-[10px] font-medium ${tour.score_delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {tour.score_delta >= 0 ? '▲' : '▼'} {Math.abs(tour.score_delta)}
                  </div>
                </div>
              </div>
            </button>

            {/* Expandierte Details */}
            {expanded === tour.id && (
              <div className="px-4 pb-3 bg-stone-50 dark:bg-stone-800 border-t border-stone-100 dark:border-stone-700">
                <div className="grid grid-cols-4 gap-2 py-2">
                  {[
                    { label: 'Pünktl.', val: `${tour.pünktlichkeit_pct}%` },
                    { label: 'Ø Zeit', val: `${tour.lieferzeit_avg_min}m` },
                    { label: 'Bewertg.', val: `${tour.bewertung_avg}★` },
                    { label: 'km', val: `${tour.km_bisher}` },
                  ].map(k => (
                    <div key={k.label} className="text-center">
                      <div className="text-sm font-bold text-stone-700 dark:text-stone-200">{k.val}</div>
                      <div className="text-[10px] text-stone-400">{k.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-1 space-y-1.5">
                  {tour.stops.map(s => (
                    <div key={s.id} className={`flex items-center gap-2 px-2 py-1.5 rounded text-[11px] ${
                      s.status === 'abgeschlossen' ? 'bg-green-50 dark:bg-green-950' :
                      s.status === 'aktiv' ? 'bg-blue-50 dark:bg-blue-950' : 'bg-white dark:bg-stone-900'
                    }`}>
                      {s.status === 'abgeschlossen' ? <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" /> :
                       s.status === 'aktiv' ? <Navigation className="w-3 h-3 text-blue-500 shrink-0" /> :
                       <Clock className="w-3 h-3 text-stone-400 shrink-0" />}
                      <span className="font-medium text-stone-600 dark:text-stone-300 truncate flex-1">{s.adresse}</span>
                      <span className="text-stone-400">{s.bestellnummer}</span>
                      {s.versp_min > 0 && <span className="text-red-500 font-semibold">+{s.versp_min}m</span>}
                      {s.eta_min && s.status !== 'abgeschlossen' && <span className="text-indigo-500">{s.eta_min}m</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-stone-50 dark:bg-stone-800 border-t border-stone-100 dark:border-stone-700 flex justify-between items-center">
        <div className="flex items-center gap-2 text-[10px] text-stone-400">
          <Users className="w-3 h-3" />
          <span>{data.aktive_touren} Fahrer · ETA-Genauigkeit {data.eta_genauigkeit_pct}%</span>
        </div>
        <span className="text-[9px] text-stone-400">↻ {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      </div>
    </div>
  );
}
