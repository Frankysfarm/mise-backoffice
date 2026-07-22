'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, MapPin, Navigation, Package, Star, Zap } from 'lucide-react';

interface Stopp {
  id: string;
  nr: number;
  adresse: string;
  kunde: string;
  status: 'ausstehend' | 'unterwegs' | 'abgeschlossen' | 'problem';
  eta_min: number | null;
  distanz_km: number;
}

interface Tour {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_trend: 'up' | 'down' | 'flat';
  stopps: Stopp[];
  gesamt_eta_min: number;
  abgeschlossen: number;
  gesamt: number;
  online: boolean;
  bewertung: number;
}

interface ApiData {
  touren: Tour[];
  schicht_score_avg: number;
  alert_count: number;
}

const MOCK: ApiData = {
  schicht_score_avg: 81,
  alert_count: 1,
  touren: [
    {
      fahrer_id: 'f1', fahrer_name: 'Max Müller', score: 87, score_trend: 'up', online: true, bewertung: 4.7,
      gesamt_eta_min: 35, abgeschlossen: 3, gesamt: 6,
      stopps: [
        { id: 's1', nr: 1, adresse: 'Hauptstr. 12', kunde: 'Anna K.', status: 'abgeschlossen', eta_min: null, distanz_km: 1.2 },
        { id: 's2', nr: 2, adresse: 'Bahnhofstr. 5', kunde: 'Tom L.', status: 'abgeschlossen', eta_min: null, distanz_km: 0.8 },
        { id: 's3', nr: 3, adresse: 'Marktplatz 3', kunde: 'Lea W.', status: 'abgeschlossen', eta_min: null, distanz_km: 1.5 },
        { id: 's4', nr: 4, adresse: 'Gartenweg 7', kunde: 'Ben S.', status: 'unterwegs', eta_min: 8, distanz_km: 2.1 },
        { id: 's5', nr: 5, adresse: 'Ringstr. 22', kunde: 'Mia F.', status: 'ausstehend', eta_min: 18, distanz_km: 1.9 },
        { id: 's6', nr: 6, adresse: 'Parkweg 9', kunde: 'Jan P.', status: 'ausstehend', eta_min: 28, distanz_km: 2.4 },
      ],
    },
    {
      fahrer_id: 'f2', fahrer_name: 'Sara Koch', score: 72, score_trend: 'down', online: true, bewertung: 4.3,
      gesamt_eta_min: 52, abgeschlossen: 1, gesamt: 5,
      stopps: [
        { id: 's7', nr: 1, adresse: 'Rosenweg 4', kunde: 'Kim R.', status: 'abgeschlossen', eta_min: null, distanz_km: 1.1 },
        { id: 's8', nr: 2, adresse: 'Birkenstr. 11', kunde: 'Pia T.', status: 'unterwegs', eta_min: 12, distanz_km: 3.2 },
        { id: 's9', nr: 3, adresse: 'Eichenallee 6', kunde: 'Lukas M.', status: 'ausstehend', eta_min: 22, distanz_km: 2.8 },
        { id: 's10', nr: 4, adresse: 'Lindenstr. 18', kunde: 'Clara B.', status: 'problem', eta_min: null, distanz_km: 1.6 },
        { id: 's11', nr: 5, adresse: 'Ahornweg 2', kunde: 'Finn K.', status: 'ausstehend', eta_min: 42, distanz_km: 2.0 },
      ],
    },
  ],
};

const STOPP_STYLE: Record<Stopp['status'], { dot: string; text: string; label: string }> = {
  abgeschlossen: { dot: 'bg-green-500', text: 'text-green-400', label: '✓' },
  unterwegs:     { dot: 'bg-blue-500 animate-pulse', text: 'text-blue-400', label: '→' },
  ausstehend:    { dot: 'bg-gray-600', text: 'text-gray-500', label: '○' },
  problem:       { dot: 'bg-red-500 animate-pulse', text: 'text-red-400', label: '!' },
};

function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const color = score >= 80 ? '#22c55e' : score >= 65 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#374151" strokeWidth="3" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill={color} fontSize="11" fontWeight="bold">{score}</text>
    </svg>
  );
}

