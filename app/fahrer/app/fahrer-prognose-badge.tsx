'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Award } from 'lucide-react';

// ── Typen ─────────────────────────────────────────────────────────────────────

type PrognoseKategorie = 'elite' | 'gut' | 'durchschnitt' | 'auffällig';
type TrendDirection    = 'up' | 'stable' | 'down';

interface PrognoseDetail {
  prognoseScore:     number;
  kategorie:         PrognoseKategorie;
  punctualityScore:  number | null;
  deliveryTimeScore: number | null;
  stornoScore:       number | null;
  efficiencyScore:   number | null;
  toursAnalyzed:     number;
  trendDirection:    TrendDirection;
  computedAt:        string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const KATEGORIE_CONFIG: Record<PrognoseKategorie, { label: string; bg: string; text: string; border: string }> = {
  elite:        { label: 'Elite',        bg: 'bg-purple-900/30',  text: 'text-purple-300',  border: 'border-purple-600/40' },
  gut:          { label: 'Gut',          bg: 'bg-green-900/30',   text: 'text-green-300',   border: 'border-green-600/40' },
  durchschnitt: { label: 'Durchschnitt', bg: 'bg-blue-900/30',    text: 'text-blue-300',    border: 'border-blue-600/40' },
  auffällig:    { label: 'Auffällig',    bg: 'bg-red-900/30',     text: 'text-red-300',     border: 'border-red-600/40' },
};

function TrendIcon({ direction }: { direction: TrendDirection }) {
  if (direction === 'up')   return <TrendingUp   className="h-3.5 w-3.5 text-green-400" />;
  if (direction === 'down') return <TrendingDown  className="h-3.5 w-3.5 text-red-400"  />;
  return <Minus className="h-3.5 w-3.5 text-stone-500" />;
}

function MiniBar({ score, color }: { score: number | null; color: string }) {
  if (score == null) return <div className="h-1.5 bg-white/10 rounded-full" />;
  return (
    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, score)}%` }} />
    </div>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

export function FahrerPrognoseBadge({
  driverId,
  locationId,
}: {
  driverId:   string;
  locationId: string;
}) {
  const [detail,  setDetail]  = useState<PrognoseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [open,    setOpen]    = useState(false);

  useEffect(() => {
    if (!driverId || !locationId) return;
    setLoading(true);
    fetch(
      `/api/delivery/admin/fahrer-prognose?location_id=${encodeURIComponent(locationId)}&driver_id=${encodeURIComponent(driverId)}`,
    )
      .then(r => r.json())
      .then(d => { if (d.detail) setDetail(d.detail as PrognoseDetail); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [driverId, locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse">
        <div className="h-4 w-32 bg-white/10 rounded mb-2" />
        <div className="h-8 w-20 bg-white/10 rounded" />
      </div>
    );
  }

  if (!detail) return null;

  const cfg = KATEGORIE_CONFIG[detail.kategorie];

  return (
    <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-4`}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 text-left"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
          <Award className={`h-4 w-4 ${cfg.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-bold ${cfg.text}`}>Mein Performance-Score</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-2xl font-black tabular-nums ${cfg.text}`}>
              {Math.round(detail.prognoseScore)}
            </span>
            <span className="text-sm text-white/40">/100</span>
            <TrendIcon direction={detail.trendDirection} />
          </div>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
          {cfg.label}
        </span>
      </button>

      {/* Drill-Down */}
      {open && (
        <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
          <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-2">
            {detail.toursAnalyzed} Touren analysiert
          </div>
          {[
            { label: 'Pünktlichkeit',   score: detail.punctualityScore,  color: 'bg-green-400' },
            { label: 'Lieferzeit',      score: detail.deliveryTimeScore,  color: 'bg-blue-400'  },
            { label: 'Bewertung',       score: detail.stornoScore,        color: 'bg-amber-400' },
            { label: 'Stopp-Effizienz', score: detail.efficiencyScore,    color: 'bg-purple-400'},
          ].map(({ label, score, color }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-24 text-[10px] text-white/50 shrink-0">{label}</div>
              <div className="flex-1"><MiniBar score={score} color={color} /></div>
              <div className="w-8 text-right text-[10px] font-bold text-white/70 tabular-nums">
                {score != null ? Math.round(score) : '–'}
              </div>
            </div>
          ))}
          <div className="text-[9px] text-white/30 mt-2">
            Stand: {new Date(detail.computedAt).toLocaleDateString('de-DE')}
          </div>
        </div>
      )}
    </div>
  );
}
