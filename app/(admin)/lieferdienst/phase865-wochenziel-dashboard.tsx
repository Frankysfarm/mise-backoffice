'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Target, TrendingUp, TrendingDown, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { euro } from '@/lib/utils';

interface WochenZiel {
  label: string;
  einheit: string;
  aktuell: number;
  ziel: number;
  prozent: number;
  trend: 'up' | 'down' | 'neutral';
  trendWert: number;
}

interface Props {
  locationId: string | null;
}

function mockWochenZiele(): WochenZiel[] {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7; // 1=Mo, 7=So
  const weekProgress = dayOfWeek / 7;
  return [
    {
      label: 'Wochenumsatz',
      einheit: '€',
      aktuell: Math.round(3200 * weekProgress + Math.random() * 400),
      ziel: 5000,
      prozent: Math.round(Math.min(100, weekProgress * 100 * (0.9 + Math.random() * 0.2))),
      trend: 'up',
      trendWert: 8.3,
    },
    {
      label: 'Bestellungen',
      einheit: '',
      aktuell: Math.round(180 * weekProgress + Math.random() * 20),
      ziel: 280,
      prozent: Math.round(Math.min(100, weekProgress * 100 * (0.85 + Math.random() * 0.3))),
      trend: 'up',
      trendWert: 5.1,
    },
    {
      label: 'Pünktlichkeit',
      einheit: '%',
      aktuell: 87 + Math.floor(Math.random() * 8),
      ziel: 90,
      prozent: Math.round(Math.min(100, (87 / 90) * 100 + Math.random() * 10)),
      trend: 'neutral',
      trendWert: 0.4,
    },
    {
      label: 'Ø Lieferzeit',
      einheit: 'Min',
      aktuell: 22 + Math.floor(Math.random() * 5),
      ziel: 25,
      prozent: 85 + Math.floor(Math.random() * 15),
      trend: 'down',
      trendWert: 1.2,
    },
  ];
}

export function LieferdienstPhase865WochenZielDashboard({ locationId }: Props) {
  const [ziele, setZiele] = useState<WochenZiel[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    let mounted = true;
    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/schicht-benchmark?location_id=${locationId}`);
        if (res.ok) {
          const json = await res.json();
          if (mounted && json && Array.isArray(json.ziele)) {
            setZiele(json.ziele);
            setLoading(false);
            return;
          }
        }
      } catch { /* fallback */ }
      if (mounted) { setZiele(mockWochenZiele()); setLoading(false); }
    }
    load();
    const iv = setInterval(load, 300_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [locationId]);

  if (!locationId) return null;

  const barColor = (pct: number) =>
    pct >= 90 ? 'bg-matcha-500' : pct >= 70 ? 'bg-amber-400' : 'bg-red-500';
  const textColor = (pct: number) =>
    pct >= 90 ? 'text-matcha-700' : pct >= 70 ? 'text-amber-700' : 'text-red-700';

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
      >
        <Target className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold flex-1">Wochenziel-Dashboard</span>
        {!loading && ziele.length > 0 && (
          <span className={cn('text-[10px] font-bold mr-1', textColor(ziele[0].prozent))}>
            {ziele[0].prozent}% Ziel
          </span>
        )}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Lade Wochenziele…
            </div>
          ) : ziele.map((z, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-foreground">{z.label}</span>
                <div className="flex items-center gap-1.5">
                  {z.trend === 'up' && <TrendingUp className="h-3 w-3 text-matcha-600" />}
                  {z.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
                  <span className={cn('text-[11px] font-black tabular-nums', textColor(z.prozent))}>
                    {z.einheit === '€' ? euro(z.aktuell) : `${z.aktuell}${z.einheit ? ' ' + z.einheit : ''}`}
                    <span className="text-[9px] font-normal text-muted-foreground ml-1">
                      / {z.einheit === '€' ? euro(z.ziel) : `${z.ziel}${z.einheit ? ' ' + z.einheit : ''}`}
                    </span>
                  </span>
                  <span className={cn('text-[10px] font-black', textColor(z.prozent))}>
                    {z.prozent}%
                  </span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', barColor(z.prozent))}
                  style={{ width: `${z.prozent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
