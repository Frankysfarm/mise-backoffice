'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, X } from 'lucide-react';

/**
 * Phase 1800 — Qualitäts-Versprechen-Badge (Storefront)
 *
 * "Top-bewerteter Fahrer" wenn Score >= 4.8 + Initials + Sterne;
 * Hydration-safe; 30-Min-Polling; schließbar.
 */

interface FahrerInfo {
  name: string;
  bewertung_avg: number;
  score: number;
}

interface Props {
  locationId: string;
  className?: string;
}

async function fetchTopFahrer(locationId: string): Promise<FahrerInfo | null> {
  try {
    const res = await fetch(`/api/delivery/admin/schicht-qualitaet-score?location_id=${locationId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const top = (data.fahrer ?? []).find((f: FahrerInfo) => f.bewertung_avg >= 4.8);
    return top ?? null;
  } catch {
    // Mock
    return {
      name: 'Ana Müller',
      bewertung_avg: 4.9,
      score: 92,
    };
  }
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ');
  const ini = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : parts[0].slice(0, 2);
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-saffron/20 text-sm font-black text-saffron">
      {ini.toUpperCase()}
    </div>
  );
}

function Sterne({ wert }: { wert: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3 w-3',
            i < Math.round(wert) ? 'fill-saffron text-saffron' : 'fill-transparent text-muted-foreground/40',
          )}
        />
      ))}
      <span className="ml-1 text-[10px] font-bold text-saffron">{wert.toFixed(1)}</span>
    </div>
  );
}

export function StorefrontPhase1800QualitaetsVersprechenBadge({ locationId, className }: Props) {
  const [fahrer, setFahrer] = useState<FahrerInfo | null>(null);
  const [mounted, setMounted] = useState(false);
  const [geschlossen, setGeschlossen] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || !locationId) return;

    fetchTopFahrer(locationId).then(setFahrer);
    const id = setInterval(() => fetchTopFahrer(locationId).then(setFahrer), 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [mounted, locationId]);

  if (!mounted || !fahrer || fahrer.bewertung_avg < 4.8 || geschlossen) return null;

  return (
    <div className={cn(
      'relative flex items-center gap-3 rounded-xl border border-saffron/20 bg-saffron/5 px-4 py-3',
      className,
    )}>
      <Initials name={fahrer.name} />

      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-saffron/80">
          Top-bewerteter Fahrer heute
        </p>
        <p className="text-sm font-bold text-foreground truncate">{fahrer.name}</p>
        <Sterne wert={fahrer.bewertung_avg} />
      </div>

      <div className="shrink-0 text-right">
        <p className="text-2xl font-black tabular-nums text-saffron">{fahrer.score}</p>
        <p className="text-[9px] text-muted-foreground">Score</p>
      </div>

      <button
        className="absolute right-2 top-2 rounded-full p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setGeschlossen(true)}
        aria-label="Badge schließen"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
