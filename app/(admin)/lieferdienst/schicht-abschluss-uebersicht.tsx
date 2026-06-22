'use client';

/**
 * SchichtAbschlussUebersicht — Phase 430
 *
 * Manager-Panel: Zeigt alle heutigen Schicht-Abschluss-Berichte mit Score,
 * Lieferungen, Pünktlichkeit und Verdienst je Fahrer.
 * Integration: lieferdienst/client.tsx nach SchichtBriefingUebersicht
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ClipboardCheck, RefreshCw, TrendingUp, TrendingDown,
  Minus, ChevronDown, ChevronUp, Trophy, Package, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Bericht {
  driverId:            string;
  driverName:          string | null;
  tourenAnzahl:        number;
  lieferungenGesamt:   number;
  puenktlichkeitsPct:  number | null;
  compositeScore:      number | null;
  scoreGrade:          string | null;
  deltaTeamSchnitt:    number | null;
  verdienstEur:        number | null;
}

interface Props {
  locationId: string | null;
}

function gradeStyle(grade: string | null) {
  switch (grade) {
    case 'A+': return 'bg-violet-100 text-violet-700';
    case 'A':  return 'bg-matcha-100 text-matcha-700';
    case 'B':  return 'bg-sky-100 text-sky-700';
    case 'C':  return 'bg-amber-100 text-amber-700';
    case 'D':  return 'bg-red-100 text-red-700';
    default:   return 'bg-stone-100 text-stone-500';
  }
}

function DeltaIcon({ delta }: { delta: number | null }) {
  if (delta === null) return <Minus className="h-3.5 w-3.5 text-stone-400" />;
  if (delta > 2) return <TrendingUp className="h-3.5 w-3.5 text-matcha-600" />;
  if (delta < -2) return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-stone-400" />;
}

export function SchichtAbschlussUebersicht({ locationId }: Props) {
  const [berichte, setBerichte] = useState<Bericht[]>([]);
  const [loading, setLoading]   = useState(false);
  const [open, setOpen]         = useState(false);

  const load = useCallback(() => {
    if (!locationId || !open) return;
    setLoading(true);
    fetch(`/api/delivery/admin/schicht-abschluss?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d) => setBerichte(d.berichte ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId, open]);

  useEffect(() => { load(); }, [load]);

  // 10-min polling when open
  useEffect(() => {
    if (!open) return;
    const id = setInterval(load, 10 * 60_000);
    return () => clearInterval(id);
  }, [open, load]);

  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!locationId) return;
    setGenerating(true);
    try {
      await fetch('/api/delivery/admin/schicht-abschluss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId }),
      });
      load();
    } finally {
      setGenerating(false);
    }
  };

  const topPerformer = berichte.length > 0
    ? berichte.reduce((best, b) =>
        (b.compositeScore ?? 0) > (best.compositeScore ?? 0) ? b : best,
      berichte[0])
    : null;

  const avgScore = berichte.length > 0
    ? berichte.reduce((s, b) => s + (b.compositeScore ?? 0), 0) / berichte.length
    : null;

  const totalDeliveries = berichte.reduce((s, b) => s + b.lieferungenGesamt, 0);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-5 py-4"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600 shrink-0">
          <ClipboardCheck className="h-4 w-4" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-char">Schicht-Abschlüsse</div>
          <div className="text-xs text-stone-400">
            {berichte.length > 0
              ? `${berichte.length} Fahrer · ${totalDeliveries} Lieferungen`
              : 'Heutige Abschlussberichte'}
          </div>
        </div>
        {avgScore !== null && (
          <span className="text-sm font-black text-stone-600 tabular-nums">
            Ø {Math.round(avgScore)}
          </span>
        )}
        {open
          ? <ChevronUp className="h-4 w-4 text-stone-400 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-stone-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-stone-100">
          {/* Summary KPIs */}
          {berichte.length > 0 && (
            <div className="grid grid-cols-3 divide-x divide-stone-100 border-b border-stone-100">
              <div className="px-4 py-3 text-center">
                <div className="text-lg font-black text-char tabular-nums">{berichte.length}</div>
                <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Fahrer</div>
              </div>
              <div className="px-4 py-3 text-center">
                <div className="text-lg font-black text-char tabular-nums">{totalDeliveries}</div>
                <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Lieferungen</div>
              </div>
              <div className="px-4 py-3 text-center">
                <div className={cn(
                  'text-lg font-black tabular-nums',
                  avgScore !== null && avgScore >= 75 ? 'text-matcha-700'
                  : avgScore !== null && avgScore >= 60 ? 'text-amber-700' : 'text-rose-700',
                )}>
                  {avgScore !== null ? Math.round(avgScore) : '—'}
                </div>
                <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Ø Score</div>
              </div>
            </div>
          )}

          {/* Top Performer */}
          {topPerformer && topPerformer.compositeScore !== null && topPerformer.compositeScore >= 75 && (
            <div className="flex items-center gap-2 bg-violet-50 px-5 py-3 border-b border-violet-100">
              <Trophy className="h-4 w-4 text-violet-600 shrink-0" />
              <span className="text-sm font-bold text-violet-700">
                {topPerformer.driverName ?? topPerformer.driverId.slice(-4)}
              </span>
              <span className="text-xs text-violet-500">
                — Bester Fahrer heute ({Math.round(topPerformer.compositeScore)} Punkte)
              </span>
            </div>
          )}

          {/* Driver List */}
          {loading ? (
            <div className="px-5 py-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-stone-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : berichte.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Package className="h-8 w-8 text-stone-300 mx-auto mb-2" />
              <div className="text-sm text-stone-500 mb-4">Noch keine Abschlussberichte für heute</div>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="rounded-xl bg-violet-600 text-white text-sm font-bold px-4 py-2 disabled:opacity-50"
              >
                {generating ? 'Generiere…' : 'Jetzt generieren'}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-stone-50">
              {berichte.map((b) => (
                <div key={b.driverId} className="flex items-center gap-3 px-5 py-3">
                  {/* Grade badge */}
                  {b.scoreGrade && (
                    <span className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-xs font-black shrink-0',
                      gradeStyle(b.scoreGrade),
                    )}>
                      {b.scoreGrade}
                    </span>
                  )}

                  {/* Name + deliveries */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-char truncate">
                      {b.driverName ?? b.driverId.slice(-8)}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-stone-500">
                      <span className="flex items-center gap-0.5">
                        <Package className="h-3 w-3" />
                        {b.lieferungenGesamt}
                      </span>
                      {b.puenktlichkeitsPct !== null && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {Math.round(b.puenktlichkeitsPct)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score + delta */}
                  <div className="text-right shrink-0">
                    {b.compositeScore !== null && (
                      <div className="text-sm font-black text-char tabular-nums">
                        {Math.round(b.compositeScore)}
                      </div>
                    )}
                    <DeltaIcon delta={b.deltaTeamSchnitt} />
                  </div>

                  {/* Verdienst */}
                  {b.verdienstEur !== null && (
                    <div className="text-right shrink-0 text-sm font-bold text-emerald-700 tabular-nums">
                      {b.verdienstEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="px-5 py-3 border-t border-stone-100 flex items-center justify-between">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-stone-500 font-semibold hover:text-stone-700 disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Aktualisieren
            </button>
            {berichte.length > 0 && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 text-xs text-violet-600 font-bold hover:text-violet-800 disabled:opacity-50"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                {generating ? 'Generiere…' : 'Neu berechnen'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
