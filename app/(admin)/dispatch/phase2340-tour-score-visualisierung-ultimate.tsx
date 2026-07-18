'use client';
import { useEffect, useState } from 'react';
import { Target, MapPin, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, CheckCircle2, Circle, Truck } from 'lucide-react';

interface TourStop {
  reihenfolge: number;
  bestellnummer: string;
  kunde_name: string;
  geliefert: boolean;
  eta_min: number | null;
}

interface DriverTour {
  driver_id: string;
  driver_name: string;
  score: number;
  score_prev: number | null;
  trend: 'up' | 'down' | 'neutral';
  active_tour: boolean;
  stops_total: number;
  stops_done: number;
  eta_remaining_min: number | null;
  stops: TourStop[];
  zone: string | null;
}

interface TourScoreData {
  drivers: DriverTour[];
  team_avg_score: number;
  team_avg_prev: number | null;
  active_tours: number;
  generatedAt: string;
}

interface Props { locationId: string | null; }

function ScoreRing({ score }: { score: number }) {
  const r = 20, c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const fill = c * (pct / 100);
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#ca8a04' : '#dc2626';
  return (
    <svg width="52" height="52" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#f3f4f6" strokeWidth="4" />
      <circle
        cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${fill} ${c}`} strokeLinecap="round"
        transform="rotate(-90 26 26)"
      />
      <text x="26" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>{score}</text>
    </svg>
  );
}

function TrendIcon({ t }: { t: 'up' | 'down' | 'neutral' }) {
  if (t === 'up') return <TrendingUp className="w-3.5 h-3.5 text-green-500" />;
  if (t === 'down') return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
  return <Minus className="w-3.5 h-3.5 text-gray-400" />;
}

function StopProgress({ stops, done, total }: { stops: TourStop[]; done: number; total: number }) {
  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {stops.slice(0, 8).map((s, i) => (
        <div key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border
          ${s.geliefert ? 'bg-green-100 border-green-300 text-green-700' : 'bg-gray-100 border-gray-300 text-gray-500'}`}>
          {s.reihenfolge}
        </div>
      ))}
      {total > 8 && <span className="text-[10px] text-gray-400">+{total - 8}</span>}
      <span className="text-[10px] text-gray-500 ml-1">{done}/{total}</span>
    </div>
  );
}

export function DispatchPhase2340TourScoreVisualisierungUltimate({ locationId }: Props) {
  const [data, setData] = useState<TourScoreData | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-touren-qualitaet?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setData(d))
        .catch(() => null);
    load();
    const t = setInterval(load, 25_000);
    return () => clearInterval(t);
  }, [locationId]);

  const drivers = data?.drivers ?? [];
  const activeTours = drivers.filter(d => d.active_tour);

  function ampel(score: number) {
    if (score >= 80) return 'text-green-700 bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    return 'text-red-700 bg-red-50 border-red-200';
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-white shadow-sm mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-sm text-blue-800">Tour-Score & Visualisierung (Phase 2340)</span>
          {activeTours.length > 0 && (
            <span className="ml-1 rounded-full bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5">
              {activeTours.length} aktiv
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500 hidden sm:inline">
            Team-Ø: {data?.team_avg_score ?? '—'} · {activeTours.length} Touren
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="p-4">
          {/* Team KPI */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <div className="text-xl font-black text-blue-700 tabular-nums">{data?.team_avg_score ?? '—'}</div>
              <div className="text-[10px] text-blue-600 font-semibold mt-0.5">Team-Ø Score</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <div className="text-xl font-black text-green-700 tabular-nums">{data?.active_tours ?? activeTours.length}</div>
              <div className="text-[10px] text-green-600 font-semibold mt-0.5">Aktive Touren</div>
            </div>
            <div className="rounded-lg bg-purple-50 p-3 text-center">
              <div className="text-xl font-black text-purple-700 tabular-nums">{drivers.length}</div>
              <div className="text-[10px] text-purple-600 font-semibold mt-0.5">Fahrer gesamt</div>
            </div>
          </div>

          {/* Driver list */}
          {drivers.length === 0 ? (
            <div className="text-center py-6 text-sm text-gray-400">Keine Fahrerdaten</div>
          ) : (
            <div className="space-y-2">
              {drivers.map(d => (
                <div key={d.driver_id} className={`rounded-lg border ${ampel(d.score)} p-3`}>
                  <button
                    className="w-full text-left"
                    onClick={() => setExpanded(e => e === d.driver_id ? null : d.driver_id)}
                  >
                    <div className="flex items-center gap-3">
                      <ScoreRing score={d.score} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-gray-900 truncate">{d.driver_name}</span>
                          <TrendIcon t={d.trend} />
                          {d.active_tour && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">
                              unterwegs
                            </span>
                          )}
                        </div>
                        {d.active_tour && (
                          <StopProgress stops={d.stops ?? []} done={d.stops_done} total={d.stops_total} />
                        )}
                        {d.zone && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            <span className="text-[10px] text-gray-500">{d.zone}</span>
                            {d.eta_remaining_min != null && (
                              <span className="text-[10px] text-gray-400 ml-1">· ETA: {d.eta_remaining_min} min</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0">
                        {expanded === d.driver_id
                          ? <ChevronUp className="w-4 h-4 text-gray-400" />
                          : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </div>
                  </button>

                  {expanded === d.driver_id && d.stops && d.stops.length > 0 && (
                    <div className="mt-3 border-t border-gray-100 pt-3 space-y-1.5">
                      {d.stops.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {s.geliefert
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                            : <Circle className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
                          <span className="font-mono text-gray-500">{s.reihenfolge}.</span>
                          <span className="font-medium text-gray-700 truncate">{s.kunde_name}</span>
                          <span className="text-gray-400 ml-auto shrink-0">#{s.bestellnummer}</span>
                          {s.eta_min != null && (
                            <span className="text-gray-400 shrink-0">{s.eta_min} min</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!locationId && (
            <div className="text-xs text-gray-400 text-center py-4">Bitte Filiale auswählen</div>
          )}
        </div>
      )}
    </div>
  );
}
