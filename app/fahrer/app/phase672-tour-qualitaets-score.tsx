'use client';

import { useEffect, useState } from 'react';
import { Star, TrendingUp, Clock, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourFeedback {
  bewertung: number | null;
  kommentar: string | null;
}

interface ApiResponse {
  ok: boolean;
  touren_anzahl: number;
  gesamt_stopps: number;
  gesamt_km: number;
  lieferungen_pro_h: number;
  km_pro_tour: number;
  schicht_dauer_h: number;
  effizienz_score: number;
  stufe: 'top' | 'gut' | 'mittel' | 'niedrig';
}

interface FeedbackResponse {
  ok: boolean;
  bewertungen: TourFeedback[];
  avg_rating: number | null;
}

interface Props {
  driverId: string;
  locationId: string;
}

const STUFE_CONFIG = {
  top:     { label: 'Top-Fahrer', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/40' },
  gut:     { label: 'Guter Fahrer', color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-100 dark:bg-blue-900/40' },
  mittel:  { label: 'Mittel',  color: 'text-amber-600 dark:text-amber-500',  bg: 'bg-amber-100 dark:bg-amber-900/40' },
  niedrig: { label: 'Steigerungspotenzial', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
};

function ScoreRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;

  const color =
    score >= 80 ? '#22c55e' :
    score >= 60 ? '#3b82f6' :
    score >= 40 ? '#f59e0b' :
    '#94a3b8';

  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>
        {score}
      </text>
    </svg>
  );
}

export function FahrerPhase672TourQualitaetsScore({ driverId, locationId }: Props) {
  const [eff, setEff] = useState<ApiResponse | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  useEffect(() => {
    if (!driverId || !locationId) return;
    let active = true;

    async function load() {
      try {
        const [effRes, feedRes] = await Promise.all([
          fetch(`/api/delivery/admin/fahrer-touren-effizienz?location_id=${locationId}`, { cache: 'no-store' }),
          fetch(`/api/delivery/admin/tour-feedback-analytics?driver_id=${driverId}&limit=10`, { cache: 'no-store' }),
        ]);
        const effJson = await effRes.json();
        const feedJson: FeedbackResponse = await feedRes.json();
        if (active) {
          if (effJson.ok) {
            const me = (effJson.fahrer as ApiResponse[]).find(
              (f: ApiResponse & { driver_id?: string }) => (f as ApiResponse & { driver_id: string }).driver_id === driverId,
            );
            setEff(me ?? null);
          }
          if (feedJson.ok) setAvgRating(feedJson.avg_rating);
        }
      } catch {
        // silent
      }
    }

    load();
    const id = setInterval(load, 120_000);
    return () => { active = false; clearInterval(id); };
  }, [driverId, locationId]);

  if (!eff) return null;

  const cfg = STUFE_CONFIG[eff.stufe];

  // Gesamt-Qualitätsscore: Effizienz (70%) + Kundenbewertung (30%)
  const ratingScore = avgRating !== null ? Math.round((avgRating / 5) * 100) : null;
  const qualScore = ratingScore !== null
    ? Math.round(eff.effizienz_score * 0.7 + ratingScore * 0.3)
    : eff.effizienz_score;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <TrendingUp className="w-4 h-4 text-blue-500" />
        <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">
          Tour-Qualitäts-Score
        </span>
        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', cfg.color, cfg.bg)}>
          {cfg.label}
        </span>
      </div>

      <div className="flex items-center gap-6">
        <ScoreRing score={qualScore} />

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-slate-500">
              <Route className="w-3 h-3" /> Touren heute
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">{eff.touren_anzahl}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-slate-500">
              <Clock className="w-3 h-3" /> Lieferungen/h
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">{eff.lieferungen_pro_h}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-slate-500">
              <Star className="w-3 h-3" /> Ø Bewertung
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {avgRating !== null ? `${avgRating.toFixed(1)} / 5` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">km heute</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">{eff.gesamt_km} km</span>
          </div>
        </div>
      </div>

      {eff.stufe === 'niedrig' && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
          Tipp: Mehr Touren pro Stunde steigern deinen Score. Ziel: 8 Lieferungen/h.
        </p>
      )}
    </div>
  );
}
