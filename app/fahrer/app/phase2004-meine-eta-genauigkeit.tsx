'use client';

import { useState, useEffect } from 'react';
import { Target, ChevronUp, ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

type Trend = 'steigend' | 'fallend' | 'stabil';

interface FahrerPrognoseScore {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  trefferquote_pct: number;
  bestellungen_geprueft: number;
  trend: Trend;
  alert: boolean;
  rang: number;
}

interface PrognoseData {
  location_id: string;
  fahrer: FahrerPrognoseScore[];
  team_durchschnitt: number;
  alert_count: number;
  generiert_am: string;
}

const MOCK: PrognoseData = {
  location_id: 'mock',
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max Müller',   score: 88, trefferquote_pct: 88, bestellungen_geprueft: 28, trend: 'steigend', alert: false, rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Lisa Schmidt', score: 76, trefferquote_pct: 76, bestellungen_geprueft: 30, trend: 'stabil',   alert: false, rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Tom Wagner',   score: 63, trefferquote_pct: 63, bestellungen_geprueft: 25, trend: 'fallend',  alert: true,  rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Anna Becker',  score: 55, trefferquote_pct: 55, bestellungen_geprueft: 22, trend: 'fallend',  alert: true,  rang: 4 },
  ],
  team_durchschnitt: 70,
  alert_count: 2,
  generiert_am: new Date().toISOString(),
};

function tipp(score: number, trend: Trend): string {
  if (score >= 85) return '🏆 Exzellente ETA-Genauigkeit! Weiter so.';
  if (score >= 70) {
    if (trend === 'steigend') return '📈 Gute Entwicklung — du nährst dich der Top-Liga.';
    return '💡 Tipp: Plane 2–3 Min Puffer bei Stopp-Häufungen ein.';
  }
  if (trend === 'steigend') return '🔼 Du verbesserst dich — bleib dran!';
  return '⚠️ ETA-Genauigkeit verbessern: Frühzeitig Karte prüfen, Stau melden.';
}

function ScoreRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 80 ? '#22c55e' : score >= 70 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="68" height="68" viewBox="0 0 68 68">
      <circle cx="34" cy="34" r={r} fill="none" strokeWidth="5" stroke="#e2e8f0" />
      <circle
        cx="34" cy="34" r={r} fill="none" strokeWidth="5"
        stroke={color}
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeLinecap="round"
        transform="rotate(-90 34 34)"
      />
      <text x="34" y="38" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>{score}</text>
    </svg>
  );
}

export function FahrerPhase2004MeineEtaGenauigkeit({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [daten, setDaten] = useState<PrognoseData | null>(null);
  const [offen, setOffen] = useState(true);

  const laden = async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/prognose-zuverlaessigkeit?location_id=${locationId}`);
      if (!res.ok) { setDaten(MOCK); return; }
      setDaten(await res.json());
    } catch {
      setDaten(MOCK);
    }
  };

  useEffect(() => {
    if (!isOnline) return;
    laden();
    const id = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId, isOnline]);

  if (!isOnline) return null;

  const anzeige = daten ?? MOCK;
  const ich = anzeige.fahrer.find((f) => f.fahrer_id === driverId) ?? anzeige.fahrer[0];
  if (!ich) return null;

  const teamGesamt = anzeige.fahrer.length;
  const TrendIcon = ich.trend === 'steigend'
    ? <TrendingUp className="w-4 h-4 text-green-400" />
    : ich.trend === 'fallend'
      ? <TrendingDown className="w-4 h-4 text-red-400" />
      : <Minus className="w-4 h-4 text-slate-400" />;

  return (
    <section className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">Meine ETA-Genauigkeit</span>
          {ich.alert && (
            <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-bold">Verbesserung nötig</span>
          )}
        </div>
        {offen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {offen && (
        <div className="border-t border-slate-700/50 px-4 pb-4 space-y-3">
          <div className="flex items-center gap-4 pt-3">
            <ScoreRing score={ich.score} />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-white">{ich.trefferquote_pct}%</span>
                {TrendIcon}
              </div>
              <p className="text-[11px] text-slate-400">Treffer ±5 Min · {ich.bestellungen_geprueft} Bst.</p>
              <p className="text-[11px] text-slate-400">
                Rang <span className="font-bold text-white">#{ich.rang}</span> von {teamGesamt} · Team-Ø {anzeige.team_durchschnitt}%
              </p>
            </div>
          </div>

          <div className={cn(
            'rounded-xl px-3 py-2 text-xs font-medium',
            ich.score >= 80 ? 'bg-green-500/10 text-green-300' : ich.score >= 70 ? 'bg-amber-500/10 text-amber-300' : 'bg-red-500/10 text-red-300',
          )}>
            {tipp(ich.score, ich.trend)}
          </div>

          <p className="text-[9px] text-slate-500 text-right">
            {new Date(anzeige.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </section>
  );
}
