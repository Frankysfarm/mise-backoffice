'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, MapPin, Navigation, Star, TrendingDown, TrendingUp, Zap } from 'lucide-react';

interface Stopp {
  id: string;
  nr: number;
  adresse: string;
  status: 'ausstehend' | 'unterwegs' | 'abgeschlossen' | 'problem';
  eta_min: number | null;
}

interface Fahrer {
  id: string;
  name: string;
  score: number;
  score_delta: number;
  trend: 'up' | 'down' | 'flat';
  stopps: Stopp[];
  abgeschlossen: number;
  gesamt: number;
  eta_rueckkehr_min: number;
  bewertung: number;
  online: boolean;
}

interface ApiData {
  fahrer: Fahrer[];
  flotten_score_avg: number;
  alert_fahrer: string[];
}

const MOCK: ApiData = {
  flotten_score_avg: 79,
  alert_fahrer: ['Kai B.'],
  fahrer: [
    {
      id: 'f1', name: 'Max M.', score: 91, score_delta: +3, trend: 'up', online: true, bewertung: 4.8,
      abgeschlossen: 4, gesamt: 6, eta_rueckkehr_min: 22,
      stopps: [
        { id: 's1', nr: 1, adresse: 'Hauptstr. 12', status: 'abgeschlossen', eta_min: null },
        { id: 's2', nr: 2, adresse: 'Bahnhofstr. 5', status: 'abgeschlossen', eta_min: null },
        { id: 's3', nr: 3, adresse: 'Marktplatz 3', status: 'abgeschlossen', eta_min: null },
        { id: 's4', nr: 4, adresse: 'Gartenweg 7', status: 'abgeschlossen', eta_min: null },
        { id: 's5', nr: 5, adresse: 'Ringstr. 22', status: 'unterwegs', eta_min: 6 },
        { id: 's6', nr: 6, adresse: 'Parkweg 9', status: 'ausstehend', eta_min: 16 },
      ],
    },
    {
      id: 'f2', name: 'Sara K.', score: 83, score_delta: +1, trend: 'flat', online: true, bewertung: 4.6,
      abgeschlossen: 2, gesamt: 5, eta_rueckkehr_min: 38,
      stopps: [
        { id: 's7', nr: 1, adresse: 'Kirchgasse 3', status: 'abgeschlossen', eta_min: null },
        { id: 's8', nr: 2, adresse: 'Am Hang 9', status: 'abgeschlossen', eta_min: null },
        { id: 's9', nr: 3, adresse: 'Feldweg 1', status: 'unterwegs', eta_min: 9 },
        { id: 's10', nr: 4, adresse: 'Bergstr. 14', status: 'ausstehend', eta_min: 19 },
        { id: 's11', nr: 5, adresse: 'Talweg 6', status: 'ausstehend', eta_min: 29 },
      ],
    },
    {
      id: 'f3', name: 'Kai B.', score: 58, score_delta: -5, trend: 'down', online: true, bewertung: 3.9,
      abgeschlossen: 1, gesamt: 4, eta_rueckkehr_min: 55,
      stopps: [
        { id: 's12', nr: 1, adresse: 'Rosestr. 7', status: 'abgeschlossen', eta_min: null },
        { id: 's13', nr: 2, adresse: 'Lindenweg 4', status: 'unterwegs', eta_min: 12 },
        { id: 's14', nr: 3, adresse: 'Birkenweg 2', status: 'ausstehend', eta_min: 25 },
        { id: 's15', nr: 4, adresse: 'Eichenstr. 8', status: 'problem', eta_min: null },
      ],
    },
  ],
};

function scoreRing(score: number): string {
  if (score >= 85) return 'text-green-400 border-green-500';
  if (score >= 70) return 'text-amber-400 border-amber-500';
  if (score >= 60) return 'text-orange-400 border-orange-500';
  return 'text-red-400 border-red-500 animate-pulse';
}

function stoppDot(status: Stopp['status']): string {
  switch (status) {
    case 'abgeschlossen': return 'bg-green-500';
    case 'unterwegs': return 'bg-blue-500 animate-pulse';
    case 'ausstehend': return 'bg-gray-600';
    case 'problem': return 'bg-red-500 animate-ping';
  }
}

