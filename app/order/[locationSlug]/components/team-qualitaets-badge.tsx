'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/* Storefront Social-Proof-Badge: zeigt das aktuelle Team-Qualitätslevel
   via öffentlichen avg-eta-Endpunkt (service-role, kein Auth). */
export function TeamQualitaetsBadge() {
  const [teamGrade, setTeamGrade]   = useState<string | null>(null);
  const [avgScore, setAvgScore]     = useState<number | null>(null);
  const [loaded, setLoaded]         = useState(false);

  useEffect(() => {
    const slug = typeof window !== 'undefined'
      ? window.location.pathname.split('/').filter(Boolean)[1] ?? ''
      : '';
    if (!slug) { setLoaded(true); return; }

    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/public/avg-eta?slug=${encodeURIComponent(slug)}`);
        if (!r.ok || cancelled) return;
        const d = await r.json();
        if (!cancelled) {
          setTeamGrade(d.team_grade ?? null);
          setAvgScore(d.team_avg_score ?? null);
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setLoaded(true); }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  if (!loaded || !teamGrade) return null;

  const label =
    teamGrade === 'A+' || teamGrade === 'A' ? 'Geprüftes Top-Team' :
    teamGrade === 'B' ? 'Geprüftes Team' : 'Aktives Lieferteam';

  const color =
    teamGrade === 'A+' || teamGrade === 'A' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
    teamGrade === 'B' ? 'text-blue-700 bg-blue-50 border-blue-200' :
    'text-stone-600 bg-stone-50 border-stone-200';

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 text-xs font-medium border rounded-full px-3 py-1',
      color,
    )}>
      <ShieldCheck className="h-3.5 w-3.5" />
      <span>
        {label}
        {avgScore && avgScore > 0 ? ` · Ø ${Math.round(avgScore)} Pkt` : ''}
      </span>
    </div>
  );
}