export function DispatchPhase3295TourVisualisierungLiveBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [expandedTour, setExpandedTour] = useState<string | null>(null);

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

  return (
    <div className="rounded-xl border border-gray-700 shadow mb-4 overflow-hidden bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="text-sm font-bold text-white">Tour-Visualisierung Live-Board</span>
          {d.alert_count > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
              <AlertTriangle className="h-2.5 w-2.5" />{d.alert_count} Alert
            </span>
          )}
          <span className="text-[10px] text-gray-400">Ø Score <span className={d.schicht_score_avg >= 80 ? 'text-green-400 font-bold' : 'text-amber-400 font-bold'}>{d.schicht_score_avg}</span></span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </button>

      {open && (
        <div className="border-t border-gray-700 p-3 space-y-3">
          {d.touren.map(t => {
            const isExp = expandedTour === t.fahrer_id;
            const fortschritt = Math.round((t.abgeschlossen / t.gesamt) * 100);
            const hasProblems = t.stopps.some(s => s.status === 'problem');
            return (
              <div key={t.fahrer_id} className={`rounded-lg border ${hasProblems ? 'border-red-500/50 bg-red-950/10' : 'border-gray-700 bg-gray-800/50'} overflow-hidden`}>
                {/* Tour Header */}
                <button
                  onClick={() => setExpandedTour(isExp ? null : t.fahrer_id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800/50 transition-colors text-left"
                >
                  <ScoreRing score={t.score} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white truncate">{t.fahrer_name}</span>
                      {!t.online && <span className="text-[9px] bg-gray-700 rounded px-1 py-0.5 text-gray-400">Offline</span>}
                      {hasProblems && <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex-1 h-1 rounded-full bg-gray-700 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${fortschritt}%` }} />
                      </div>
                      <span className="text-[9px] text-gray-400 tabular-nums shrink-0">{t.abgeschlossen}/{t.gesamt}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 text-[9px] text-gray-400">
                      <Clock className="h-2.5 w-2.5" />
                      <span className="tabular-nums">{t.gesamt_eta_min}m</span>
                    </div>
                    <div className="flex items-center gap-0.5 text-[9px] text-yellow-400 mt-0.5">
                      <Star className="h-2.5 w-2.5 fill-yellow-400" />
                      <span>{t.bewertung}</span>
                    </div>
                  </div>
                  {isExp ? <ChevronUp className="h-3.5 w-3.5 text-gray-500 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-500 shrink-0" />}
                </button>

                {/* Stopp-Timeline */}
                {isExp && (
                  <div className="border-t border-gray-700/60 px-3 pb-3 pt-2 space-y-1.5">
                    {/* SVG Timeline */}
                    <div className="flex items-center gap-0.5 mb-2 px-1">
                      {t.stopps.map((s, i) => {
                        const st = STOPP_STYLE[s.status];
                        return (
                          <div key={s.id} className="flex items-center flex-1">
                            <div className="flex flex-col items-center flex-1 min-w-0">
                              <div className={`h-3 w-3 rounded-full ${st.dot} shrink-0`} title={s.adresse} />
                              <span className="text-[7px] text-gray-600 truncate w-full text-center mt-0.5">{s.nr}</span>
                            </div>
                            {i < t.stopps.length - 1 && (
                              <div className={`flex-1 h-0.5 mx-0.5 ${i < t.abgeschlossen - 1 ? 'bg-green-600' : i === t.abgeschlossen - 1 ? 'bg-blue-600' : 'bg-gray-700'}`} />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Stopp Liste */}
                    {t.stopps.map(s => {
                      const st = STOPP_STYLE[s.status];
                      return (
                        <div key={s.id} className={`flex items-center gap-2 rounded px-2 py-1 ${s.status === 'unterwegs' ? 'bg-blue-950/30 border border-blue-700/30' : s.status === 'problem' ? 'bg-red-950/30 border border-red-700/30' : 'bg-gray-800/30'}`}>
                          <div className={`h-2 w-2 rounded-full ${st.dot} shrink-0`} />
                          <span className="text-[9px] text-gray-500 w-4 shrink-0">#{s.nr}</span>
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <MapPin className="h-2.5 w-2.5 text-gray-600 shrink-0" />
                            <span className="text-[10px] text-gray-300 truncate">{s.adresse}</span>
                          </div>
                          <span className="text-[9px] text-gray-500 truncate max-w-[60px] shrink-0">{s.kunde}</span>
                          {s.eta_min !== null ? (
                            <span className={`text-[9px] tabular-nums shrink-0 ${st.text}`}>{s.eta_min}m</span>
                          ) : s.status === 'abgeschlossen' ? (
                            <Package className="h-2.5 w-2.5 text-green-500 shrink-0" />
                          ) : (
                            <AlertTriangle className="h-2.5 w-2.5 text-red-400 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex items-center justify-between text-[9px] text-gray-600 px-1">
            <Zap className="h-2.5 w-2.5 text-blue-500" />
            <span>Polling alle 20 Sek</span>
          </div>
        </div>
      )}
    </div>
  );
}
