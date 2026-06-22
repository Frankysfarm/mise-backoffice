'use client';

/**
 * SchichtZielOptimizer — Phase 400 Frontend
 *
 * Tabelle aller 7 Wochentage mit P75-Vorschlag, Konfidenz-Badge, Trend-Pfeil,
 * Approve/Decline-Buttons.
 * API: GET + POST /api/delivery/admin/schicht-ziel-optimizer
 */

import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, CheckCircle, XCircle, Target, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZielVorschlag {
  locationId:           string;
  dayOfWeek:            number;
  dayName:              string;
  suggestedUmsatz:      number;
  suggestedLieferungen: number;
  confidenceScore:      number;
  basedOnWeeks:         number;
  reasoning:            string;
  medianUmsatz:         number | null;
  p75Umsatz:            number | null;
  trendDirection:       'steigend' | 'stabil' | 'sinkend';
  status:               'pending' | 'approved' | 'declined';
  generatedAt:          string;
}

interface Props {
  locationId: string | null;
}

function confidenceLabel(score: number): { label: string; className: string } {
  if (score >= 0.75) return { label: 'Hoch',      className: 'bg-green-100 text-green-700' };
  if (score >= 0.5)  return { label: 'Mittel',     className: 'bg-amber-100 text-amber-700' };
  return              { label: 'Niedrig',    className: 'bg-red-100 text-red-600' };
}

function TrendIcon({ direction }: { direction: ZielVorschlag['trendDirection'] }) {
  if (direction === 'steigend') return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
  if (direction === 'sinkend')  return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function StatusBadge({ status }: { status: ZielVorschlag['status'] }) {
  if (status === 'approved') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-100 text-green-700 rounded-full px-2 py-0.5">
      <CheckCircle className="h-3 w-3" /> Genehmigt
    </span>
  );
  if (status === 'declined') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-600 rounded-full px-2 py-0.5">
      <XCircle className="h-3 w-3" /> Abgelehnt
    </span>
  );
  return (
    <span className="text-[10px] font-bold bg-stone-100 text-stone-500 rounded-full px-2 py-0.5">
      Offen
    </span>
  );
}

export function SchichtZielOptimizer({ locationId }: Props) {
  const [vorschlaege, setVorschlaege] = useState<ZielVorschlag[]>([]);
  const [loading, setLoading]         = useState(true);
  const [generating, setGenerating]   = useState(false);
  const [acting, setActing]           = useState<string | null>(null);
  const [expanded, setExpanded]       = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/schicht-ziel-optimizer?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        setVorschlaege(json.vorschlaege ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    if (!locationId) return;
    setGenerating(true);
    try {
      await fetch('/api/delivery/admin/schicht-ziel-optimizer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'generate', location_id: locationId }),
      });
      await load();
    } finally {
      setGenerating(false);
    }
  };

  const act = async (dayOfWeek: number, action: 'approve' | 'decline') => {
    if (!locationId) return;
    setActing(`${action}-${dayOfWeek}`);
    try {
      const res = await fetch('/api/delivery/admin/schicht-ziel-optimizer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, day_of_week: dayOfWeek, location_id: locationId }),
      });
      if (res.ok) {
        setVorschlaege(prev =>
          prev.map(v =>
            v.dayOfWeek === dayOfWeek
              ? { ...v, status: action === 'approve' ? 'approved' : 'declined' }
              : v,
          ),
        );
      }
    } finally {
      setActing(null);
    }
  };

  if (!locationId) return null;

  const pendingCount = vorschlaege.filter(v => v.status === 'pending').length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-stone-100">
        <Target className="h-4 w-4 text-matcha-600 shrink-0" />
        <div>
          <div className="text-sm font-bold text-foreground">Schicht-Ziel-Optimierer</div>
          {pendingCount > 0 && (
            <div className="text-[11px] text-amber-600 font-medium">{pendingCount} Vorschlag{pendingCount !== 1 ? 'e' : ''} offen</div>
          )}
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className={cn(
            'ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
            generating
              ? 'border-stone-200 text-muted-foreground cursor-not-allowed'
              : 'border-matcha-300 text-matcha-700 hover:bg-matcha-50',
          )}
        >
          <RefreshCw className={cn('h-3 w-3', generating && 'animate-spin')} />
          Neu generieren
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-5 space-y-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : vorschlaege.length === 0 ? (
        <div className="p-8 text-center">
          <Target className="h-8 w-8 text-stone-300 mx-auto mb-2" />
          <div className="text-sm text-muted-foreground">Noch keine Vorschläge generiert.</div>
          <div className="text-xs text-muted-foreground mt-1">
            Klicke auf „Neu generieren" um P75-Ziele aus historischen Daten zu berechnen.
          </div>
        </div>
      ) : (
        <div className="divide-y divide-stone-100">
          {vorschlaege.map(v => {
            const conf = confidenceLabel(v.confidenceScore);
            const isOpen = expanded === v.dayOfWeek;
            return (
              <div key={v.dayOfWeek} className="px-4 py-3">
                <button
                  onClick={() => setExpanded(isOpen ? null : v.dayOfWeek)}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Day */}
                    <span className="text-sm font-bold text-foreground w-24 shrink-0">{v.dayName}</span>

                    {/* Trend + P75 */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendIcon direction={v.trendDirection} />
                      <span className="font-semibold text-foreground">
                        {v.suggestedUmsatz.toFixed(0)} €
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span>{v.suggestedLieferungen} Lfg.</span>
                    </div>

                    {/* Confidence badge */}
                    <span className={cn('text-[10px] font-bold rounded-full px-2 py-0.5', conf.className)}>
                      {conf.label} ({Math.round(v.confidenceScore * 100)}%)
                    </span>

                    {/* Status */}
                    <div className="ml-auto">
                      <StatusBadge status={v.status} />
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="mt-2 space-y-2">
                    <div className="text-[11px] text-muted-foreground bg-stone-50 rounded-lg px-3 py-2">
                      {v.reasoning}
                    </div>
                    {v.medianUmsatz !== null && v.p75Umsatz !== null && (
                      <div className="flex gap-4 text-[11px] text-muted-foreground px-1">
                        <span>Median: <strong>{v.medianUmsatz.toFixed(0)} €</strong></span>
                        <span>P75: <strong>{v.p75Umsatz.toFixed(0)} €</strong></span>
                        <span>Basis: <strong>{v.basedOnWeeks} Wochen</strong></span>
                      </div>
                    )}

                    {v.status === 'pending' && (
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => act(v.dayOfWeek, 'approve')}
                          disabled={acting !== null}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                            acting === `approve-${v.dayOfWeek}`
                              ? 'bg-stone-100 text-muted-foreground cursor-not-allowed'
                              : 'bg-green-600 text-white hover:bg-green-700',
                          )}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Genehmigen
                        </button>
                        <button
                          onClick={() => act(v.dayOfWeek, 'decline')}
                          disabled={acting !== null}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                            acting === `decline-${v.dayOfWeek}`
                              ? 'bg-stone-100 text-muted-foreground cursor-not-allowed'
                              : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100',
                          )}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Ablehnen
                        </button>
                      </div>
                    )}
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
