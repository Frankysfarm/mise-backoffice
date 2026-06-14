'use client';

/**
 * DispatchScoreExplainer — Detailierte Score-Aufschlüsselung
 *
 * Zeigt die 10 Scoring-Faktoren eines Fahrer-Bestell-Matches
 * als visuellen Balken mit Erklärung. Ergänzt OrderScoreGrid
 * (welche Fahrer passen) durch tiefes Why-Verständnis.
 *
 * Faktoren: Distanz, Auslastung, Fahrzeug, Erfahrung, Zone,
 * Prep-Zeit, Tageszeit, Priorität, Bundle-Fit, History
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  MapPin, Package, Bike, Star, Map, Clock, Sun, Zap, GitBranch, History,
  TrendingUp, ChevronDown, ChevronUp, AlertCircle, CheckCircle2,
} from 'lucide-react';

export interface ScoreBreakdown {
  total: number;
  f_distance: number;
  f_load: number;
  f_vehicle: number;
  f_experience: number;
  f_zone: number;
  f_prep_time: number;
  f_time_of_day: number;
  f_priority: number;
  f_bundle_fit: number;
  f_history: number;
}

interface Props {
  orderId?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  orderNr?: string | null;
  breakdown?: ScoreBreakdown | null;
  compact?: boolean;
}

const FACTORS: {
  key: keyof ScoreBreakdown;
  label: string;
  icon: React.ElementType;
  description: string;
  weight: number;
}[] = [
  { key: 'f_distance',    label: 'Distanz',     icon: MapPin,     description: 'Entfernung Fahrer → Restaurant → Kunde', weight: 25 },
  { key: 'f_load',        label: 'Auslastung',  icon: Package,    description: 'Aktuelle Kapazitätsauslastung des Fahrers', weight: 20 },
  { key: 'f_vehicle',     label: 'Fahrzeug',    icon: Bike,       description: 'Fahrzeugtyp passend zur Lieferdistanz', weight: 10 },
  { key: 'f_experience',  label: 'Erfahrung',   icon: Star,       description: 'Gesamtzahl Lieferungen des Fahrers', weight: 10 },
  { key: 'f_zone',        label: 'Zone',        icon: Map,        description: 'Zonenaffinität: Fahrer kennt diese Zone', weight: 10 },
  { key: 'f_prep_time',   label: 'Prep-Zeit',   icon: Clock,      description: 'Küchen-Timing passt zur Fahrerankuftzeit', weight: 10 },
  { key: 'f_time_of_day', label: 'Tageszeit',   icon: Sun,        description: 'Historische Performance zu dieser Uhrzeit', weight: 5 },
  { key: 'f_priority',    label: 'Priorität',   icon: Zap,        description: 'Bestellpriorität (Normal/Rush/VIP/Express)', weight: 5 },
  { key: 'f_bundle_fit',  label: 'Bundle-Fit',  icon: GitBranch,  description: 'Passt Bestellung zu anderen im Batch', weight: 10 },
  { key: 'f_history',     label: 'Historie',    icon: History,    description: 'Frühere Lieferungen an diese Adresse', weight: 5 },
];

function ScoreBar({ value, maxWidth = 100 }: { value: number; maxWidth?: number }) {
  const pct = Math.round((value / 100) * maxWidth);
  const color = value >= 75 ? 'bg-matcha-500' : value >= 50 ? 'bg-amber-400' : value >= 25 ? 'bg-orange-400' : 'bg-red-400';
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-matcha-100 text-matcha-800 border-matcha-300'
    : score >= 50 ? 'bg-amber-100 text-amber-800 border-amber-300'
    : score >= 25 ? 'bg-orange-100 text-orange-800 border-orange-300'
    : 'bg-red-100 text-red-800 border-red-300';
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-black tabular-nums', color)}>
      {Math.round(score)}
    </span>
  );
}

function useScoreBreakdown(orderId?: string | null, driverId?: string | null) {
  const [breakdown, setBreakdown] = useState<ScoreBreakdown | null>(null);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    if (!orderId || !driverId) return;
    setLoading(true);
    fetch(`/api/delivery/dispatch/score-detail?order_id=${orderId}&driver_id=${driverId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setBreakdown(d?.breakdown ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId, driverId]);

  return { breakdown, loading };
}

export function DispatchScoreExplainer({ orderId, driverId, driverName, orderNr, breakdown: propBreakdown, compact = false }: Props) {
  const [open, setOpen] = useState(!compact);
  const { breakdown: fetchedBreakdown, loading } = useScoreBreakdown(
    propBreakdown ? null : orderId,
    propBreakdown ? null : driverId,
  );
  const breakdown = propBreakdown ?? fetchedBreakdown;

  const topFactors  = breakdown
    ? FACTORS.filter(f => (breakdown[f.key] as number) >= 70).slice(0, 2)
    : [];
  const weakFactors = breakdown
    ? FACTORS.filter(f => (breakdown[f.key] as number) < 40).slice(0, 2)
    : [];

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', compact && 'text-sm')}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition text-left"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="font-bold text-sm">
            {driverName ? `Score: ${driverName}` : 'Score-Analyse'}
            {orderNr ? ` · #${orderNr}` : ''}
          </span>
          {breakdown && <ScorePill score={breakdown.total} />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-3 w-3 rounded-full bg-matcha-400 animate-pulse" />
              Score wird berechnet…
            </div>
          )}

          {!loading && !breakdown && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Bitte Fahrer und Bestellung auswählen.
            </div>
          )}

          {breakdown && (
            <>
              {/* Gesamt-Score */}
              <div className="flex items-center gap-4 rounded-xl bg-matcha-50 border border-matcha-200 p-3">
                <div className={cn(
                  'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl font-black text-2xl text-white',
                  breakdown.total >= 75 ? 'bg-matcha-600' :
                  breakdown.total >= 50 ? 'bg-amber-500' :
                  breakdown.total >= 25 ? 'bg-orange-500' : 'bg-red-500',
                )}>
                  {Math.round(breakdown.total)}
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-600">Gesamt-Score</div>
                  <ScoreBar value={breakdown.total} />
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    {topFactors.length > 0 && (
                      <span className="flex items-center gap-1 text-matcha-700">
                        <CheckCircle2 className="h-3 w-3" />
                        {topFactors.map(f => f.label).join(', ')}
                      </span>
                    )}
                    {weakFactors.length > 0 && (
                      <span className="flex items-center gap-1 text-red-600">
                        <AlertCircle className="h-3 w-3" />
                        {weakFactors.map(f => f.label).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Einzel-Faktoren */}
              <div className="space-y-2">
                {FACTORS.map(({ key, label, icon: Icon, description, weight }) => {
                  const val = breakdown[key] as number;
                  return (
                    <div key={key} className="grid grid-cols-[20px_1fr_100px_36px] items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <div className="text-xs font-semibold leading-none">{label}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{description}</div>
                      </div>
                      <ScoreBar value={val} />
                      <span className={cn(
                        'text-right text-xs font-black tabular-nums',
                        val >= 75 ? 'text-matcha-700' : val >= 50 ? 'text-amber-700' : val >= 25 ? 'text-orange-600' : 'text-red-600',
                      )}>
                        {Math.round(val)}
                        <span className="text-muted-foreground font-normal">/{weight}%</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* Mini-Score-Badge für inline-Verwendung in Bestellkarten */
export function ScoreInlineBadge({ score, factors }: { score: number; factors?: Partial<ScoreBreakdown> }) {
  const color = score >= 75 ? 'bg-matcha-100 text-matcha-800 border-matcha-200'
    : score >= 50 ? 'bg-amber-100 text-amber-800 border-amber-200'
    : score >= 25 ? 'bg-orange-100 text-orange-800 border-orange-200'
    : 'bg-red-100 text-red-800 border-red-200';

  const dotColor = score >= 75 ? 'bg-matcha-500' : score >= 50 ? 'bg-amber-500' : score >= 25 ? 'bg-orange-500' : 'bg-red-500';

  const weakest = factors
    ? FACTORS.filter(f => factors[f.key] !== undefined)
        .sort((a, b) => (factors[a.key] as number) - (factors[b.key] as number))[0]
    : null;

  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5', color)}>
      <span className={cn('h-2 w-2 rounded-full shrink-0', dotColor)} />
      <span className="font-black text-xs tabular-nums">{Math.round(score)}</span>
      {weakest && (
        <span className="text-[10px] opacity-70">· {weakest.label}↓</span>
      )}
    </div>
  );
}
