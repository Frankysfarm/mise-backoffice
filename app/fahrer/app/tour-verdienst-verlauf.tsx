'use client';

import React, { useMemo } from 'react';
import { Euro, TrendingUp, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  stops: {
    id: string;
    adresse?: string;
    geliefert_am?: string | null;
    trinkgeld?: number;
  }[];
  basisEinkommen?: number;
  zielEinkommen?: number;
}

export function FahrerTourVerdienstVerlauf({ stops, basisEinkommen = 2.5, zielEinkommen = 50 }: Props) {
  const { completed, cumulative, total, progress } = useMemo(() => {
    const done = stops.filter((s) => s.geliefert_am);
    const cumulative: number[] = [];
    let running = 0;
    for (const s of done) {
      running += basisEinkommen + (s.trinkgeld ?? 0);
      cumulative.push(running);
    }
    const total = running;
    const progress = Math.min(100, Math.round((total / zielEinkommen) * 100));
    return { completed: done, cumulative, total, progress };
  }, [stops, basisEinkommen, zielEinkommen]);

  const sparkline = useMemo(() => {
    if (cumulative.length < 2) return null;
    const W = 120; const H = 32;
    const max = Math.max(...cumulative, zielEinkommen);
    const pts = cumulative.map((v, i) => {
      const x = (i / (cumulative.length - 1)) * W;
      const y = H - (v / max) * H;
      return `${x},${y}`;
    });
    return pts.join(' ');
  }, [cumulative, zielEinkommen]);

  return (
    <div className="rounded-xl border border-matcha-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Euro className="h-4 w-4 text-matcha-600" />
        <span className="text-sm font-semibold text-matcha-900">Verdienst-Verlauf</span>
        <span className="ml-auto flex items-center gap-1 text-xs text-matcha-600">
          <TrendingUp className="h-3 w-3" />
          {completed.length} Stopps
        </span>
      </div>

      {sparkline && (
        <div className="mb-3 overflow-hidden rounded bg-matcha-50 p-2">
          <svg viewBox="0 0 120 32" className="h-8 w-full" preserveAspectRatio="none">
            <polyline points={sparkline} fill="none" stroke="#4a7c59" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <span className="text-lg font-bold text-matcha-900">{total.toFixed(2)} €</span>
        <span className="flex items-center gap-1 text-xs text-matcha-600">
          <Target className="h-3 w-3" />
          Ziel: {zielEinkommen.toFixed(0)} €
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-matcha-600">
          <span>{progress}% des Ziels</span>
          <span>{(zielEinkommen - total).toFixed(2)} € fehlen</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-matcha-100">
          <div
            className={cn('h-2 rounded-full transition-all', progress >= 100 ? 'bg-yellow-400' : 'bg-matcha-500')}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
