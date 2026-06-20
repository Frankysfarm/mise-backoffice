'use client';

/**
 * FahrerStandortHealthBadge — Phase 347
 *
 * Zeigt dem Fahrer die Standort-Gesundheits-Note als motivierendes Badge.
 * Grüne Note = Filiale läuft super, roter Hinweis = Filiale braucht Unterstützung.
 *
 * API: GET /api/delivery/admin/location-health?location_id=...
 * Pollt einmalig beim Mount (5-Min-Intervall).
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Award, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface HealthSnapshot {
  overallScore: number;
  grade: string;
  trend: 'up' | 'stable' | 'down';
  scoreDelta: number;
}

interface HealthDashboard {
  latest: HealthSnapshot | null;
}

function gradeMeta(grade: string): { bg: string; border: string; label: string; emoji: string } {
  if (grade === 'A+') return { bg: 'bg-matcha-100', border: 'border-matcha-300', label: 'Exzellent', emoji: '🏆' };
  if (grade === 'A')  return { bg: 'bg-matcha-50',  border: 'border-matcha-200', label: 'Sehr gut',  emoji: '⭐' };
  if (grade === 'B+') return { bg: 'bg-amber-50',   border: 'border-amber-200',  label: 'Gut',        emoji: '👍' };
  if (grade === 'B')  return { bg: 'bg-amber-50',   border: 'border-amber-200',  label: 'Solide',     emoji: '👌' };
  if (grade === 'C')  return { bg: 'bg-orange-50',  border: 'border-orange-200', label: 'Ausbaufähig',emoji: '⚡' };
  return                      { bg: 'bg-red-50',    border: 'border-red-200',    label: 'Kritisch',   emoji: '🚨' };
}

function gradeTextColor(grade: string): string {
  if (grade === 'A+' || grade === 'A')  return 'text-matcha-700';
  if (grade === 'B+' || grade === 'B')  return 'text-amber-700';
  if (grade === 'C')                    return 'text-orange-700';
  return 'text-red-700';
}

export function FahrerStandortHealthBadge({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<HealthDashboard | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = () => {
      fetch(`/api/delivery/admin/location-health?location_id=${encodeURIComponent(locationId)}`, { cache: 'no-store' })
        .then((r) => r.ok ? r.json() : null)
        .then((d: HealthDashboard | null) => { if (!cancelled && d) setData(d); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!locationId || !data?.latest) return null;

  const snap = data.latest;
  const meta = gradeMeta(snap.grade);
  const textColor = gradeTextColor(snap.grade);
  const TrendIcon = snap.trend === 'up' ? TrendingUp : snap.trend === 'down' ? TrendingDown : Minus;
  const trendColor = snap.trend === 'up' ? 'text-matcha-600' : snap.trend === 'down' ? 'text-red-500' : 'text-stone-400';

  return (
    <div className={cn('rounded-xl border px-4 py-3 flex items-center gap-3', meta.bg, meta.border)}>
      <Award className={cn('h-5 w-5 shrink-0', textColor)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-stone-500">Deine Filiale heute</span>
          <span className={cn('text-sm font-black tabular-nums', textColor)}>
            {meta.emoji} Note {snap.grade}
          </span>
        </div>
        <div className={cn('text-[10px] font-semibold mt-0.5', textColor)}>{meta.label}</div>
      </div>
      <div className={cn('flex items-center gap-0.5 shrink-0', trendColor)}>
        <TrendIcon className="h-3.5 w-3.5" />
        {snap.scoreDelta !== 0 && (
          <span className="text-[10px] font-bold tabular-nums">
            {snap.scoreDelta > 0 ? '+' : ''}{Math.round(snap.scoreDelta)}
          </span>
        )}
      </div>
    </div>
  );
}
