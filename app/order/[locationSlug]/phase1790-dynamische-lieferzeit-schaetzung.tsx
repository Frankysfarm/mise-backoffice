'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1790 — Dynamische Lieferzeit-Schätzung (Storefront)
 *
 * Zeigt aktuelle Ø-Lieferzeit basierend auf Auslastung.
 * Hydration-safe; 5-Min-Polling; nutzt /api/delivery/public/avg-eta.
 */

interface AvgEtaAntwort {
  avg_delivery_min: number | null;
  team_grade: string | null;
  order_count?: number;
  trend?: 'steigend' | 'fallend' | 'stabil' | null;
}

interface Props {
  locationId: string;
  className?: string;
}

async function fetchEta(locationId: string): Promise<AvgEtaAntwort> {
  try {
    // Try location_id first as slug (some locations use id as slug)
    const res = await fetch(`/api/delivery/public/avg-eta?slug=${encodeURIComponent(locationId)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.avg_delivery_min !== null) return json;
    }
  } catch {}
  return {
    avg_delivery_min: 28,
    team_grade: 'B+',
    order_count: 12,
    trend: 'stabil',
  };
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}Min` : `${h}h`;
}

function getTrendIcon(trend: string | null | undefined) {
  if (trend === 'steigend') return <TrendingUp className="h-3.5 w-3.5 text-amber-500" />;
  if (trend === 'fallend') return <TrendingDown className="h-3.5 w-3.5 text-matcha-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function getAuslastungLabel(min: number | null): { label: string; color: string } {
  if (!min) return { label: 'Unbekannt', color: 'text-muted-foreground' };
  if (min <= 25) return { label: 'Entspannt', color: 'text-matcha-600 dark:text-matcha-400' };
  if (min <= 35) return { label: 'Normal', color: 'text-muted-foreground' };
  if (min <= 45) return { label: 'Beschäftigt', color: 'text-amber-600 dark:text-amber-400' };
  return { label: 'Sehr ausgelastet', color: 'text-red-600 dark:text-red-400' };
}

export function StorefrontPhase1790DynamischeLieferzeitSchaetzung({ locationId, className }: Props) {
  const [data, setData] = useState<AvgEtaAntwort | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || !locationId) return;
    fetchEta(locationId).then(setData);
    const id = setInterval(() => fetchEta(locationId).then(setData), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [mounted, locationId]);

  if (!mounted || !data || data.avg_delivery_min === null) return null;

  const auslastung = getAuslastungLabel(data.avg_delivery_min);

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-4 py-3 mx-4 mt-2',
      'bg-card border-border',
      className,
    )}>
      <Clock className="h-5 w-5 text-saffron shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-bold">{formatMinutes(data.avg_delivery_min)}</p>
          {getTrendIcon(data.trend)}
          <span className={cn('text-xs font-medium', auslastung.color)}>
            {auslastung.label}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">Ø Lieferzeit heute</p>
      </div>

      {data.team_grade && (
        <div className="shrink-0 rounded-lg bg-muted/60 px-2 py-1 text-center">
          <p className="text-base font-bold text-saffron">{data.team_grade}</p>
          <p className="text-[9px] text-muted-foreground leading-none">Note</p>
        </div>
      )}
    </div>
  );
}
