'use client';

import { useMemo, useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { Bike, Clock, MapPin, Star, TrendingUp, CheckCircle2, AlertTriangle, Navigation } from 'lucide-react';

/**
 * Phase 2060 — Tour-Score-Visualisierungs-Kommando
 *
 * Zeigt alle aktiven Touren in einer kompakten Übersicht:
 * - Dispatch-Score (0–100) als farbiger Balken
 * - Tour-Fortschritt (Stops erledigt / gesamt)
 * - Fahrer-Name + Zone
 * - Echtzeit-ETA bis Tourenende
 * - Score-Kategorie: A/B/C/D mit Farbcodierung
 *
 * Neu: kombiniert Score-Board + Tour-Visualisierung in einem Panel,
 * sortiert nach Handlungsbedarf (niedrigster Score zuerst).
 */

type Stop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order?: {
    bestellnummer?: string;
    eta_earliest?: string | null;
    eta_latest?: string | null;
  } | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  started_at?: string | null;
  total_distance_km?: number | null;
  total_eta_min?: number | null;
  dispatch_score?: number | null;
  zone?: string | null;
  fahrer?: { vorname?: string; nachname?: string } | null;
  stops: Stop[];
};

type Driver = {
  id: string;
  vorname?: string;
  nachname?: string;
  employee_id?: string;
};

interface Props {
  batches: Batch[];
  drivers?: Driver[];
}

const ACTIVE_STATUSES = new Set(['unterwegs', 'on_route', 'dispatched', 'aktiv', 'in_progress']);

function scoreGrade(score: number): { grade: 'A' | 'B' | 'C' | 'D'; color: string; bg: string } {
  if (score >= 80) return { grade: 'A', color: 'text-matcha-700', bg: 'bg-matcha-100' };
  if (score >= 65) return { grade: 'B', color: 'text-blue-700', bg: 'bg-blue-50' };
  if (score >= 50) return { grade: 'C', color: 'text-amber-700', bg: 'bg-amber-50' };
  return { grade: 'D', color: 'text-red-700', bg: 'bg-red-50' };
}

function barColor(score: number): string {
  if (score >= 80) return 'bg-matcha-500';
  if (score >= 65) return 'bg-blue-400';
  if (score >= 50) return 'bg-amber-400';
  return 'bg-red-500';
}

function etaLabel(batch: Batch): string | null {
  const start = batch.startzeit ?? batch.started_at;
  if (!start || !batch.total_eta_min) return null;
  const endMs = new Date(start).getTime() + batch.total_eta_min * 60_000;
  const remainMin = Math.max(0, Math.floor((endMs - Date.now()) / 60_000));
  if (remainMin === 0) return 'Ankunft jetzt';
  return `~${remainMin} Min`;
}

export function DispatchPhase2060TourScoreVisualisierungsKommando({ batches, drivers = [] }: Props) {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(iv);
  }, []);

  const rows = useMemo(() => {
    const active = batches.filter((b) => ACTIVE_STATUSES.has(b.status));
    return active
      .map((b) => {
        const totalStops = b.stops.length;
        const doneStops = b.stops.filter((s) => !!s.geliefert_am).length;
        const progressPct = totalStops > 0 ? Math.round((doneStops / totalStops) * 100) : 0;
        const score = b.dispatch_score ?? null;

        const driver = b.fahrer ?? drivers.find(
          (d) => d.id === b.fahrer_id || d.employee_id === b.fahrer_id,
        );
        const name = driver
          ? `${driver.vorname ?? ''} ${(driver.nachname ?? '').charAt(0)}.`.trim()
          : 'Fahrer';

        const eta = etaLabel(b);
        const nextStop = b.stops.find((s) => !s.geliefert_am);

        return { batch: b, name, score, totalStops, doneStops, progressPct, eta, nextStop };
      })
      .sort((a, b) => {
        // Priorität: niedrige Scores zuerst, dann nach Fortschritt
        const sa = a.score ?? 100;
        const sb = b.score ?? 100;
        return sa - sb;
      });
  }, [batches, drivers, tick]);

  if (!rows.length) return null;

  const lowScore = rows.filter((r) => (r.score ?? 100) < 50).length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 transition border-b"
      >
        <TrendingUp className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">
          Tour-Score Visualisierung — {rows.length} aktiv
        </span>
        {lowScore > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">
            {lowScore} Note D
          </span>
        )}
        <span className="text-[10px] text-muted-foreground ml-1">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="divide-y">
          {rows.map(({ batch, name, score, totalStops, doneStops, progressPct, eta, nextStop }) => {
            const g = score !== null ? scoreGrade(score) : null;
            return (
              <div key={batch.id} className="px-4 py-3 space-y-2">
                {/* Header: Fahrer + Zone + Score */}
                <div className="flex items-center gap-2">
                  <Bike className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
                  <span className="text-xs font-bold truncate flex-1">{name}</span>
                  {batch.zone && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold">Zone {batch.zone}</span>
                  )}
                  {g && (
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', g.bg, g.color)}>
                      Note {g.grade} · {Math.round(score!)}
                    </span>
                  )}
                </div>

                {/* Score-Balken */}
                {score !== null && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', barColor(score))}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums text-muted-foreground w-8 text-right">
                      {Math.round(score)}
                    </span>
                  </div>
                )}

                {/* Tour-Fortschritt */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 flex-1">
                    <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-matcha-500 transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground font-bold">
                      {doneStops}/{totalStops} Stops
                    </span>
                  </div>

                  {eta && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      <span className="font-bold">{eta}</span>
                    </div>
                  )}
                </div>

                {/* Nächster Stop */}
                {nextStop?.order?.eta_latest && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Navigation className="h-3 w-3 shrink-0" />
                    <span>
                      #{(nextStop.order?.bestellnummer ?? '').replace('FF-', '')} —
                      ETA bis {new Date(nextStop.order.eta_latest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
