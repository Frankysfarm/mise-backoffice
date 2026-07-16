'use client';

import { useState, useEffect } from 'react';
import { Target, ChevronUp, ChevronDown, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
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

function ampelColor(score: number) {
  if (score >= 80) return { dot: 'bg-green-500', ring: 'stroke-green-500', text: 'text-green-700 dark:text-green-400' };
  if (score >= 70) return { dot: 'bg-amber-500', ring: 'stroke-amber-500', text: 'text-amber-700 dark:text-amber-400' };
  return { dot: 'bg-red-500', ring: 'stroke-red-500', text: 'text-red-600 dark:text-red-400' };
}

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === 'steigend') return <TrendingUp className="w-3 h-3 text-green-500" />;
  if (trend === 'fallend') return <TrendingDown className="w-3 h-3 text-red-500" />;
  return <Minus className="w-3 h-3 text-slate-400" />;
}

function ScoreRing({ score }: { score: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const c = ampelColor(score);
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-slate-200 dark:stroke-slate-600" />
      <circle
        cx="22" cy="22" r={r} fill="none" strokeWidth="4"
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
        className={c.ring}
      />
      <text x="22" y="26" textAnchor="middle" fontSize="9" fontWeight="bold" className="fill-slate-700 dark:fill-slate-200">
        {score}
      </text>
    </svg>
  );
}

export function DispatchPhase2003PrognoseGenauigkeitsDashboard({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
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
    laden();
    const id = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId) return null;

  const anzeige = daten ?? MOCK;

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-violet-500" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Prognose-Genauigkeit</span>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-mono">
            Ø {anzeige.team_durchschnitt}%
          </span>
          {anzeige.alert_count > 0 && (
            <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full font-bold">
              {anzeige.alert_count} Alert{anzeige.alert_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {offen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {offen && (
        <div className="border-t border-slate-100 dark:border-slate-700">
          {anzeige.alert_count > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                {anzeige.alert_count} Fahrer mit ETA-Genauigkeit unter 70% — Coaching empfohlen
              </p>
            </div>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {anzeige.fahrer.map((f) => {
              const c = ampelColor(f.score);
              return (
                <div key={f.fahrer_id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-[10px] font-bold text-slate-400 w-4 shrink-0">#{f.rang}</span>
                  <ScoreRing score={f.score} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div className={cn('w-2 h-2 rounded-full shrink-0', c.dot)} />
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{f.fahrer_name}</p>
                    </div>
                    <p className={cn('text-[10px] mt-0.5', c.text)}>
                      {f.trefferquote_pct}% Treffer · {f.bestellungen_geprueft} Bst.
                    </p>
                  </div>
                  <TrendIcon trend={f.trend} />
                </div>
              );
            })}
          </div>

          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700 text-[9px] text-slate-400 text-right">
            Aktualisiert: {new Date(anzeige.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}
    </div>
  );
}
