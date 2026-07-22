'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, MapPin, Star, Truck } from 'lucide-react';

interface FahrerScore {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  aktive_touren: number;
  gelieferte_stopps: number;
  gesamt_stopps: number;
  eta_min: number | null;
  puenktlichkeit_pct: number;
  storno_rate_pct: number;
}

interface ApiData {
  fahrer: FahrerScore[];
  team_avg_score: number;
  team_on_time_pct: number;
  aktive_touren_gesamt: number;
  alert_count: number;
}

const MOCK: ApiData = {
  team_avg_score: 76,
  team_on_time_pct: 82,
  aktive_touren_gesamt: 3,
  alert_count: 1,
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.', score: 91, score_delta: +3, ampel: 'gruen', aktive_touren: 1, gelieferte_stopps: 3, gesamt_stopps: 4, eta_min: 8, puenktlichkeit_pct: 95, storno_rate_pct: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.', score: 72, score_delta: -2, ampel: 'gelb', aktive_touren: 1, gelieferte_stopps: 1, gesamt_stopps: 3, eta_min: 22, puenktlichkeit_pct: 74, storno_rate_pct: 4 },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.', score: 58, score_delta: -8, ampel: 'rot', aktive_touren: 1, gelieferte_stopps: 0, gesamt_stopps: 2, eta_min: 35, puenktlichkeit_pct: 61, storno_rate_pct: 9 },
  ],
};

function scoreCls(ampel: string) {
  if (ampel === 'rot')  return { card: 'bg-red-950/30 border-red-600/50', score: 'text-red-400', dot: 'bg-red-500' };
  if (ampel === 'gelb') return { card: 'bg-amber-950/20 border-amber-500/40', score: 'text-amber-400', dot: 'bg-amber-400' };
  return                       { card: 'bg-green-950/20 border-green-600/40', score: 'text-green-400', dot: 'bg-green-500' };
}

export function DispatchPhase3165TourScoreLiveDashboard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/admin/dispatch-score?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (locationId) load();
    else setData(MOCK);
    const poll = setInterval(load, 30_000);
    return () => clearInterval(poll);
  }, [locationId]);

  const d = data ?? MOCK;

  return (
    <div className="rounded-xl border border-gray-700 shadow mb-4 overflow-hidden bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-400 shrink-0" />
          <span className="text-sm font-bold text-white">Tour-Score Live Dashboard</span>
          {d.alert_count > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
              <AlertTriangle className="h-2.5 w-2.5" />{d.alert_count} Alert
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-gray-400">Team: <span className={d.team_avg_score >= 80 ? 'text-green-400' : d.team_avg_score >= 65 ? 'text-amber-400' : 'text-red-400'} style={{fontWeight: 700}}>{d.team_avg_score} Pkt</span></span>
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-700 p-3 space-y-2">
          {/* Team-KPIs */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Team-Score', val: `${d.team_avg_score}`, color: d.team_avg_score >= 80 ? 'text-green-400' : d.team_avg_score >= 65 ? 'text-amber-400' : 'text-red-400' },
              { label: 'On-Time', val: `${d.team_on_time_pct}%`, color: d.team_on_time_pct >= 85 ? 'text-green-400' : d.team_on_time_pct >= 70 ? 'text-amber-400' : 'text-red-400' },
              { label: 'Aktive Touren', val: `${d.aktive_touren_gesamt}`, color: 'text-blue-400' },
            ].map(k => (
              <div key={k.label} className="rounded-lg bg-gray-800/60 border border-gray-700 px-2 py-1.5 text-center">
                <div className={`text-base font-black tabular-nums ${k.color}`}>{k.val}</div>
                <div className="text-[9px] text-gray-500 mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Fahrer-Scores */}
          <div className="space-y-1.5">
            {d.fahrer.sort((a, b) => b.score - a.score).map(f => {
              const s = scoreCls(f.ampel);
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-2.5 ${s.card}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${s.dot} shrink-0`} />
                      <span className="text-xs font-semibold text-white">{f.fahrer_name}</span>
                      <span className="text-[9px] text-gray-500 hidden sm:inline">{f.gelieferte_stopps}/{f.gesamt_stopps} Stopps</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {f.eta_min != null && (
                        <span className="flex items-center gap-0.5 text-[10px] text-blue-400">
                          <MapPin className="h-2.5 w-2.5" />{f.eta_min} Min
                        </span>
                      )}
                      <div className="text-right">
                        <span className={`text-lg font-black tabular-nums ${s.score}`}>{f.score}</span>
                        <span className={`text-[9px] font-bold ml-1 ${f.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {f.score_delta >= 0 ? '+' : ''}{f.score_delta}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${f.ampel === 'rot' ? 'bg-red-500' : f.ampel === 'gelb' ? 'bg-amber-400' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(100, f.score)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[9px] text-gray-500">
                    <span>Pünktlichkeit: <span className={f.puenktlichkeit_pct >= 80 ? 'text-green-400' : 'text-amber-400'}>{f.puenktlichkeit_pct}%</span></span>
                    <span>Storno: <span className={f.storno_rate_pct > 5 ? 'text-red-400' : 'text-gray-400'}>{f.storno_rate_pct}%</span></span>
                  </div>
                </div>
              );
            })}
            {d.fahrer.length === 0 && (
              <div className="py-4 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                <Truck className="h-4 w-4" />Keine aktiven Touren
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
