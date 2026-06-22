'use client';

/**
 * SchichtAbschlussBericht — Phase 430
 *
 * Zeigt dem Fahrer seinen persönlichen Post-Shift-Bericht.
 * Sichtbar wenn Schicht heute beendet wurde (schicht_ende gesetzt).
 * Enthält: Score-Ring, Lieferungen, Pünktlichkeit, Verdienst,
 * Vergleich vs eigener Schnitt + Team, Highlights, Tipps.
 */

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Award, Package, Clock, Euro, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Bericht {
  tourenAnzahl:        number;
  lieferungenGesamt:   number;
  puenktlichkeitsPct:  number | null;
  avgDeliveryMin:      number | null;
  compositeScore:      number | null;
  scoreGrade:          string | null;
  deltaEigenerSchnitt: number | null;
  deltaTeamSchnitt:    number | null;
  topZone:             string | null;
  verdienstEur:        number | null;
  highlights:          string[];
  tipps:               string[];
  schichtEnde:         string | null;
}

interface Props {
  driverId:   string;
  locationId: string;
}

function gradeColor(grade: string | null) {
  switch (grade) {
    case 'A+': return 'text-violet-300';
    case 'A':  return 'text-matcha-300';
    case 'B':  return 'text-sky-300';
    case 'C':  return 'text-amber-300';
    case 'D':  return 'text-rose-400';
    default:   return 'text-stone-400';
  }
}

function DeltaBadge({ delta, label }: { delta: number | null; label: string }) {
  if (delta === null) return null;
  const positive = delta >= 0;
  return (
    <div className={cn(
      'flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold',
      positive ? 'bg-matcha-900/40 text-matcha-300' : 'bg-rose-900/40 text-rose-300',
    )}>
      {positive
        ? <TrendingUp className="h-3 w-3" />
        : delta === 0
        ? <Minus className="h-3 w-3" />
        : <TrendingDown className="h-3 w-3" />}
      {positive ? '+' : ''}{delta.toFixed(1)} {label}
    </div>
  );
}

export function SchichtAbschlussBericht({ locationId }: Props) {
  const [bericht, setBericht] = useState<Bericht | null>(null);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    fetch(`/api/delivery/driver/schicht-abschluss?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.bericht) setBericht(d.bericht);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  if (loading || !bericht) return null;

  // Nur anzeigen wenn Schicht heute schon beendet ist
  if (!bericht.schichtEnde) return null;
  const endedAt = new Date(bericht.schichtEnde);
  const hoursAgo = (Date.now() - endedAt.getTime()) / 3_600_000;
  if (hoursAgo > 12) return null; // Schicht länger als 12h vorbei → nicht mehr zeigen

  const score      = bericht.compositeScore;
  const grade      = bericht.scoreGrade;
  const scoreColor = gradeColor(grade);

  return (
    <div className="rounded-2xl border border-stone-700 bg-stone-900 overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-900/60 text-violet-300 shrink-0">
          <Award className="h-5 w-5" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-stone-100">Schicht-Abschluss</div>
          <div className="text-xs text-stone-400">Deine Leistung von heute</div>
        </div>
        {score !== null && (
          <span className={cn('text-lg font-black tabular-nums', scoreColor)}>
            {grade ?? Math.round(score)}
          </span>
        )}
        {open
          ? <ChevronUp className="h-4 w-4 text-stone-500 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-stone-500 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-stone-800 px-4 pb-4 space-y-4">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-2 pt-3">
            <div className="rounded-xl bg-stone-800/60 px-3 py-2">
              <div className="flex items-center gap-1 text-[10px] text-stone-400 font-semibold uppercase tracking-wide mb-0.5">
                <Package className="h-3 w-3" /> Lieferungen
              </div>
              <div className="text-xl font-black text-stone-100 tabular-nums">
                {bericht.lieferungenGesamt}
              </div>
              <div className="text-[10px] text-stone-500">{bericht.tourenAnzahl} Tour{bericht.tourenAnzahl !== 1 ? 'en' : ''}</div>
            </div>

            {bericht.puenktlichkeitsPct !== null && (
              <div className="rounded-xl bg-stone-800/60 px-3 py-2">
                <div className="flex items-center gap-1 text-[10px] text-stone-400 font-semibold uppercase tracking-wide mb-0.5">
                  <Clock className="h-3 w-3" /> Pünktlichkeit
                </div>
                <div className={cn(
                  'text-xl font-black tabular-nums',
                  bericht.puenktlichkeitsPct >= 85 ? 'text-matcha-300'
                  : bericht.puenktlichkeitsPct >= 70 ? 'text-amber-300' : 'text-rose-400',
                )}>
                  {Math.round(bericht.puenktlichkeitsPct)}%
                </div>
                {bericht.avgDeliveryMin !== null && (
                  <div className="text-[10px] text-stone-500">
                    Ø {Math.round(bericht.avgDeliveryMin)} Min
                  </div>
                )}
              </div>
            )}

            {score !== null && (
              <div className="rounded-xl bg-stone-800/60 px-3 py-2">
                <div className="flex items-center gap-1 text-[10px] text-stone-400 font-semibold uppercase tracking-wide mb-0.5">
                  <TrendingUp className="h-3 w-3" /> Score
                </div>
                <div className={cn('text-xl font-black tabular-nums', scoreColor)}>
                  {Math.round(score)}
                  {grade && <span className="text-sm ml-1">({grade})</span>}
                </div>
              </div>
            )}

            {bericht.verdienstEur !== null && (
              <div className="rounded-xl bg-stone-800/60 px-3 py-2">
                <div className="flex items-center gap-1 text-[10px] text-stone-400 font-semibold uppercase tracking-wide mb-0.5">
                  <Euro className="h-3 w-3" /> Verdienst
                </div>
                <div className="text-xl font-black text-emerald-300 tabular-nums">
                  {bericht.verdienstEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </div>
              </div>
            )}
          </div>

          {/* Vergleich */}
          {(bericht.deltaEigenerSchnitt !== null || bericht.deltaTeamSchnitt !== null) && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Vergleich</div>
              <div className="flex flex-wrap gap-2">
                <DeltaBadge delta={bericht.deltaEigenerSchnitt} label="vs. dein Schnitt" />
                <DeltaBadge delta={bericht.deltaTeamSchnitt} label="vs. Team" />
              </div>
            </div>
          )}

          {/* Top-Zone */}
          {bericht.topZone && (
            <div className="flex items-center gap-2 rounded-xl bg-matcha-900/30 px-3 py-2">
              <MapPin className="h-4 w-4 text-matcha-400 shrink-0" />
              <span className="text-sm text-stone-200 font-medium">
                Beste Zone heute: <span className="text-matcha-300 font-bold">{bericht.topZone}</span>
              </span>
            </div>
          )}

          {/* Highlights */}
          {bericht.highlights.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Highlights</div>
              <div className="space-y-1">
                {bericht.highlights.map((h, i) => (
                  <div key={i} className="text-sm text-stone-300 bg-stone-800/40 rounded-lg px-3 py-2">
                    {h}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tipps */}
          {bericht.tipps.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Für morgen</div>
              <div className="space-y-1">
                {bericht.tipps.map((t, i) => (
                  <div key={i} className="text-xs text-stone-400 bg-stone-800/30 rounded-lg px-3 py-2">
                    {t}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
