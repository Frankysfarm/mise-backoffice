'use client';

/**
 * DriverVertrauensBadge — Phase 359
 * Customer-facing trust signal showing driver grade on tracking page.
 * Only renders for grade A+ or A.
 */

import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

type ScoreGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

interface Props {
  driverName: string | null;
  driverId?: string | null;
}

export function DriverVertrauensBadge({ driverName }: Props) {
  const [grade, setGrade] = useState<ScoreGrade | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/delivery/driver/my-performance');
        if (!res.ok) { setLoaded(true); return; }
        const d = await res.json();
        const g = d.grade ?? d.score?.grade ?? null;
        if (!cancelled) { setGrade(g); setLoaded(true); }
      } catch { setLoaded(true); }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  if (!loaded) return null;
  if (!grade || (grade !== 'A+' && grade !== 'A')) return null;

  const isTop = grade === 'A+';

  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
      isTop ? 'bg-emerald-50 border border-emerald-200' : 'bg-green-50 border border-green-200'
    }`}>
      <ShieldCheck className={`h-4 w-4 shrink-0 ${isTop ? 'text-emerald-600' : 'text-green-600'}`} />
      <div>
        <div className={`font-medium text-xs ${isTop ? 'text-emerald-800' : 'text-green-800'}`}>
          {driverName ?? 'Dein Fahrer'} · Fahrer-Score {grade}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {isTop ? 'Top-Fahrer · Hervorragende Bewertungen' : 'Sehr guter Fahrer · Hohe Kundenzufriedenheit'}
        </div>
      </div>
    </div>
  );
}

export default DriverVertrauensBadge;
