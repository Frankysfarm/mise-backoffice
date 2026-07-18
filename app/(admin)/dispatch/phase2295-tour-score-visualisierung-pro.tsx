'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, Bike, ChevronDown, ChevronUp, MapPin, Star, Target, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type ScoreBand = 'top' | 'gut' | 'mittel' | 'schwach';

type FahrerScore = {
  fahrer_id: string;
  name: string;
  score: number;
  lieferungen: number;
  puenktlichkeit_pct: number;
  kundenbewertung: number;
  zone: string | null;
  aktiv: boolean;
  on_tour: boolean;
};

type TourVis = {
  batch_id: string;
  fahrer_name: string;
  zone: string | null;
  stopps_gesamt: number;
  stopps_erledigt: number;
  eta_min: number | null;
  health: 'ok' | 'tight' | 'late';
  score: number;
};

type LiveData = {
  fahrer: FahrerScore[];
  touren: TourVis[];
  avg_score: number;
  top_fahrer: string | null;
};

function scoreBand(score: number): ScoreBand {
  if (score >= 90) return 'top';
  if (score >= 75) return 'gut';
  if (score >= 55) return 'mittel';
  return 'schwach';
}

const BAND: Record<ScoreBand, { bg: string; text: string; bar: string; label: string }> = {
  top:    { bg: 'bg-matcha-50 dark:bg-matcha-950/20 border-matcha-200',  text: 'text-matcha-700 dark:text-matcha-300',  bar: 'bg-matcha-500',  label: '🏆 Top' },
  gut:    { bg: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200',        text: 'text-blue-700 dark:text-blue-300',        bar: 'bg-blue-500',    label: '⭐ Gut' },
  mittel: { bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200',     text: 'text-amber-700 dark:text-amber-300',      bar: 'bg-amber-400',   label: '→ Mittel' },
  schwach:{ bg: 'bg-red-50 dark:bg-red-950/20 border-red-200',           text: 'text-red-700 dark:text-red-300',          bar: 'bg-red-500',     label: '↓ Schwach' },
};

const HEALTH: Record<string, string> = {
  ok:    'bg-green-500',
  tight: 'bg-amber-400',
  late:  'bg-red-500',
};

function getMock(): LiveData {
  return {
    fahrer: [
      { fahrer_id: '1', name: 'Marc K.',    score: 94, lieferungen: 12, puenktlichkeit_pct: 97, kundenbewertung: 4.9, zone: 'Nord',  aktiv: true,  on_tour: true  },
      { fahrer_id: '2', name: 'Yara S.',    score: 88, lieferungen: 9,  puenktlichkeit_pct: 89, kundenbewertung: 4.7, zone: 'Süd',   aktiv: true,  on_tour: true  },
      { fahrer_id: '3', name: 'Tobias W.',  score: 71, lieferungen: 7,  puenktlichkeit_pct: 76, kundenbewertung: 4.4, zone: 'Mitte', aktiv: true,  on_tour: false },
      { fahrer_id: '4', name: 'Sandra L.',  score: 52, lieferungen: 4,  puenktlichkeit_pct: 61, kundenbewertung: 4.1, zone: 'West',  aktiv: true,  on_tour: true  },
    ],
    touren: [
      { batch_id: 'b1', fahrer_name: 'Marc K.',   zone: 'Nord',  stopps_gesamt: 4, stopps_erledigt: 2, eta_min: 8,  health: 'ok',    score: 94 },
      { batch_id: 'b2', fahrer_name: 'Yara S.',   zone: 'Süd',   stopps_gesamt: 3, stopps_erledigt: 1, eta_min: 14, health: 'tight', score: 88 },
      { batch_id: 'b3', fahrer_name: 'Sandra L.', zone: 'West',  stopps_gesamt: 2, stopps_erledigt: 0, eta_min: 22, health: 'late',  score: 52 },
    ],
    avg_score: 76.3,
    top_fahrer: 'Marc K.',
  };
}

function ScoreRing({ score }: { score: number }) {
  const band = scoreBand(score);
  const b = BAND[band];
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="relative flex h-12 w-12 items-center justify-center shrink-0">
      <svg className="absolute inset-0 -rotate-90" width="48" height="48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/20" />
        <circle
          cx="24" cy="24" r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          className={b.text}
        />
      </svg>
      <span className={cn('text-[11px] font-black tabular-nums', b.text)}>{score}</span>
    </div>
  );
}

function FahrerRow({ f }: { f: FahrerScore }) {
  const band = scoreBand(f.score);
  const b = BAND[band];
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border p-3', b.bg)}>
      <ScoreRing score={f.score} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold truncate">{f.name}</span>
          {f.on_tour && (
            <span className="text-[8px] font-bold rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5">
              Auf Tour
            </span>
          )}
          {f.zone && (
            <span className="text-[8px] text-muted-foreground rounded bg-muted/30 px-1 py-0.5">{f.zone}</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-[9px] text-muted-foreground">
          <span>{f.lieferungen} Lieferungen</span>
          <span className={cn('font-bold', b.text)}>{f.puenktlichkeit_pct}% pünktlich</span>
          <span className="flex items-center gap-0.5">
            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />{f.kundenbewertung.toFixed(1)}
          </span>
        </div>
        <div className="mt-1.5 h-1 rounded-full bg-muted/30 overflow-hidden">
          <div className={cn('h-full rounded-full', b.bar)} style={{ width: `${f.score}%` }} />
        </div>
      </div>
      <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5', b.text, 'bg-current/10 shrink-0')}>
        {b.label}
      </span>
    </div>
  );
}

function TourBar({ t }: { t: TourVis }) {
  const pct = t.stopps_gesamt > 0 ? (t.stopps_erledigt / t.stopps_gesamt) * 100 : 0;
  const band = scoreBand(t.score);
  const b = BAND[band];

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
      <div className={cn('h-8 w-1.5 rounded-full shrink-0', HEALTH[t.health])} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Bike className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-xs font-bold truncate">{t.fahrer_name}</span>
          {t.zone && <span className="text-[8px] text-muted-foreground">· {t.zone}</span>}
          <span className={cn('ml-auto text-[9px] font-black tabular-nums shrink-0', b.text)}>Score {t.score}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-700', b.bar)} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[9px] text-muted-foreground shrink-0 tabular-nums">
            {t.stopps_erledigt}/{t.stopps_gesamt}
          </span>
          {t.eta_min !== null && (
            <span className={cn('text-[9px] font-bold shrink-0 tabular-nums',
              t.health === 'late' ? 'text-red-600' : t.health === 'tight' ? 'text-amber-600' : 'text-matcha-600',
            )}>
              ~{t.eta_min}m
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function DispatchPhase2295TourScoreVisualisierungPro({ tenantId }: { tenantId?: string | null }) {
  const [data, setData] = useState<LiveData | null>(null);
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<'scores' | 'touren'>('touren');

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/delivery/dispatch?tenant_id=${tenantId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setData(getMock());
      }
    } catch {
      setData(getMock());
    }
  }, [tenantId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 25_000);
    return () => clearInterval(id);
  }, [load]);

  if (!tenantId) return null;

  const activeData = data ?? getMock();

  return (
    <div className="rounded-xl border bg-card p-4 mb-3 space-y-3">
      <button className="flex w-full items-center justify-between gap-2" onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/20">
            <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </span>
          <div className="text-left">
            <p className="text-sm font-bold leading-tight">Tour-Score Visualisierung Pro</p>
            <p className="text-[10px] text-muted-foreground">Score-Anzeige · Tour-Fortschritt · Echtzeit</p>
          </div>
          <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-[9px] font-bold text-blue-700 dark:text-blue-300 ml-1">
            Ø {activeData.avg_score.toFixed(0)}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <>
          {/* KPI-Strip */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/30 p-2 text-center">
              <p className="text-lg font-black tabular-nums text-foreground">{activeData.fahrer.filter(f => f.aktiv).length}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Aktiv</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-2 text-center">
              <p className="text-lg font-black tabular-nums text-blue-600 dark:text-blue-400">{activeData.avg_score.toFixed(0)}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Ø Score</p>
            </div>
            <div className="rounded-lg bg-matcha-50 dark:bg-matcha-950/20 p-2 text-center">
              <p className="text-[11px] font-black text-matcha-700 dark:text-matcha-300 truncate">{activeData.top_fahrer ?? '—'}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Top Fahrer</p>
            </div>
          </div>

          {/* Tab-Wechsler */}
          <div className="flex rounded-lg bg-muted/30 p-0.5 gap-0.5">
            {(['touren', 'scores'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 rounded-md py-1 text-[10px] font-bold transition-colors',
                  tab === t ? 'bg-white dark:bg-zinc-800 text-foreground shadow-sm' : 'text-muted-foreground',
                )}
              >
                {t === 'touren' ? '🗺 Tour-Ansicht' : '⭐ Score-Board'}
              </button>
            ))}
          </div>

          {tab === 'touren' && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Aktive Touren
              </p>
              {activeData.touren.map(t => <TourBar key={t.batch_id} t={t} />)}
              {activeData.touren.length === 0 && (
                <div className="rounded-lg bg-muted/20 py-4 text-center text-xs text-muted-foreground">
                  Keine aktiven Touren
                </div>
              )}
            </div>
          )}

          {tab === 'scores' && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Award className="h-3 w-3" /> Fahrer-Score Board
              </p>
              {activeData.fahrer.map(f => <FahrerRow key={f.fahrer_id} f={f} />)}
            </div>
          )}

          <div className="flex items-center gap-1.5 rounded-lg bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground">
            <TrendingUp className="h-3 w-3 shrink-0" />
            <span>Scores werden nach Pünktlichkeit, Kundenbewertung und Effizienz berechnet.</span>
          </div>
        </>
      )}
    </div>
  );
}