export function DispatchPhase3320TourScoreVisualisierungLive({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/dispatch/tour-scores?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (locationId) load(); else setData(MOCK);
    const poll = setInterval(load, 20_000);
    return () => clearInterval(poll);
  }, [locationId]);

  const d = data ?? MOCK;

  return (
    <div className="rounded-xl border border-gray-700 shadow mb-4 overflow-hidden bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Navigation className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="text-sm font-bold text-white">Tour-Score + Visualisierung Live</span>
          <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[10px] text-gray-300">
            Ø {d.flotten_score_avg} Score
          </span>
          {d.alert_fahrer.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-700 px-2 py-0.5 text-[10px] font-bold text-white">
              <AlertTriangle className="h-2.5 w-2.5" />{d.alert_fahrer.length} Alert
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-gray-700 p-3 space-y-2">
          {d.fahrer.map(f => {
            const ring = scoreRing(f.score);
            const isExpanded = expanded === f.id;
            const hasAlert = d.alert_fahrer.includes(f.name);

            return (
              <div key={f.id} className={`rounded-lg border ${hasAlert ? 'border-red-600/50 bg-red-950/20' : 'border-gray-700 bg-gray-800/60'} overflow-hidden`}>
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800/40 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : f.id)}
                >
                  {/* Score-Ring */}
                  <div className={`w-10 h-10 rounded-full border-2 ${ring} flex items-center justify-center shrink-0`}>
                    <span className={`text-sm font-black tabular-nums ${ring.split(' ')[0]}`}>{f.score}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate">{f.name}</span>
                      {f.trend === 'up' && <TrendingUp className="h-3 w-3 text-green-400 shrink-0" />}
                      {f.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-400 shrink-0" />}
                      <span className={`text-[10px] shrink-0 ${f.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {f.score_delta >= 0 ? '+' : ''}{f.score_delta}
                      </span>
                    </div>
                    {/* Stopp-Dots */}
                    <div className="flex items-center gap-1 mt-1">
                      {f.stopps.map(s => (
                        <div key={s.id} className={`w-2.5 h-2.5 rounded-full ${stoppDot(s.status)}`} title={`Stopp ${s.nr}: ${s.adresse}`} />
                      ))}
                      <span className="text-[9px] text-gray-500 ml-1">{f.abgeschlossen}/{f.gesamt}</span>
                    </div>
                  </div>

                  {/* Right */}
                  <div className="text-right shrink-0 space-y-0.5">
                    <div className="flex items-center gap-1 justify-end">
                      <Star className="h-2.5 w-2.5 text-yellow-400" />
                      <span className="text-[10px] text-gray-300">{f.bewertung.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-1 justify-end">
                      <Clock className="h-2.5 w-2.5 text-gray-500" />
                      <span className="text-[10px] text-gray-400">{f.eta_rueckkehr_min}min</span>
                    </div>
                  </div>

                  {isExpanded ? <ChevronUp className="h-3 w-3 text-gray-600 shrink-0" /> : <ChevronDown className="h-3 w-3 text-gray-600 shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-700/50 px-3 pb-2 pt-1.5 space-y-1">
                    {f.stopps.map(s => (
                      <div key={s.id} className="flex items-center gap-2 text-[10px]">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${stoppDot(s.status)}`} />
                        <span className="text-gray-500 w-4">{s.nr}.</span>
                        <MapPin className="h-2.5 w-2.5 text-gray-600 shrink-0" />
                        <span className="text-gray-300 flex-1 truncate">{s.adresse}</span>
                        {s.eta_min !== null && (
                          <span className="text-blue-400 shrink-0">{s.eta_min}min</span>
                        )}
                        {s.status === 'abgeschlossen' && <span className="text-green-500 shrink-0">✓</span>}
                        {s.status === 'problem' && <span className="text-red-400 shrink-0 animate-pulse">⚠</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex items-center justify-between text-[9px] text-gray-600 px-1 pt-1">
            <div className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /><span>20-Sek-Polling</span></div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">●</span><span>abgeschl.</span>
              <span className="text-blue-500">●</span><span>unterwegs</span>
              <span className="text-gray-600">●</span><span>ausstehend</span>
              <span className="text-red-500">●</span><span>Problem</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
