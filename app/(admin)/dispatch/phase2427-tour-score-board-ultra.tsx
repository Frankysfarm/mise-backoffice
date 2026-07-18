'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, MapPin, Clock } from 'lucide-react';

interface TourStop {
  nr: number;
  erledigt: boolean;
}

interface TourRow {
  tourId: string;
  fahrerName: string;
  zone: string | null;
  score: number;
  scoreTrend: 'up' | 'down' | 'neutral';
  stopps: TourStop[];
  etaMin: number | null;
  status: 'on-time' | 'tight' | 'late';
}

interface ApiData {
  touren: TourRow[];
}

function scoreColor(s: number) {
  if (s >= 80) return { ring: '#22c55e', text: 'text-green-700', bg: 'bg-green-50 border-green-200' };
  if (s >= 60) return { ring: '#f59e0b', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
  return { ring: '#ef4444', text: 'text-red-700', bg: 'bg-red-50 border-red-200' };
}

function statusBadge(s: string) {
  if (s === 'on-time') return 'bg-green-100 text-green-700';
  if (s === 'tight') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function statusLabel(s: string) {
  if (s === 'on-time') return 'Pünktlich';
  if (s === 'tight') return 'Knapp';
  return 'Verzögert';
}

function ScoreRing({ score }: { score: number }) {
  const c = scoreColor(score);
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, score) / 100) * circ;
  return (
    <svg width="44" height="44" className="shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle
        cx="22" cy="22" r={r} fill="none" stroke={c.ring} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
      />
      <text x="22" y="26" textAnchor="middle" fontSize="10" fontWeight="900" fill={c.ring}>
        {score}
      </text>
    </svg>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUp size={12} className="text-green-600" />;
  if (trend === 'down') return <TrendingDown size={12} className="text-red-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

function StoppDots({ stopps }: { stopps: TourStop[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {stopps.map(s => (
        <span
          key={s.nr}
          className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border ${
            s.erledigt
              ? 'bg-green-500 border-green-600 text-white'
              : 'bg-white border-gray-300 text-gray-500'
          }`}
        >
          {s.nr}
        </span>
      ))}
    </div>
  );
}

export function DispatchPhase2427TourScoreBoardUltra({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/dispatch-score-tour-cockpit?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 25 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const touren = data?.touren ?? [];
  const lateCount = touren.filter(t => t.status === 'late').length;
  const avgScore = touren.length > 0 ? Math.round(touren.reduce((a, t) => a + t.score, 0) / touren.length) : 0;
  const hasAlert = lateCount > 0;

  return (
    <div className={`rounded-xl border mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <MapPin size={16} className={hasAlert ? 'text-red-600' : 'text-blue-600'} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-red-800' : 'text-blue-800'}`}>
            Tour-Score Board
            {data ? ` — ${touren.length} Touren · Ø Score ${avgScore}` : ''}
          </span>
          {hasAlert && (
            <span className="text-xs bg-red-200 text-red-800 rounded-full px-2 py-0.5">
              {lateCount} verzögert
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!data ? (
            <p className="text-xs text-gray-500 animate-pulse">Lade Tour-Daten…</p>
          ) : (
            <>
              {/* KPI Strip */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Aktive Touren', value: touren.length.toString(), color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Ø Score', value: avgScore.toString(), color: avgScore >= 80 ? 'text-green-700' : avgScore >= 60 ? 'text-amber-700' : 'text-red-700', bg: 'bg-white border-gray-200' },
                  { label: 'Verzögert', value: lateCount.toString(), color: lateCount > 0 ? 'text-red-700' : 'text-green-700', bg: lateCount > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200' },
                ].map(k => (
                  <div key={k.label} className={`rounded-lg p-2 border text-center ${k.bg}`}>
                    <p className={`text-base font-black ${k.color}`}>{k.value}</p>
                    <p className="text-[10px] text-gray-500">{k.label}</p>
                  </div>
                ))}
              </div>

              {hasAlert && (
                <div className="flex items-start gap-2 bg-red-100 border border-red-200 rounded-lg p-2">
                  <AlertTriangle size={13} className="text-red-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-800 font-semibold">
                    {lateCount} Tour{lateCount !== 1 ? 'en' : ''} verzögert — sofort Fahrer kontaktieren!
                  </p>
                </div>
              )}

              {/* Tour Cards */}
              {touren.length === 0 ? (
                <p className="text-xs text-gray-500">Keine aktiven Touren.</p>
              ) : (
                <div className="space-y-2">
                  {touren.map(tour => {
                    const sc = scoreColor(tour.score);
                    const erledigt = tour.stopps.filter(s => s.erledigt).length;
                    const progressPct = tour.stopps.length > 0 ? (erledigt / tour.stopps.length) * 100 : 0;
                    return (
                      <div key={tour.tourId} className={`rounded-lg border p-3 ${sc.bg}`}>
                        <div className="flex items-start gap-3">
                          <ScoreRing score={tour.score} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-gray-800">{tour.fahrerName}</span>
                              {tour.zone && (
                                <span className="text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-600">
                                  Zone {tour.zone}
                                </span>
                              )}
                              <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-semibold ${statusBadge(tour.status)}`}>
                                {statusLabel(tour.status)}
                              </span>
                              <TrendIcon trend={tour.scoreTrend} />
                            </div>

                            {/* Stop dots + progress */}
                            <div className="mt-2 space-y-1">
                              <StoppDots stopps={tour.stopps} />
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${tour.status === 'late' ? 'bg-red-500' : tour.status === 'tight' ? 'bg-amber-400' : 'bg-green-500'}`}
                                    style={{ width: `${progressPct}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-gray-500 shrink-0">
                                  {erledigt}/{tour.stopps.length}
                                </span>
                              </div>
                            </div>

                            {tour.etaMin != null && (
                              <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500">
                                <Clock size={10} />
                                ETA {tour.etaMin} Min
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Legend */}
              <div className="flex gap-3 text-[10px] text-gray-500 pt-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Score ≥80</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 60–79</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt;60</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
