'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, MapPin, Clock, AlertTriangle, TrendingUp, ChevronDown, ChevronUp, CheckCircle2, Truck, Zap } from 'lucide-react';

interface Stopp {
  id: string;
  adresse: string;
  status: 'ausstehend' | 'unterwegs' | 'geliefert';
  eta_min: number | null;
}

interface FahrerScore {
  id: string;
  name: string;
  score: number;
  puenktlichkeit: number;
  lieferzeit: number;
  bewertung: number;
  aktive_tour: boolean;
  stopps: Stopp[];
  stopps_gesamt: number;
  stopps_fertig: number;
}

interface ApiData {
  fahrer: FahrerScore[];
  flotten_avg: number;
  alerts: number;
}

const MOCK: ApiData = {
  flotten_avg: 79,
  alerts: 1,
  fahrer: [
    {
      id: 'f1', name: 'Alex M.', score: 94, puenktlichkeit: 96, lieferzeit: 92, bewertung: 94,
      aktive_tour: true, stopps_gesamt: 5, stopps_fertig: 3,
      stopps: [
        { id: 's1', adresse: 'Hauptstr. 12', status: 'geliefert', eta_min: null },
        { id: 's2', adresse: 'Gartenweg 7',  status: 'geliefert', eta_min: null },
        { id: 's3', adresse: 'Marktpl. 3',   status: 'geliefert', eta_min: null },
        { id: 's4', adresse: 'Lindenstr. 45',status: 'unterwegs', eta_min: 4 },
        { id: 's5', adresse: 'Am Bach 2',    status: 'ausstehend',eta_min: 18 },
      ],
    },
    {
      id: 'f2', name: 'Ben K.', score: 78, puenktlichkeit: 75, lieferzeit: 80, bewertung: 79,
      aktive_tour: true, stopps_gesamt: 4, stopps_fertig: 1,
      stopps: [
        { id: 's1', adresse: 'Rathauspl. 1', status: 'geliefert', eta_min: null },
        { id: 's2', adresse: 'Bergstr. 9',   status: 'unterwegs', eta_min: 7 },
        { id: 's3', adresse: 'Tulpenweg 33', status: 'ausstehend',eta_min: 22 },
        { id: 's4', adresse: 'Seestr. 14',   status: 'ausstehend',eta_min: 35 },
      ],
    },
    {
      id: 'f3', name: 'Clara S.', score: 65, puenktlichkeit: 60, lieferzeit: 68, bewertung: 67,
      aktive_tour: false, stopps_gesamt: 3, stopps_fertig: 3,
      stopps: [],
    },
  ],
};

function scoreCol(s: number) {
  if (s >= 85) return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
  if (s >= 70) return { bar: 'bg-yellow-400',  text: 'text-yellow-700',  bg: 'bg-yellow-50' };
  return             { bar: 'bg-red-500',      text: 'text-red-700',     bg: 'bg-red-50' };
}

function stoppDot(s: Stopp['status']) {
  if (s === 'geliefert') return 'bg-emerald-500';
  if (s === 'unterwegs') return 'bg-indigo-500 animate-pulse';
  return 'bg-gray-300';
}

export function DispatchPhase3849TourScoreVisualisierungLiveKomplett({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/dispatch/tour-scores?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch { /* Mock-Fallback */ }
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const t = setInterval(load, 20_000); return () => clearInterval(t); }, [load]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-bold text-gray-900">Tour-Score &amp; Visualisierung</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-gray-500">Flotten-Ø</span>
          <span className={`font-bold ${data.flotten_avg >= 80 ? 'text-emerald-700' : data.flotten_avg >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
            {data.flotten_avg}
          </span>
          {data.alerts > 0 && (
            <span className="flex items-center gap-0.5 text-red-600">
              <AlertTriangle className="w-3 h-3" />{data.alerts}
            </span>
          )}
        </div>
      </div>

      {/* Fahrer-Liste */}
      <div className="space-y-2">
        {data.fahrer.map(f => {
          const col = scoreCol(f.score);
          const isOpen = expanded === f.id;
          const unterwegs = f.stopps.find(s => s.status === 'unterwegs');
          return (
            <div key={f.id} className={`rounded-lg border ${f.score < 70 ? 'border-red-200' : 'border-gray-200'} overflow-hidden`}>
              {/* Score-Row */}
              <button
                onClick={() => setExpanded(isOpen ? null : f.id)}
                className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {f.aktive_tour
                    ? <Truck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  <span className="text-xs font-semibold text-gray-800 truncate">{f.name}</span>
                  {unterwegs && (
                    <span className="text-[10px] text-indigo-600 font-medium shrink-0">→ ETA {unterwegs.eta_min}m</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${col.bg} ${col.text}`}>{f.score}</span>
                  <span className="text-[10px] text-gray-400">{f.stopps_fertig}/{f.stopps_gesamt}</span>
                  {isOpen ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                </div>
              </button>

              {/* Score-Balken */}
              <div className="px-2 pb-1.5">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${col.bar}`}
                    style={{ width: `${f.score}%` }}
                  />
                </div>
              </div>

              {/* Expandiert: Stopp-Timeline + Sub-KPIs */}
              {isOpen && (
                <div className="px-2 pb-2 space-y-2 border-t border-gray-100 pt-2">
                  {/* Sub-KPIs */}
                  <div className="grid grid-cols-3 gap-1 text-[10px]">
                    {[
                      { label: 'Pünktlichkeit', val: f.puenktlichkeit },
                      { label: 'Lieferzeit',    val: f.lieferzeit },
                      { label: 'Bewertung',     val: f.bewertung },
                    ].map(k => (
                      <div key={k.label} className="flex flex-col items-center p-1 bg-gray-50 rounded">
                        <span className="text-gray-400">{k.label}</span>
                        <span className={`font-bold text-xs ${scoreCol(k.val).text}`}>{k.val}</span>
                      </div>
                    ))}
                  </div>
                  {/* Stopp-Dot-Timeline */}
                  {f.stopps.length > 0 && (
                    <div className="space-y-1">
                      {f.stopps.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-2 text-[10px]">
                          <span className="text-gray-300 w-3 text-right shrink-0">{i + 1}</span>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${stoppDot(s.status)}`} />
                          <span className={`flex-1 truncate ${s.status === 'unterwegs' ? 'text-indigo-700 font-medium' : s.status === 'geliefert' ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                            {s.adresse}
                          </span>
                          {s.eta_min && <span className="text-gray-400 shrink-0 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{s.eta_min}m</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Alert Score < 70 */}
      {data.fahrer.some(f => f.score < 70) && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{data.fahrer.filter(f => f.score < 70).map(f => f.name).join(', ')} — Score unter 70, Coaching empfohlen</span>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Stopp-Timeline farbkodiert</span>
        <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Live · 20-Sek</span>
      </div>
    </div>
  );
}
