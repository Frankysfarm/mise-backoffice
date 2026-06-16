'use client';

import React, { useEffect, useState } from 'react';
import { CalendarClock, ChevronRight, Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraftSummary {
  id: string;
  shiftsProposed: number;
  gapsFound: number;
  coverageBefore: number;
  coverageAfter: number;
  earliestDate: string | null;
  latestDate: string | null;
  createdAt: string;
}

export function SchichtAutoDraftStrip({ locationId }: { locationId: string | null }) {
  const [draft, setDraft] = useState<DraftSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!locationId || dismissed) return;
    setLoading(true);
    const params = new URLSearchParams({ action: 'dashboard' });
    params.set('location_id', locationId);
    fetch(`/api/delivery/admin/auto-shift-generator?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.pendingDraftId && d?.recentDrafts?.length > 0) {
          const pending = d.recentDrafts.find((dr: { id: string; status: string }) => dr.id === d.pendingDraftId);
          if (pending) {
            setDraft({
              id: pending.id,
              shiftsProposed: pending.shiftsProposed ?? 0,
              gapsFound: pending.gapsFound ?? 0,
              coverageBefore: pending.coverageBefore ?? 0,
              coverageAfter: pending.coverageAfter ?? 0,
              earliestDate: pending.earliestDate ?? null,
              latestDate: pending.latestDate ?? null,
              createdAt: pending.createdAt,
            });
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId, dismissed]);

  if (!locationId || dismissed || (!loading && !draft)) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
        <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin shrink-0" />
        <span className="text-xs text-amber-700">Lade Schicht-Entwurf…</span>
      </div>
    );
  }

  if (!draft) return null;

  const dateRange = draft.earliestDate && draft.latestDate
    ? draft.earliestDate === draft.latestDate
      ? new Date(draft.earliestDate).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
      : `${new Date(draft.earliestDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${new Date(draft.latestDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}`
    : null;

  const coverageGain = Math.round(draft.coverageAfter - draft.coverageBefore);

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      {/* Icon */}
      <div className="shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
        <CalendarClock className="h-4 w-4 text-amber-600" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-amber-900">Schicht-Entwurf wartet auf Freigabe</span>
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-400 hover:text-amber-600 text-xs"
            aria-label="Ausblenden"
          >
            ×
          </button>
        </div>

        <p className="text-[11px] text-amber-700 mt-0.5">
          {draft.shiftsProposed} Schicht{draft.shiftsProposed !== 1 ? 'en' : ''} vorgeschlagen
          {dateRange ? ` · ${dateRange}` : ''}
          {coverageGain > 0 ? ` · +${coverageGain}% Abdeckung` : ''}
        </p>

        <div className="mt-2 flex items-center gap-3">
          <div className="flex items-center gap-1 text-[10px] text-amber-600">
            <Users className="h-3 w-3" />
            <span>{draft.gapsFound} Lücken erkannt</span>
          </div>

          <a
            href="/delivery/auto-shift-generator"
            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-1 text-[11px] font-bold text-white transition-colors"
          >
            Jetzt prüfen
            <ChevronRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
