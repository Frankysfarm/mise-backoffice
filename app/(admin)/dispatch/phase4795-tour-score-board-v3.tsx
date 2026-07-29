'use client';

import { useEffect, useState } from 'react';
import { Trophy, MapPin, Clock, TrendingUp, TrendingDown, Minus, CheckCircle2, Circle, AlertTriangle, Navigation2 } from 'lucide-react';

interface StoppRow {
  stopp_nr: number;
  adresse: string;
  status: 'geliefert' | 'aktiv' | 'ausstehend' | 'verspaetet';
  eta_min: number | null;
  km: number | null;
}

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_ampel: 'platin' | 'gold' | 'gut' | 'schwach';
  rank_delta: number;
  stopps: StoppRow[];
  puenktlichkeit_pct: number;
  avg_lieferzeit_min: number;
  offene_stopps: number;
  tour_aktiv: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_score: number;
  team_score_delta: number;
  ziel_score: number;
  alert_fahrer: string[];
  timestamp: string;
}

const SCORE_STYLES = {
  platin: { bg: 'bg-violet-900/40', border: 'border-violet-600', text: 'text-violet-300', badge: 'bg-violet-700', label: 'Platin' },
  gold:   { bg: 'bg-yellow-900/30', border: 'border-yellow-600', text: 'text-yellow-300', badge: 'bg-yellow-600', label: 'Gold' },
  gut:    { bg: 'bg-green-900/30',  border: 'border-green-700',  text: 'text-green-300',  badge: 'bg-green-700',  label: 'Gut' },
  schwach:{ bg: 'bg-red-900/30',   border: 'border-red-700',    text: 'text-red-300',    badge: 'bg-red-700',    label: 'Schwach' },
};

const STOPP_STYLES = {
  geliefert:  { color: 'text-green-400',  icon: CheckCircle2, label: 'Geliefert' },
  aktiv:      { color: 'text-blue-400',   icon: Navigation2,  label: 'Unterwegs' },
  ausstehend: { color: 'text-gray-500',   icon: Circle,       label: 'Ausstehend' },
  verspaetet: { color: 'text-red-400',    icon: AlertTriangle, label: 'Verspätet' },
};

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

function ScoreArc({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 90 ? '#a78bfa' : pct >= 75 ? '#fbbf24' : pct >= 60 ? '#4ade80' : '#f87171';
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0">
      <circle cx="24" cy="24" r={r} fill="none" stroke="#1f2937" strokeWidth="4" />
      <circle
        cx="24" cy="24" r={r} fill="none"
        stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 24 24)"
      />
      <text x="24" y="28" textAnchor="middle" fill={color} fontSize="10" fontWeight="700">{score}</text>
    </svg>
  );
}

function generateMock(): ApiResponse {
  return {
    team_score: 82,
    team_score_delta: 3,
    ziel_score: 85,
    alert_fahrer: ['Fahrer Müller'],
    timestamp: new Date().toISOString(),
    fahrer: [
      {
        fahrer_id: 'f1', fahrer_name: 'Schmidt', score: 94, score_ampel: 'platin', rank_delta: 1,
        puenktlichkeit_pct: 96, avg_lieferzeit_min: 22, offene_stopps: 2, tour_aktiv: true,
        stopps: [
          { stopp_nr: 1, adresse: 'Hauptstr. 12', status: 'geliefert', eta_min: null, km: 1.2 },
          { stopp_nr: 2, adresse: 'Gartenweg 5', status: 'aktiv', eta_min: 3, km: 0.8 },
          { stopp_nr: 3, adresse: 'Mühlenstr. 18', status: 'ausstehend', eta_min: 10, km: 1.5 },
        ],
      },
      {
        fahrer_id: 'f2', fahrer_name: 'Müller', score: 58, score_ampel: 'schwach', rank_delta: -2,
        puenktlichkeit_pct: 61, avg_lieferzeit_min: 38, offene_stopps: 3, tour_aktiv: true,
        stopps: [
          { stopp_nr: 1, adresse: 'Ringstr. 3', status: 'verspaetet', eta_min: null, km: 2.1 },
          { stopp_nr: 2, adresse: 'Postplatz 7', status: 'ausstehend', eta_min: 15, km: 1.0 },
          { stopp_nr: 3, adresse: 'Schulstr. 22', status: 'ausstehend', eta_min: 25, km: 2.3 },
        ],
      },
      {
        fahrer_id: 'f3', fahrer_name: 'Weber', score: 78, score_ampel: 'gut', rank_delta: 0,
        puenktlichkeit_pct: 80, avg_lieferzeit_min: 28, offene_stopps: 1, tour_aktiv: true,
        stopps: [
          { stopp_nr: 1, adresse: 'Bahnhofstr. 9', status: 'geliefert', eta_min: null, km: 1.8 },
          { stopp_nr: 2, adresse: 'Marktplatz 1', status: 'aktiv', eta_min: 5, km: 1.2 },
        ],
      },
    ],
  };
}

