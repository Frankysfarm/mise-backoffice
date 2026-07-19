'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, Navigation2, Star, Clock, ChevronDown, ChevronUp, Zap } from 'lucide-react';

interface StoppStatus {
  nr: number;
  adresse: string;
  eta_min: number | null;
  status: 'pending' | 'on_way' | 'delivered';
}

interface FahrerTour {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_prev: number;
  aktive_tour: boolean;
  stopps_gesamt: number;
  stopps_erledigt: number;
  eta_min_naechster: number | null;
  stopps: StoppStatus[];
  bewertung: number;
  puenktlichkeit_pct: number;
}

interface ApiData {
  fahrer: FahrerTour[];
  team_score: number;
}

function scoreColor(s: number): string {
  if (s >= 80) return 'text-green-700';
  if (s >= 60) return 'text-amber-700';
  return 'text-red-700';
}

function scoreBg(s: number): string {
  if (s >= 80) return 'bg-green-100 border-green-200';
  if (s >= 60) return 'bg-amber-100 border-amber-200';
  return 'bg-red-100 border-red-200';
}

function StoppDots({ stopps }: { stopps: StoppStatus[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {stopps.map(s => (
        <div
          key={s.nr}
          title={`Stop ${s.nr}: ${s.adresse} ${s.eta_min != null ? `(ETA ${s.eta_min} Min)` : ''}`}
          className={`w-3 h-3 rounded-full border ${
            s.status === 'delivered' ? 'bg-emerald-500 border-emerald-600' :
            s.status === 'on_way' ? 'bg-blue-500 border-blue-600 animate-pulse' :
            'bg-stone-200 border-stone-300'
          }`}
        />
      ))}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const stroke = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
      <circle
        cx="18" cy="18" r={r}
        fill="none" stroke={stroke} strokeWidth="3.5"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        transform="rotate(-90 18 18)"
      />
      <text x="18" y="22" textAnchor="middle" fontSize="9" fontWeight="700" fill={stroke}>{score}</text>
    </svg>
  );
}

const MOCK: ApiData = {
  team_score: 74,
  fahrer: [
    { fahrer_id: '1', fahrer_name: 'Mehmet K.', score: 88, score_prev: 85, aktive_tour: true, stopps_gesamt: 4, stopps_erledigt: 2, eta_min_naechster: 7, bewertung: 4.8, puenktlichkeit_pct: 92, stopps: [{ nr: 1, adresse: 'Hauptstr. 12', eta_min: null, status: 'delivered' }, { nr: 2, adresse: 'Lindenstr. 5', eta_min: null, status: 'delivered' }, { nr: 3, adresse: 'Parkweg 8', eta_min: 7, status: 'on_way' }, { nr: 4, adresse: 'Birkenallee 3', eta_min: 18, status: 'pending' }] },
    { fahrer_id: '2', fahrer_name: 'Sven T.', score: 62, score_prev: 70, aktive_tour: true, stopps_gesamt: 3, stopps_erledigt: 1, eta_min_naechster: 12, bewertung: 4.2, puenktlichkeit_pct: 71, stopps: [{ nr: 1, adresse: 'Bahnhofstr. 22', eta_min: null, status: 'delivered' }, { nr: 2, adresse: 'Schulgasse 1', eta_min: 12, status: 'on_way' }, { nr: 3, adresse: 'Ringstr. 7', eta_min: 24, status: 'pending' }] },
    { fahrer_id: '3', fahrer_name: 'Julia M.', score: 45, score_prev: 50, aktive_tour: false, stopps_gesamt: 2, stopps_erledigt: 2, eta_min_naechster: null, bewertung: 3.9, puenktlichkeit_pct: 58, stopps: [{ nr: 1, adresse: 'Mozartstr. 3', eta_min: null, status: 'delivered' }, { nr: 2, adresse: 'Beethovenstr. 11', eta_min: null, status: 'delivered' }] },
  ],
};

export function DispatchPhase2467TourScoreVisualisierungLiveCockpit({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/tour-score-live?location_id=${locationId}`);
      if (r.ok) {
        const json = await r.json();
        if (json?.fahrer?.length) setData(json);
      }
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 25_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const lowScore = data.fahrer.filter(f => f.score < 60);
  const hasAlert = lowScore.length > 0;

  return (
    <div className="rounded-xl border border-stone-200 bg-white mb-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <Navigation2 size={15} className="text-stone-600" />
          <span className="font-semibold text-sm text-stone-800">Tour-Score & Visualisierung</span>
        </div>
        <div className={`text-sm font-black px-2 py-0.5 rounded-full ${scoreBg(data.team_score)}`}>
          <span className={scoreColor(data.team_score)}>Team-Ø {data.team_score}</span>
        </div>
      </div>

      {/* Alert */}
      {hasAlert && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-800 text-xs border-b border-red-100">
          <AlertTriangle size={12} className="shrink-0" />
          Score unter 60: {lowScore.map(f => f.fahrer_name).join(', ')} — Unterstützung prüfen!
        </div>
      )}

      {/* Driver Cards */}
      <div className="divide-y divide-stone-50">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id}>
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 transition-colors"
              onClick={() => setExpanded(expanded === f.fahrer_id ? null : f.fahrer_id)}
            >
              <ScoreRing score={f.score} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-stone-800 truncate">{f.fahrer_name}</span>
                  {f.aktive_tour && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Aktiv</span>
                  )}
                  {f.score < f.score_prev && (
                    <span className="text-[10px] text-red-500">↓{f.score_prev - f.score}</span>
                  )}
                  {f.score > f.score_prev && (
                    <span className="text-[10px] text-green-600">↑{f.score - f.score_prev}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <StoppDots stopps={f.stopps} />
                  <span className="text-xs text-stone-400">{f.stopps_erledigt}/{f.stopps_gesamt} Stopps</span>
                  {f.eta_min_naechster != null && (
                    <span className="text-xs text-stone-400 flex items-center gap-1">
                      <Clock size={10} /> ETA {f.eta_min_naechster} Min
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 text-xs text-stone-500 shrink-0">
                <span className="flex items-center gap-0.5"><Star size={11} className="text-amber-400" />{f.bewertung.toFixed(1)}</span>
                <span>{f.puenktlichkeit_pct}% pünktl.</span>
              </div>

              {expanded === f.fahrer_id ? <ChevronUp size={14} className="text-stone-400 shrink-0" /> : <ChevronDown size={14} className="text-stone-400 shrink-0" />}
            </button>

            {/* Expanded stop list */}
            {expanded === f.fahrer_id && (
              <div className="px-4 pb-3 pt-1 bg-stone-50 space-y-1.5">
                {f.stopps.map(s => (
                  <div key={s.nr} className="flex items-center gap-2 text-xs">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${s.status === 'delivered' ? 'bg-emerald-500' : s.status === 'on_way' ? 'bg-blue-500' : 'bg-stone-300'}`} />
                    <span className="text-stone-500 w-4 shrink-0">{s.nr}.</span>
                    <span className="text-stone-700 flex-1 truncate">{s.adresse}</span>
                    {s.eta_min != null && (
                      <span className="text-stone-400 shrink-0">ETA {s.eta_min} Min</span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${s.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : s.status === 'on_way' ? 'bg-blue-100 text-blue-700' : 'bg-stone-100 text-stone-500'}`}>
                      {s.status === 'delivered' ? 'Geliefert' : s.status === 'on_way' ? 'Unterwegs' : 'Ausstehend'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="px-4 pb-3 pt-2 flex gap-3 text-[10px] text-stone-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Geliefert</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Unterwegs</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-stone-300 inline-block" /> Ausstehend</span>
      </div>
    </div>
  );
}
