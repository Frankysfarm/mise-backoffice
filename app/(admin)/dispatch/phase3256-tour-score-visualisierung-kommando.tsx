'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, MapPin, Navigation, Trophy } from 'lucide-react';

interface Stopp {
  nr: number;
  adresse: string;
  status: 'offen' | 'unterwegs' | 'geliefert';
  eta_min: number | null;
}

interface Fahrer {
  id: string;
  name: string;
  score: number;
  score_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  stopps: Stopp[];
  fortschritt_pct: number;
  eta_rueckkehr_min: number | null;
  sub_puenktlichkeit: number;
  sub_abschluss: number;
  sub_speed: number;
}

interface ApiData {
  fahrer: Fahrer[];
  flotten_avg_score: number;
  aktiv: number;
}

const MOCK: ApiData = {
  flotten_avg_score: 77,
  aktiv: 3,
  fahrer: [
    {
      id: 'f1', name: 'Max M.', score: 91, score_delta: 3, ampel: 'gruen', fortschritt_pct: 67, eta_rueckkehr_min: 18,
      sub_puenktlichkeit: 95, sub_abschluss: 100, sub_speed: 88,
      stopps: [
        { nr: 1, adresse: 'Hauptstr. 12', status: 'geliefert', eta_min: null },
        { nr: 2, adresse: 'Bahnhofstr. 5', status: 'geliefert', eta_min: null },
        { nr: 3, adresse: 'Gartenweg 8',  status: 'unterwegs', eta_min: 6  },
      ],
    },
    {
      id: 'f2', name: 'Sara K.', score: 68, score_delta: -2, ampel: 'gelb', fortschritt_pct: 30, eta_rueckkehr_min: 42,
      sub_puenktlichkeit: 72, sub_abschluss: 80, sub_speed: 62,
      stopps: [
        { nr: 1, adresse: 'Ringstr. 3',    status: 'unterwegs', eta_min: 13 },
        { nr: 2, adresse: 'Kirchgasse 7',  status: 'offen',     eta_min: 26 },
        { nr: 3, adresse: 'Bergweg 15',    status: 'offen',     eta_min: 40 },
      ],
    },
    {
      id: 'f3', name: 'Tim B.', score: 49, score_delta: -8, ampel: 'rot', fortschritt_pct: 10, eta_rueckkehr_min: 61,
      sub_puenktlichkeit: 51, sub_abschluss: 60, sub_speed: 44,
      stopps: [
        { nr: 1, adresse: 'Schlossallee 1', status: 'unterwegs', eta_min: 22 },
        { nr: 2, adresse: 'Parkstr. 44',    status: 'offen',     eta_min: 45 },
      ],
    },
  ],
};

const AMP = {
  gruen: { border: 'border-green-600/40', bg: 'bg-green-950/20', score: 'text-green-400', progress: 'bg-green-500', ring: '#22c55e' },
  gelb:  { border: 'border-amber-500/40', bg: 'bg-amber-950/20', score: 'text-amber-400', progress: 'bg-amber-400', ring: '#f59e0b' },
  rot:   { border: 'border-red-600/50',   bg: 'bg-red-950/25',   score: 'text-red-400',   progress: 'bg-red-500',   ring: '#ef4444' },
};

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="56" height="56" className="shrink-0">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#374151" strokeWidth="4" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 28 28)" style={{ transition: 'stroke-dasharray 0.7s' }} />
      <text x="28" y="33" textAnchor="middle" fontSize="13" fontWeight="bold" fill={color}>{score}</text>
    </svg>
  );
}

function stoppDot(status: string) {
  if (status === 'geliefert') return 'bg-green-500';
  if (status === 'unterwegs') return 'bg-blue-400 animate-pulse';
  return 'bg-gray-600';
}

export function DispatchPhase3256TourScoreVisualisierungKommando({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/dispatch/tours?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (locationId) load(); else setData(MOCK);
    const p = setInterval(load, 20_000);
    return () => clearInterval(p);
  }, [locationId]);

  const d = data ?? MOCK;
  const warnCount = d.fahrer.filter(f => f.score < 65).length;

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  return (
    <div className="rounded-xl border border-gray-700 shadow mb-4 overflow-hidden bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-sm font-bold text-white">Tour-Score + Visualisierung Kommando</span>
          {warnCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
              <AlertTriangle className="h-2.5 w-2.5" />{warnCount} Score &lt;65
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">Flotte Ø <span className="text-white font-bold">{d.flotten_avg_score}</span></span>
          {open ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-700 p-3 space-y-2">
          {d.fahrer.map(f => {
            const s = AMP[f.ampel];
            const isExp = expanded.has(f.id);
            return (
              <div key={f.id} className={`rounded-lg border ${s.border} ${s.bg}`}>
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                  onClick={() => toggleExpand(f.id)}
                >
                  <ScoreRing score={f.score} color={s.ring} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-white">{f.name}</span>
                      <span className={`text-[10px] font-bold ${f.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {f.score_delta >= 0 ? `+${f.score_delta}` : f.score_delta}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-400">
                      <span>Pünktl. <span className="text-white font-semibold">{f.sub_puenktlichkeit}%</span></span>
                      <span>Abschl. <span className="text-white font-semibold">{f.sub_abschluss}%</span></span>
                      <span>Speed <span className="text-white font-semibold">{f.sub_speed}</span></span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1 rounded-full bg-gray-700 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${s.progress}`} style={{ width: `${f.fortschritt_pct}%` }} />
                      </div>
                      <span className="text-[9px] text-gray-500">{f.fortschritt_pct}%</span>
                      {f.eta_rueckkehr_min !== null && (
                        <span className="flex items-center gap-0.5 text-[9px] text-blue-400">
                          <Clock className="h-2.5 w-2.5" />Rückkehr {f.eta_rueckkehr_min}m
                        </span>
                      )}
                    </div>
                  </div>
                  {isExp ? <ChevronUp className="h-4 w-4 text-gray-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />}
                </button>

                {isExp && (
                  <div className="border-t border-gray-700/50 px-3 pb-3 pt-2 space-y-1">
                    {f.stopps.map(stopp => (
                      <div key={stopp.nr} className="flex items-center gap-2 text-xs">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${stoppDot(stopp.status)}`} />
                        <span className={stopp.status === 'geliefert' ? 'text-gray-500 line-through flex-1' : 'text-gray-200 flex-1'}>
                          {stopp.nr}. {stopp.adresse}
                        </span>
                        {stopp.status === 'unterwegs' && (
                          <span className="flex items-center gap-1 text-blue-400 shrink-0">
                            <Navigation className="h-3 w-3" />{stopp.eta_min}m
                          </span>
                        )}
                        {stopp.status === 'geliefert' && <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />}
                        {stopp.status === 'offen' && stopp.eta_min !== null && (
                          <span className="flex items-center gap-0.5 text-gray-500 shrink-0">
                            <MapPin className="h-3 w-3" />{stopp.eta_min}m
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {d.fahrer.length === 0 && (
            <p className="py-3 text-center text-sm text-gray-500">Keine aktiven Touren</p>
          )}
        </div>
      )}
    </div>
  );
}