export function DispatchPhase4795TourScoreBoardV3({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/dispatch/tour-score-board?${params}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(generateMock());
      }
    } catch {
      setData(generateMock());
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!data) return null;

  const teamScoreColor = data.team_score >= data.ziel_score ? 'text-green-400' : data.team_score >= data.ziel_score * 0.85 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="rounded-xl border border-indigo-800 bg-indigo-950/30 p-4 mb-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-semibold text-indigo-300">Tour-Score Live Board V3</span>
        <span className="ml-auto text-xs text-gray-500 font-mono">
          {new Date(data.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Team Score Header */}
      <div className="flex items-center gap-3 bg-black/20 rounded-lg p-3 mb-3">
        <ScoreArc score={data.team_score} />
        <div className="flex-1">
          <div className="text-xs text-gray-400">Team-Score</div>
          <div className={`text-2xl font-bold ${teamScoreColor}`}>{data.team_score}</div>
          <div className="flex items-center gap-1 text-xs">
            <DeltaIcon delta={data.team_score_delta} />
            <span className={data.team_score_delta >= 0 ? 'text-green-400' : 'text-red-400'}>
              {data.team_score_delta >= 0 ? '+' : ''}{data.team_score_delta} vs. gestern
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">Ziel</div>
          <div className="text-lg font-bold text-gray-300">{data.ziel_score}</div>
          <div className={`text-xs ${data.team_score >= data.ziel_score ? 'text-green-400' : 'text-orange-400'}`}>
            {data.team_score >= data.ziel_score ? '✓ Erreicht' : `${data.ziel_score - data.team_score} fehlen`}
          </div>
        </div>
      </div>

      {/* Alert */}
      {data.alert_fahrer.length > 0 && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700 rounded px-3 py-1.5 mb-3 text-xs text-red-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Unter Ziel: {data.alert_fahrer.join(', ')}
        </div>
      )}

      {/* Fahrer-Scores */}
      <div className="space-y-2">
        {data.fahrer.map(f => {
          const style = SCORE_STYLES[f.score_ampel];
          const isExpanded = expanded === f.fahrer_id;
          return (
            <div key={f.fahrer_id} className={`rounded-lg border ${style.border} ${style.bg}`}>
              <button
                className="w-full flex items-center gap-3 p-2.5 text-left"
                onClick={() => setExpanded(isExpanded ? null : f.fahrer_id)}
              >
                <div className={`w-8 h-8 rounded-full ${style.badge} flex items-center justify-center`}>
                  <span className="text-xs font-bold text-white">{f.score}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-semibold ${style.text}`}>{f.fahrer_name}</span>
                    <span className="text-[10px] text-gray-500">{style.label}</span>
                    <DeltaIcon delta={f.rank_delta} />
                  </div>
                  {/* Score Bar */}
                  <div className="h-1 bg-gray-800 rounded-full mt-1 overflow-hidden">
                    <div className={`h-full ${style.badge}`} style={{ width: `${f.score}%` }} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-gray-400">{f.offene_stopps} offen</div>
                  <div className={`text-xs ${f.puenktlichkeit_pct >= 85 ? 'text-green-400' : f.puenktlichkeit_pct >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {f.puenktlichkeit_pct}%
                  </div>
                </div>
              </button>

              {/* Expanded: Stopp-Timeline */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-white/5 pt-2">
                  <div className="grid grid-cols-2 gap-2 mb-2 text-center">
                    <div className="bg-black/20 rounded p-1.5">
                      <div className="text-xs text-gray-400">Ø Lieferzeit</div>
                      <div className={`text-sm font-bold ${f.avg_lieferzeit_min <= 30 ? 'text-green-400' : f.avg_lieferzeit_min <= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {f.avg_lieferzeit_min} Min
                      </div>
                    </div>
                    <div className="bg-black/20 rounded p-1.5">
                      <div className="text-xs text-gray-400">Pünktlichkeit</div>
                      <div className={`text-sm font-bold ${f.puenktlichkeit_pct >= 85 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {f.puenktlichkeit_pct}%
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {f.stopps.map(s => {
                      const ss = STOPP_STYLES[s.status];
                      const Icon = ss.icon;
                      return (
                        <div key={s.stopp_nr} className="flex items-center gap-2">
                          <Icon className={`w-3 h-3 shrink-0 ${ss.color}`} />
                          <span className="text-[10px] text-gray-400 w-4">{s.stopp_nr}</span>
                          <span className="text-xs text-gray-300 flex-1 truncate">{s.adresse}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {s.km !== null && (
                              <span className="text-[10px] text-gray-500">{s.km} km</span>
                            )}
                            {s.eta_min !== null && (
                              <span className={`text-[10px] ${ss.color}`}>
                                <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                                {s.eta_min} Min
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 text-[10px] text-gray-600 text-center">20-Sek-Polling · Tour-Stopps aufklappbar</div>
    </div>
  );
}
