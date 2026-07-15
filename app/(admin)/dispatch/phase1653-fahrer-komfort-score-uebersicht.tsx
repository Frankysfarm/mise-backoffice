'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Activity, ChevronDown, ChevronUp, Coffee, Gauge, Route, TrendingDown, TrendingUp, Minus } from 'lucide-react';

/**
 * Phase 1653 — Fahrer-Komfort-Score-Übersicht (Dispatch)
 *
 * Phase1651-API: /api/delivery/driver/komfort-score-heute
 * Score je Fahrer heute als Tabelle (Pausen/km/Touren) +
 * Trend-Pfeile + Empfehlung. 30-Min-Polling.
 */

interface KomfortScore {
  driver_id: string;
  pausen_minuten: number;
  km_gesamt: number;
  tour_anzahl: number;
  komfort_score: number;
  empfehlung: 'pause' | 'weiter' | 'schicht_ende';
  generiert_am: string;
}

interface Props {
  locationId?: string | null;
  driverIds?: string[];
}

const MOCK_DRIVERS: Array<{ id: string; name: string }> = [
  { id: 'mock-1', name: 'Max M.' },
  { id: 'mock-2', name: 'Lisa K.' },
  { id: 'mock-3', name: 'Tom B.' },
  { id: 'mock-4', name: 'Sara N.' },
];

const MOCK_SCORES: KomfortScore[] = [
  { driver_id: 'mock-1', pausen_minuten: 45, km_gesamt: 52, tour_anzahl: 5, komfort_score: 78, empfehlung: 'weiter', generiert_am: new Date().toISOString() },
  { driver_id: 'mock-2', pausen_minuten: 20, km_gesamt: 88, tour_anzahl: 9, komfort_score: 42, empfehlung: 'pause', generiert_am: new Date().toISOString() },
  { driver_id: 'mock-3', pausen_minuten: 10, km_gesamt: 130, tour_anzahl: 12, komfort_score: 15, empfehlung: 'schicht_ende', generiert_am: new Date().toISOString() },
  { driver_id: 'mock-4', pausen_minuten: 35, km_gesamt: 40, tour_anzahl: 4, komfort_score: 82, empfehlung: 'weiter', generiert_am: new Date().toISOString() },
];

function scoreColor(score: number): string {
  if (score >= 70) return 'text-matcha-700 dark:text-matcha-300';
  if (score >= 45) return 'text-amber-700 dark:text-amber-300';
  return 'text-red-700 dark:text-red-300';
}

function scoreBarColor(score: number): string {
  if (score >= 70) return 'bg-matcha-500';
  if (score >= 45) return 'bg-amber-400';
  return 'bg-red-500';
}

function EmpfehlungBadge({ e }: { e: KomfortScore['empfehlung'] }) {
  const cfg = {
    weiter:      { label: 'Weiter',      cls: 'bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300 border-matcha-300' },
    pause:       { label: 'Pause',       cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300' },
    schicht_ende: { label: 'Schicht-Ende', cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300' },
  }[e];
  return <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', cfg.cls)}>{cfg.label}</span>;
}

export function DispatchPhase1653FahrerKomfortScoreUebersicht({ locationId, driverIds }: Props) {
  const [scores, setScores] = useState<KomfortScore[]>(MOCK_SCORES);
  const [open, setOpen] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const ids = driverIds?.length ? driverIds : MOCK_DRIVERS.map(d => d.id);

    async function load() {
      try {
        const results = await Promise.all(
          ids.map(id =>
            fetch(`/api/delivery/driver/komfort-score-heute?driver_id=${id}`)
              .then(r => r.ok ? r.json() as Promise<KomfortScore> : null)
              .catch(() => null)
          )
        );
        const valid = results.filter(Boolean) as KomfortScore[];
        if (valid.length > 0) {
          setScores(valid);
          setLastUpdate(new Date());
        }
      } catch {
        // keep mock
      }
    }

    load();
    const iv = setInterval(load, 30 * 60 * 1000); // 30 Min
    return () => clearInterval(iv);
  }, [driverIds]);

  const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, x) => s + x.komfort_score, 0) / scores.length) : 0;

  const driverName = (id: string) => MOCK_DRIVERS.find(d => d.id === id)?.name ?? id.slice(0, 6);

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Activity className="h-4 w-4 shrink-0 text-blue-500" />
        <span className="text-sm font-semibold flex-1 text-foreground">Fahrer-Komfort-Score</span>
        <span className={cn('text-xs font-bold', scoreColor(avgScore))}>⌀ {avgScore}/100</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {scores.map(s => (
            <div key={s.driver_id} className="rounded-lg border border-border bg-muted/20 p-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-foreground">{driverName(s.driver_id)}</span>
                <EmpfehlungBadge e={s.empfehlung} />
              </div>
              {/* Score-Balken */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', scoreBarColor(s.komfort_score))}
                    style={{ width: `${s.komfort_score}%` }}
                  />
                </div>
                <span className={cn('text-xs font-bold w-8 text-right', scoreColor(s.komfort_score))}>
                  {s.komfort_score}
                </span>
              </div>
              {/* Stats */}
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Coffee className="h-3 w-3" />{s.pausen_minuten} min
                </span>
                <span className="flex items-center gap-1">
                  <Route className="h-3 w-3" />{s.km_gesamt} km
                </span>
                <span className="flex items-center gap-1">
                  <Gauge className="h-3 w-3" />{s.tour_anzahl} Touren
                </span>
              </div>
            </div>
          ))}

          <div className="text-[10px] text-muted-foreground text-right">
            Aktualisiert: {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · alle 30 Min
          </div>
        </div>
      )}
    </div>
  );
}
