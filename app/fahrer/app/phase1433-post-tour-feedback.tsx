'use client';

import { useEffect, useRef, useState } from 'react';
import { Star, MessageSquare, CheckCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1433 — Post-Tour-Kurzfeedback (Fahrer-App)
 *
 * Erscheint nach Tour-Ende (batchId wechselt auf null oder neuen Wert):
 *   • 3 Fragen (Strecke / Kunden / Besonderheiten) mit 1–5 Sterne
 *   • POST /api/driver-app/tour-feedback
 *   • localStorage-Guard: einmal pro abgeschlossener Tour
 * isOnline-Guard. Nach Phase1428 in fahrer/app/client.tsx.
 */

interface Props {
  driverId: string | null;
  locationId: string | null;
  completedBatchId: string | null;
  isOnline: boolean;
}

const STORAGE_PREFIX = 'mise_post_feedback_';

const FRAGEN = [
  { id: 'strecke_sterne',        label: 'Streckenqualität',     hint: 'Wie war die Route?' },
  { id: 'kunden_sterne',         label: 'Kundenerfahrung',      hint: 'Wie liefen die Übergaben?' },
  { id: 'besonderheiten_sterne', label: 'Besonderheiten',       hint: 'Gab es Auffälligkeiten?' },
] as const;

type FrageId = typeof FRAGEN[number]['id'];

type Ratings = Record<FrageId, number>;

function StarRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5 transition-transform hover:scale-110"
          aria-label={`${s} Stern`}
        >
          <Star
            className={cn(
              'w-5 h-5 transition-colors',
              s <= (hover || value)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-transparent text-slate-300 dark:text-slate-600',
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function FahrerPhase1433PostTourFeedback({ driverId, locationId, completedBatchId, isOnline }: Props) {
  const [ratings, setRatings]     = useState<Ratings>({ strecke_sterne: 0, kunden_sterne: 0, besonderheiten_sterne: 0 });
  const [dismissed, setDismissed] = useState(false);
  const [sent, setSent]           = useState(false);
  const [sending, setSending]     = useState(false);
  const prevBatchRef              = useRef<string | null>(null);

  useEffect(() => {
    if (!completedBatchId) return;
    if (localStorage.getItem(STORAGE_PREFIX + completedBatchId) === '1') {
      setDismissed(true);
    }
  }, [completedBatchId]);

  // Reset when new completed batch arrives
  useEffect(() => {
    if (completedBatchId && completedBatchId !== prevBatchRef.current) {
      prevBatchRef.current = completedBatchId;
      const done = localStorage.getItem(STORAGE_PREFIX + completedBatchId) === '1';
      setDismissed(done);
      setSent(false);
      setRatings({ strecke_sterne: 0, kunden_sterne: 0, besonderheiten_sterne: 0 });
    }
  }, [completedBatchId]);

  if (!isOnline || !completedBatchId || !driverId || !locationId || dismissed) return null;

  const allRated = Object.values(ratings).every((v) => v > 0);

  async function handleSend() {
    if (!allRated || sending) return;
    setSending(true);
    try {
      await fetch('/api/driver-app/tour-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, batch_id: completedBatchId, location_id: locationId, ...ratings }),
      });
    } catch { /* silent — feedback not critical */ } finally {
      localStorage.setItem(STORAGE_PREFIX + completedBatchId!, '1');
      setSent(true);
      setSending(false);
      setTimeout(() => setDismissed(true), 1500);
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Feedback gespeichert — Danke!</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Tour-Feedback</span>
        </div>
        <button
          onClick={() => { localStorage.setItem(STORAGE_PREFIX + completedBatchId!, '1'); setDismissed(true); }}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          aria-label="Überspringen"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {FRAGEN.map((f) => (
          <div key={f.id} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 space-y-1.5">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{f.label}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">{f.hint}</p>
            </div>
            <StarRow
              value={ratings[f.id]}
              onChange={(v) => setRatings((prev) => ({ ...prev, [f.id]: v }))}
            />
          </div>
        ))}

        <button
          onClick={handleSend}
          disabled={!allRated || sending}
          className={cn(
            'w-full rounded-lg py-2.5 text-sm font-bold transition-colors',
            allRated && !sending
              ? 'bg-matcha-600 text-white hover:bg-matcha-700 dark:bg-matcha-500 dark:hover:bg-matcha-600'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed',
          )}
        >
          {sending ? 'Wird gespeichert …' : 'Feedback absenden'}
        </button>
      </div>
    </div>
  );
}
