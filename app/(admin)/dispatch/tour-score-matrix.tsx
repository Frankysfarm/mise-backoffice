'use client';

/**
 * DispatchTourScoreMatrix
 * Matrix-Ansicht aller aktiven Touren mit berechnetem Gesundheitsscore (0–100).
 * Zeigt pro Tour: Fahrer, Stopp-Fortschritt, Zone, verstrichene Zeit vs. ETA,
 * und einen farbkodierten Score-Balken.
 *
 * Score-Berechnung (0–100):
 *   - Pünktlichkeitsrate der erledigten Stopps (0–40 Punkte)
 *   - Fertigstellungsrate relativ zur abgelaufenen ETA (0–40 Punkte)
 *   - Geschwindigkeit/Effizienz (Distanz/Stopps) (0–20 Punkte)
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  BarChart2,
  CheckCircle2,
  Clock,
  MapPin,
  AlertTriangle,
  Gauge,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

// ─── Typen ───────────────────────────────────────────────────────────────────

type BatchStop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    eta_earliest: string | null;
  } | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit: string | null;
  total_eta_min: number | null;
  total_distance_km: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: Array<{
    id: string;
    reihenfolge: number;
    geliefert_am: string | null;
    order: {
      bestellnummer: string;
      kunde_name: string;
      eta_earliest: string | null;
    } | null;
  }>;
};

type ScoreGrade = 'gut' | 'mittel' | 'kritisch';

interface TourRow {
  batch: Batch;
  driverName: string;
  totalStops: number;
  completedStops: number;
  progressPct: number;
  elapsedMin: number;
  etaTotalMin: number | null;
  etaRemainMin: number | null;
  etaUsedPct: number | null;
  isLate: boolean;
  health: number;
  grade: ScoreGrade;
  onTimePct: number | null;
}

// ─── Konstanten ───────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set(['unterwegs', 'on_route', 'aktiv', 'assigned']);

const GRADE_CONFIG: Record<
  ScoreGrade,
  {
    rowBg: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    barColor: string;
    label: string;
    icon: React.ElementType;
  }
> = {
  gut: {
    rowBg: 'bg-matcha-50/60',
    border: 'border-matcha-200/60',
    badgeBg: 'bg-matcha-100',
    badgeText: 'text-matcha-700',
    barColor: 'bg-matcha-500',
    label: 'Gut',
    icon: TrendingUp,
  },
  mittel: {
    rowBg: 'bg-amber-50/60',
    border: 'border-amber-200/60',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    barColor: 'bg-amber-500',
    label: 'Mittel',
    icon: Minus,
  },
  kritisch: {
    rowBg: 'bg-red-50/60',
    border: 'border-red-200/60',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
    barColor: 'bg-red-500',
    label: 'Kritisch',
    icon: TrendingDown,
  },
};

// ─── Tick-Hook (30s für Countdown-Updates) ───────────────────────────────────

function useTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);
}

// ─── Score-Berechnung ─────────────────────────────────────────────────────────

/**
 * Berechnet den Tour-Gesundheitsscore (0–100) aus drei Dimensionen:
 * 1. Pünktlichkeitsrate der erledigten Stopps    → 0–40 Punkte
 * 2. Fortschrittsrate vs. verstrichene ETA-Zeit  → 0–40 Punkte
 * 3. Effizienz (Distanz / Stopp-Anzahl-Relation) → 0–20 Punkte
 */
