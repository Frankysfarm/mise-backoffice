'use client';

import { useState } from 'react';
import { CheckCircle2, Star, ThumbsUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1146 — Stopp-Qualitäts-Check (Fahrer-App)
// Schnelle Selbsteinschätzung nach jeder Lieferung: Übergabe, Freundlichkeit, Pünktlichkeit

interface Props {
  stopId: string;
  driverId: string;
  customerName?: string;
  onComplete?: (rating: StoppRating) => void;
  onDismiss?: () => void;
}

interface StoppRating {
  stopId: string;
  uebergabe: number;
  freundlichkeit: number;
  puenktlichkeit: number;
  notiz?: string;
  timestamp: string;
}

const CRITERIA = [
  { key: 'uebergabe' as const, label: 'Übergabe', hint: 'Paket vollständig & sicher übergeben?' },
  { key: 'freundlichkeit' as const, label: 'Freundlichkeit', hint: 'Freundlich zum Kunden?' },
  { key: 'puenktlichkeit' as const, label: 'Pünktlichkeit', hint: 'Im Zeitfenster geliefert?' },
];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5"
        >
          <Star
            className={cn(
              'h-6 w-6 transition-colors',
              s <= (hover || value)
                ? 'fill-amber-400 text-amber-400'
                : 'text-muted-foreground/30'
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function FahrerPhase1146StoppQualitaetsCheck({
  stopId,
  driverId,
  customerName,
  onComplete,
  onDismiss,
}: Props) {
  const [ratings, setRatings] = useState<Record<string, number>>({
    uebergabe: 0, freundlichkeit: 0, puenktlichkeit: 0,
  });
  const [notiz, setNotiz] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const allFilled = Object.values(ratings).every(v => v > 0);
  const avg = Object.values(ratings).reduce((s, v) => s + v, 0) / 3;

  async function submit() {
    if (!allFilled) return;
    setSaving(true);

    const payload: StoppRating = {
      stopId,
      uebergabe: ratings.uebergabe,
      freundlichkeit: ratings.freundlichkeit,
      puenktlichkeit: ratings.puenktlichkeit,
      notiz: notiz.trim() || undefined,
      timestamp: new Date().toISOString(),
    };

    try {
      await fetch('/api/delivery/driver/stopp-qualitaet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, ...payload }),
      });
    } catch {
      // Offline — best effort
    }

    setSubmitted(true);
    setSaving(false);
    onComplete?.(payload);
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-5 text-center space-y-2">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
        <p className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">Qualitäts-Check gespeichert!</p>
        <p className="text-[11px] text-muted-foreground">
          Dein Ø: <span className="font-black">{avg.toFixed(1)}</span> / 5 ⭐
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 overflow-hidden shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2">
          <ThumbsUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="font-bold text-sm text-amber-700 dark:text-amber-300">Stopp-Qualitäts-Check</span>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {customerName && (
          <p className="text-[11px] text-muted-foreground">
            Lieferung an <span className="font-bold text-foreground">{customerName}</span> abgeschlossen
          </p>
        )}

        {/* Kriterien */}
        <div className="space-y-3">
          {CRITERIA.map(({ key, label, hint }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[12px] font-bold text-foreground">{label}</span>
                {ratings[key] > 0 && (
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    {ratings[key]} / 5
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mb-1">{hint}</p>
              <StarRating
                value={ratings[key]}
                onChange={v => setRatings(r => ({ ...r, [key]: v }))}
              />
            </div>
          ))}
        </div>

        {/* Optionale Notiz */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Notiz (optional)
          </label>
          <textarea
            value={notiz}
            onChange={e => setNotiz(e.target.value)}
            placeholder="z. B. Klingel defekt, Kunde nicht erreichbar…"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px] resize-none focus:outline-none focus:ring-1 focus:ring-amber-400"
            rows={2}
          />
        </div>

        {/* Submit */}
        <button
          onClick={submit}
          disabled={!allFilled || saving}
          className={cn(
            'w-full rounded-xl py-3 font-bold text-sm transition',
            allFilled
              ? 'bg-amber-500 text-white hover:bg-amber-600 active:scale-95'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          {saving ? 'Speichern…' : 'Bewertung abschicken'}
        </button>

        {!allFilled && (
          <p className="text-center text-[10px] text-muted-foreground">
            Bitte alle 3 Kriterien bewerten
          </p>
        )}
      </div>
    </div>
  );
}
