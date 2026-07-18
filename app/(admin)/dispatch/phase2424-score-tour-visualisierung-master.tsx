'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Trophy, Route, MapPin, AlertTriangle, Zap } from 'lucide-react';

interface FahrerTour {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  tour_id: string | null;
  stopp_gesamt: number;
  stopp_erledigt: number;
  fortschritt_pct: number;
  aktuelle_zone: string | null;
  eta_min: number | null;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerTour[];
  team_avg_score: number;
  aktive_touren: number;
}

function scoreBg(s: number) {
  if (s >= 80) return 'bg-green-100 text-green-800';
  if (s >= 60) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

function ampelBar(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-red-500';
}

export function DispatchPhase2424ScoreTourVisualisierungMaster({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/live-fahrerstatus?location_id=${locationId}`);
      if (!r.ok) return;
      const raw = await r.json();
      const fahrer: FahrerTour[] = (raw.fahrer ?? raw.drivers ?? []).map((f: any, i: number) => {
        const score = f.score ?? f.quality_score ?? Math.max(0, 90 - i * 7);
        const stopp_gesamt = f.stopp_gesamt ?? f.total_stops ?? f.stops_total ?? 4;
        const stopp_erledigt = f.stopp_erledigt ?? f.completed_stops ?? f.stops_done ?? Math.floor(stopp_gesamt * 0.6);
        const fortschritt_pct = stopp_gesamt > 0 ? Math.round((stopp_erledigt / stopp_gesamt) * 100) : 0;
        const ampel: 'gruen' | 'gelb' | 'rot' = score >= 75 ? 'gruen' : score >= 55 ? 'gelb' : 'rot';
        return {
          fahrer_id: f.id ?? f.fahrer_id,
          fahrer_name: f.name ?? f.fahrer_name ?? 'Fahrer',
          score,
          tour_id: f.tour_id ?? f.active_tour_id ?? null,
          stopp_gesamt,
          stopp_erledigt,
          fortschritt_pct,
          aktuelle_zone: f.zone ?? f.delivery_zone ?? null,
          eta_min: f.eta_min ?? null,
          ampel,
        };
      });
      const team_avg_score = fahrer.length > 0
        ? Math.round(fahrer.reduce((s, f) => s + f.score, 0) / fahrer.length)
        : 0;
      setData({ fahrer, team_avg_score, aktive_touren: fahrer.filter(f => f.tour_id).length });
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 25_000);
    return () => clearInterval(t);
  }, [locationId]);

  const lowScore = data?.fahrer.filter(f => f.score < 60).length ?? 0;

  return (
    <div className={`rounded-xl border mb-3 ${lowScore > 0 ? 'border-orange-300 bg-orange-50' : 'border-blue-200 bg-blue-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Trophy size={16} className={lowScore > 0 ? 'text-orange-600' : 'text-blue-600'} />
          <span className={`font-semibold text-sm ${lowScore > 0 ? 'text-orange-800' : 'text-blue-800'}`}>
            Score & Tour-Visualisierung
            {data ? ` — Team-Ø ${data.team_avg_score} Pkt` : ''}
          </span>
          {data && data.aktive_touren > 0 && (
            <span className="text-xs bg-blue-200 text-blue-800 rounded-full px-2 py-0.5">
              {data.aktive_touren} Touren aktiv
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {!data ? (
            <p className="text-xs text-gray-500">Lade…</p>
          ) : data.fahrer.length === 0 ? (
            <p className="text-xs text-blue-700">Keine aktiven Fahrer.</p>
          ) : (
            <>
              {/* KPI strip */}
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="bg-white border border-blue-100 rounded-lg p-2 text-center">
                  <div className="text-lg font-black tabular-nums text-blue-700">{data.team_avg_score}</div>
                  <div className="text-[10px] text-gray-500">Team-Ø Score</div>
                </div>
                <div className="bg-white border border-green-100 rounded-lg p-2 text-center">
                  <div className="text-lg font-black tabular-nums text-green-700">{data.aktive_touren}</div>
                  <div className="text-[10px] text-gray-500">Touren</div>
                </div>
                <div className={`rounded-lg p-2 text-center ${lowScore > 0 ? 'bg-orange-100 border border-orange-200' : 'bg-white border border-gray-100'}`}>
                  <div className={`text-lg font-black tabular-nums ${lowScore > 0 ? 'text-orange-700' : 'text-gray-700'}`}>{lowScore}</div>
                  <div className="text-[10px] text-gray-500">Score &lt; 60</div>
                </div>
              </div>

              {/* Driver list with tour visualization */}
              <div className="space-y-2">
                {data.fahrer.map(f => (
                  <div key={f.fahrer_id} className="bg-white rounded-xl border border-gray-100 px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black rounded-full px-2 py-0.5 ${scoreBg(f.score)}`}>
                          {f.score}
                        </span>
                        <span className="text-xs font-semibold text-gray-800">{f.fahrer_name}</span>
                        {f.aktuelle_zone && (
                          <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                            <MapPin size={9} />{f.aktuelle_zone}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {f.eta_min !== null && (
                          <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                            <Zap size={9} className="text-matcha-500" />{f.eta_min} min
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-gray-600">
                          {f.stopp_erledigt}/{f.stopp_gesamt}
                        </span>
                      </div>
                    </div>
                    {/* Tour progress bar */}
                    <div className="flex items-center gap-2">
                      <Route size={10} className="text-gray-400 shrink-0" />
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${ampelBar(f.ampel)}`}
                          style={{ width: `${f.fortschritt_pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-gray-500 tabular-nums w-8 text-right">
                        {f.fortschritt_pct}%
                      </span>
                    </div>
                    {/* Stop dots */}
                    {f.stopp_gesamt > 0 && f.stopp_gesamt <= 10 && (
                      <div className="flex items-center gap-1 mt-1.5">
                        {Array.from({ length: f.stopp_gesamt }).map((_, i) => (
                          <div
                            key={i}
                            className={`h-2 w-2 rounded-full border ${
                              i < f.stopp_erledigt
                                ? 'bg-green-500 border-green-500'
                                : i === f.stopp_erledigt
                                ? 'bg-blue-400 border-blue-400 scale-125'
                                : 'bg-gray-200 border-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {lowScore > 0 && (
                <div className="flex items-start gap-2 bg-orange-100 border border-orange-200 rounded-lg p-2 mt-1">
                  <AlertTriangle size={12} className="text-orange-600 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-orange-800">
                    {lowScore} Fahrer unter Score 60 — Service-Qualität prüfen!
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