function computeHealthScore(batch: Batch, now: number): number {
  const stops = [...batch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const total = stops.length;
  const completed = stops.filter((s) => s.geliefert_am != null);

  if (total === 0) return 50;

  // 1. Pünktlichkeit: wie viele erledigte Stopps waren rechtzeitig?
  const onTimeCount = completed.filter((s) => {
    if (!s.geliefert_am || !s.order?.eta_earliest) return true; // bei fehlenden Daten: neutral
    return new Date(s.geliefert_am).getTime() <= new Date(s.order.eta_earliest).getTime();
  }).length;
  const onTimePct = completed.length > 0 ? onTimeCount / completed.length : 0.8;
  const onTimeScore = onTimePct * 40;

  // 2. Fortschritt vs. Zeit: Fortschrittsrate sollte ≥ Zeitverbrauchsrate sein
  const elapsedMs = batch.startzeit ? now - new Date(batch.startzeit).getTime() : 0;
  const elapsedMin = elapsedMs / 60_000;
  const etaTotal = batch.total_eta_min;
  let progressScore = 20; // Startwert für unbekannte ETA
  if (etaTotal && etaTotal > 0 && elapsedMin > 0) {
    const timeUsedRatio = Math.min(elapsedMin / etaTotal, 2);
    const completionRatio = total > 0 ? completed.length / total : 0;
    const delta = completionRatio - timeUsedRatio; // positiv = ahead of schedule
    if (delta >= 0)       progressScore = 40;
    else if (delta >= -0.1) progressScore = 32;
    else if (delta >= -0.2) progressScore = 22;
    else if (delta >= -0.35) progressScore = 12;
    else progressScore = 0;
  }

  // 3. Effizienz: Distanz pro Stopp (niedrig = effizient)
  let efficiencyScore = 10; // Startwert ohne Distanz-Daten
  if (batch.total_distance_km != null && total > 0) {
    const kmPerStop = batch.total_distance_km / total;
    if (kmPerStop <= 1.5)      efficiencyScore = 20;
    else if (kmPerStop <= 2.5) efficiencyScore = 15;
    else if (kmPerStop <= 4)   efficiencyScore = 10;
    else                       efficiencyScore = 5;
  }

  return Math.min(100, Math.round(onTimeScore + progressScore + efficiencyScore));
}

function scoreToGrade(score: number): ScoreGrade {
  if (score >= 80) return 'gut';
  if (score >= 60) return 'mittel';
  return 'kritisch';
}

// ─── Datenvorbereitung ────────────────────────────────────────────────────────

function buildTourRows(batches: Batch[], now: number): TourRow[] {
  return batches
    .filter((b) => ACTIVE_STATUSES.has(b.status))
    .map((batch) => {
      const stops = [...batch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
      const totalStops = stops.length;
      const completedStops = stops.filter((s) => s.geliefert_am != null).length;
      const progressPct = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;

      const elapsedMs  = batch.startzeit ? now - new Date(batch.startzeit).getTime() : 0;
      const elapsedMin = Math.floor(elapsedMs / 60_000);
      const etaTotalMin = batch.total_eta_min ?? null;
      const etaRemainMin = etaTotalMin != null ? Math.max(0, etaTotalMin - elapsedMin) : null;
      const etaUsedPct  = etaTotalMin && etaTotalMin > 0
        ? Math.min(100, (elapsedMin / etaTotalMin) * 100)
        : null;
      const isLate = etaTotalMin != null && elapsedMin > etaTotalMin * 1.05;

      const completedStopsList = stops.filter((s) => s.geliefert_am != null);
      const onTimeCount = completedStopsList.filter((s) => {
        if (!s.geliefert_am || !s.order?.eta_earliest) return true;
        return new Date(s.geliefert_am).getTime() <= new Date(s.order.eta_earliest).getTime();
      }).length;
      const onTimePct = completedStopsList.length > 0
        ? Math.round((onTimeCount / completedStopsList.length) * 100)
        : null;

      const health = computeHealthScore(batch, now);
      const grade  = scoreToGrade(health);

      const driverName = batch.fahrer
        ? `${batch.fahrer.vorname} ${batch.fahrer.nachname[0]}.`
        : 'Fahrer?';

      return {
        batch,
        driverName,
        totalStops,
        completedStops,
        progressPct,
        elapsedMin,
        etaTotalMin,
        etaRemainMin,
        etaUsedPct,
        isLate,
        health,
        grade,
        onTimePct,
      };
    })
    .sort((a, b) => a.health - b.health); // schlechteste Tours zuerst
}

// ─── Score-Anzeige-Komponente ─────────────────────────────────────────────────

function ScoreBadge({ score, grade }: { score: number; grade: ScoreGrade }) {
  const cfg = GRADE_CONFIG[grade];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums shrink-0',
        cfg.badgeBg,
        cfg.badgeText,
      )}
    >
      <Gauge className="h-3 w-3 shrink-0" />
      {score}
    </span>
  );
}

