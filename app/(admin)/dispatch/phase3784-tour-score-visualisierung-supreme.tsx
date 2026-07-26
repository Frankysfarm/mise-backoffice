'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, TrendingUp, TrendingDown, AlertTriangle, Bike, Star } from 'lucide-react';

interface StoppDot {
  index: number;
  status: 'geliefert' | 'aktiv' | 'ausstehend';
  eta_min: number | null;
}

interface FahrerScore {
  fahrer_id: string;
  name: string;
  score: number; // 0-100
  puenktlichkeit: number;
  lieferzeit_min: number;
  bewertung: number;
  stopps_gesamt: number;
  stopps_fertig: number;
  stopps: StoppDot[];
  expanded: boolean;
}

interface FleetKpi {
  avg_score: number;
  top_score: number;
  alert_count: number;
  aktive_fahrer: number;
}

const MOCK_FLEET: FleetKpi = { avg_score: 74, top_score: 92, alert_count: 2, aktive_fahrer: 5 };

const MOCK_FAHRER: FahrerScore[] = [
  { fahrer_id: 'f1', name: 'Max K.', score: 92, puenktlichkeit: 95, lieferzeit_min: 22, bewertung: 4.9, stopps_gesamt: 4, stopps_fertig: 3, expanded: false,
    stopps: [{ index: 0, status: 'geliefert', eta_min: null }, { index: 1, status: 'geliefert', eta_min: null }, { index: 2, status: 'geliefert', eta_min: null }, { index: 3, status: 'aktiv', eta_min: 6 }] },
  { fahrer_id: 'f2', name: 'Sara M.', score: 78, puenktlichkeit: 82, lieferzeit_min: 27, bewertung: 4.6, stopps_gesamt: 3, stopps_fertig: 1, expanded: false,
    stopps: [{ index: 0, status: 'geliefert', eta_min: null }, { index: 1, status: 'aktiv', eta_min: 9 }, { index: 2, status: 'ausstehend', eta_min: 18 }] },
  { fahrer_id: 'f3', name: 'Jonas B.', score: 65, puenktlichkeit: 70, lieferzeit_min: 34, bewertung: 4.3, stopps_gesamt: 5, stopps_fertig: 2, expanded: false,
    stopps: [{ index: 0, status: 'geliefert', eta_min: null }, { index: 1, status: 'geliefert', eta_min: null }, { index: 2, status: 'aktiv', eta_min: 7 }, { index: 3, status: 'ausstehend', eta_min: 16 }, { index: 4, status: 'ausstehend', eta_min: 25 }] },
  { fahrer_id: 'f4', name: 'Lena W.', score: 58, puenktlichkeit: 60, lieferzeit_min: 38, bewertung: 4.1, stopps_gesamt: 3, stopps_fertig: 0, expanded: false,
    stopps: [{ index: 0, status: 'aktiv', eta_min: 12 }, { index: 1, status: 'ausstehend', eta_min: 22 }, { index: 2, status: 'ausstehend', eta_min: 31 }] },
  { fahrer_id: 'f5', name: 'Tim R.', score: 85, puenktlichkeit: 88, lieferzeit_min: 24, bewertung: 4.7, stopps_gesamt: 4, stopps_fertig: 2, expanded: false,
    stopps: [{ index: 0, status: 'geliefert', eta_min: null }, { index: 1, status: 'geliefert', eta_min: null }, { index: 2, status: 'aktiv', eta_min: 5 }, { index: 3, status: 'ausstehend', eta_min: 14 }] },
];

function scoreColor(s: number) {
  if (s >= 80) return { bar: 'bg-emerald-500', txt: 'text-emerald-700', bg: 'bg-emerald-100' };
  if (s >= 65) return { bar: 'bg-yellow-400',  txt: 'text-yellow-700',  bg: 'bg-yellow-100' };
  return              { bar: 'bg-red-500',      txt: 'text-red-700',     bg: 'bg-red-100' };
}

function stoppColor(s: StoppDot['status']) {
  if (s === 'geliefert') return 'bg-emerald-500';
  if (s === 'aktiv')     return 'bg-blue-500 animate-pulse';
  return 'bg-slate-300';
}