// ─── Stopp-Miniaturansicht ────────────────────────────────────────────────────

function StopDots({ stops }: { stops: BatchStop[] }) {
  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {sorted.map((stop) => (
        <span
          key={stop.id}
          title={stop.order ? `#${stop.order.bestellnummer} – ${stop.order.kunde_name}` : `Stopp ${stop.reihenfolge}`}
          className={cn(
            'h-2 w-2 rounded-full inline-block shrink-0 transition-colors duration-300',
            stop.geliefert_am ? 'bg-matcha-500' : 'bg-muted-foreground/30 border border-muted-foreground/40',
          )}
        />
      ))}
    </div>
  );
}

// ─── Einzel-Tour-Zeile ────────────────────────────────────────────────────────

function TourScoreRow({ row }: { row: TourRow }) {
  const cfg = GRADE_CONFIG[row.grade];
  const GradeIcon = cfg.icon;

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 space-y-2 transition-all duration-300',
        cfg.rowBg,
        cfg.border,
      )}
    >
      {/* Zeile 1: Fahrer + Score + Zone + ETA */}
      <div className="flex items-center gap-2 flex-wrap">
        <ScoreBadge score={row.health} grade={row.grade} />

        <span className="text-xs font-bold text-foreground flex-1 min-w-0 truncate">
          {row.driverName}
        </span>

        {row.batch.zone && (
          <span className="flex items-center gap-0.5 text-[9px] font-bold border border-border/60 rounded px-1.5 py-0.5 text-muted-foreground shrink-0">
            <MapPin className="h-2.5 w-2.5" />
            {row.batch.zone}
          </span>
        )}

        {row.isLate ? (
          <span className="flex items-center gap-0.5 text-[10px] font-black text-red-600 shrink-0 animate-pulse">
            <AlertTriangle className="h-3 w-3" />
            Verspätet
          </span>
        ) : row.etaRemainMin != null ? (
          <span className="flex items-center gap-0.5 text-[10px] font-bold tabular-nums text-muted-foreground shrink-0">
            <Clock className="h-3 w-3" />
            noch&nbsp;{row.etaRemainMin}&nbsp;Min
          </span>
        ) : null}
      </div>

      {/* Zeile 2: Stopp-Fortschritt + Kenndaten */}
      <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
        <span className="flex items-center gap-0.5 font-bold">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          {row.completedStops}/{row.totalStops}&nbsp;Stopps
        </span>
        {row.elapsedMin > 0 && (
          <span className="flex items-center gap-0.5">
            <Clock className="h-3 w-3 shrink-0" />
            {row.elapsedMin}&nbsp;Min&nbsp;unterwegs
          </span>
        )}
        {row.batch.total_distance_km != null && (
          <span className="flex items-center gap-0.5">
            <MapPin className="h-3 w-3 shrink-0" />
            {row.batch.total_distance_km.toFixed(1)}&nbsp;km
          </span>
        )}
        {row.onTimePct != null && row.completedStops > 0 && (
          <span
            className={cn(
              'flex items-center gap-0.5 font-bold',
              row.onTimePct >= 80 ? 'text-matcha-600' :
              row.onTimePct >= 60 ? 'text-amber-600' : 'text-red-600',
            )}
          >
            <GradeIcon className="h-3 w-3 shrink-0" />
            {row.onTimePct}&nbsp;% pünktlich
          </span>
        )}
      </div>

      {/* Zeile 3: Stopp-Punkte + Fortschrittsbalken */}
      <div className="space-y-1">
        <StopDots stops={row.batch.stops} />
        <div className="relative h-2 rounded-full bg-black/10 overflow-hidden">
          {/* Fortschrittsbalken (Stopps) */}
          <div
            className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-700', cfg.barColor)}
            style={{ width: `${row.progressPct}%` }}
          />
          {/* ETA-Marker: wie viel Zeit ist vergangen */}
          {row.etaUsedPct != null && (
            <div
              className="absolute inset-y-0 w-0.5 bg-black/30 rounded-full"
              style={{ left: `${Math.min(99, row.etaUsedPct)}%` }}
              title={`${Math.round(row.etaUsedPct)}% der ETA-Zeit verbraucht`}
            />
          )}
        </div>
        {row.etaUsedPct != null && (
          <div className="flex justify-between text-[8px] text-muted-foreground">
            <span>{Math.round(row.progressPct)}% Stopps erledigt</span>
            <span>{Math.round(row.etaUsedPct)}% ETA-Zeit verbraucht</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export function DispatchTourScoreMatrix({ batches }: { batches: Batch[] }) {
  useTick();

  const now  = Date.now();
  const rows = buildTourRows(batches, now);

  if (rows.length === 0) return null;

  // Zusammenfassungs-Statistiken
  const gutCount      = rows.filter((r) => r.grade === 'gut').length;
  const mittelCount   = rows.filter((r) => r.grade === 'mittel').length;
  const kritischCount = rows.filter((r) => r.grade === 'kritisch').length;
  const avgScore      = Math.round(rows.reduce((s, r) => s + r.health, 0) / rows.length);
  const avgGrade      = scoreToGrade(avgScore);
  const avgCfg        = GRADE_CONFIG[avgGrade];

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-muted/20 flex-wrap">
        <BarChart2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-foreground/80">
          Tour-Score-Matrix
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {rows.length}&nbsp;{rows.length === 1 ? 'Tour' : 'Touren'}&nbsp;aktiv
        </span>

        {/* Durchschnittsscore */}
        <span
          className={cn(
            'ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black',
            avgCfg.badgeBg,
            avgCfg.badgeText,
          )}
        >
          <Gauge className="h-3 w-3" />
          Ø&nbsp;{avgScore}&nbsp;–&nbsp;{avgCfg.label}
        </span>
      </div>

      {/* ── Status-Zusammenfassung ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/10 flex-wrap">
        {gutCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-black">
            <TrendingUp className="h-3 w-3" />
            {gutCount}&nbsp;Gut
          </span>
        )}
        {mittelCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-black">
            <Minus className="h-3 w-3" />
            {mittelCount}&nbsp;Mittel
          </span>
        )}
        {kritischCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-black animate-pulse">
            <AlertTriangle className="h-3 w-3" />
            {kritischCount}&nbsp;Kritisch
          </span>
        )}
        <span className="ml-auto text-[9px] text-muted-foreground">
          Aktualisiert alle 30s
        </span>
      </div>

      {/* ── Tour-Zeilen ── */}
      <div className="p-3 space-y-2">
        {rows.map((row) => (
          <TourScoreRow key={row.batch.id} row={row} />
        ))}
      </div>

      {/* ── Legende ── */}
      <div className="flex items-center gap-3 px-3 pb-3 border-t border-border/40 pt-2 flex-wrap">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Score:</span>
        <span className="flex items-center gap-1 text-[9px] text-matcha-600">
          <span className="h-1.5 w-1.5 rounded-full bg-matcha-500 inline-block" />
          ≥ 80 Gut
        </span>
        <span className="flex items-center gap-1 text-[9px] text-amber-600">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
          60–79 Mittel
        </span>
        <span className="flex items-center gap-1 text-[9px] text-red-600">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
          &lt; 60 Kritisch
        </span>
        <span className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-matcha-500 inline-block" /> Geliefert
          <span className="h-2 w-2 rounded-full bg-muted-foreground/30 border border-muted-foreground/40 inline-block ml-1" /> Ausstehend
        </span>
      </div>
    </div>
  );
}