export function DispatchPhase3784TourScoreVisualisierungSupreme({ locationId }: { locationId: string | null }) {
  const [fleet, setFleet] = useState<FleetKpi>(MOCK_FLEET);
  const [fahrer, setFahrer] = useState<FahrerScore[]>(MOCK_FAHRER);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/tour-score-supreme?location_id=${locationId}`);
      if (res.ok) {
        const d = await res.json();
        if (d.fleet) setFleet(d.fleet);
        if (d.fahrer) setFahrer(d.fahrer.map((f: FahrerScore) => ({ ...f, expanded: false })));
      }
    } catch { /* Mock-Fallback */ }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id); }, [load]);

  const sorted = [...fahrer].sort((a, b) => b.score - a.score);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500" />
        <span className="font-semibold text-sm text-slate-800">Tour-Score & Visualisierung</span>
        {fleet.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
            <AlertTriangle className="h-3 w-3" /> {fleet.alert_count} Score &lt; 70
          </span>
        )}
      </div>

      {/* Flotten-KPI */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Flotten-Ø', value: `${fleet.avg_score}`, unit: '/100' },
          { label: 'Top-Score', value: `${fleet.top_score}`, unit: '/100' },
          { label: 'Aktiv', value: `${fleet.aktive_fahrer}`, unit: ' Fahr.' },
        ].map(k => (
          <div key={k.label} className="rounded-lg bg-slate-50 p-2 text-center">
            <div className="text-sm font-bold text-slate-800">{k.value}<span className="text-[10px] font-normal text-slate-500">{k.unit}</span></div>
            <div className="text-[10px] text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Fahrer-Liste */}
      <div className="space-y-2">
        {sorted.map((f, i) => {
          const c = scoreColor(f.score);
          const isExpanded = expanded.has(f.fahrer_id);
          return (
            <div key={f.fahrer_id} className={`rounded-lg border p-2 cursor-pointer transition-colors ${f.score < 70 ? 'border-red-200 bg-red-50/40' : 'border-slate-100 bg-slate-50/50'}`}
              onClick={() => toggleExpand(f.fahrer_id)}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold text-slate-400 w-4">#{i + 1}</span>
                <Bike className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-700 flex-1">{f.name}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${c.bg} ${c.txt}`}>{f.score}</span>
              </div>
              {/* Score-Balken */}
              <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden mb-1.5">
                <div className={`h-full rounded-full transition-all ${c.bar}`} style={{ width: `${f.score}%` }} />
              </div>
              {/* Stopp-Dots */}
              <div className="flex items-center gap-1">
                {f.stopps.map(s => (
                  <div key={s.index} className="flex flex-col items-center gap-0.5">
                    <div className={`h-2.5 w-2.5 rounded-full ${stoppColor(s.status)}`} title={s.status} />
                    {s.eta_min && <span className="text-[8px] text-slate-400">{s.eta_min}m</span>}
                  </div>
                ))}
                <span className="ml-auto text-[10px] text-slate-400">{f.stopps_fertig}/{f.stopps_gesamt}</span>
              </div>
              {/* Expandiert */}
              {isExpanded && (
                <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-3 gap-1.5 text-[10px]">
                  <div className="rounded bg-white p-1 text-center">
                    <div className="font-bold text-slate-700">{f.puenktlichkeit}%</div>
                    <div className="text-slate-400">Pünktl.</div>
                  </div>
                  <div className="rounded bg-white p-1 text-center">
                    <div className="font-bold text-slate-700">{f.lieferzeit_min}min</div>
                    <div className="text-slate-400">Ø Liefert.</div>
                  </div>
                  <div className="rounded bg-white p-1 text-center flex flex-col items-center">
                    <div className="flex items-center gap-0.5 font-bold text-slate-700">
                      <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />{f.bewertung}
                    </div>
                    <div className="text-slate-400">Bewertung</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-slate-400 flex items-center gap-1">
        <TrendingUp className="h-3 w-3" />Live · alle 20 Sek. · Antippen zum Aufklappen
      </div>
    </div>
  );
}
