'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { Map, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface ZoneRow {
  zone: string;
  tours: number;
  avgEtaMin: number;
  onTimePct: number;
  revenueEur: number;
  profitableScore: number; // 0–100
}

const MOCK_ZONES: ZoneRow[] = [
  { zone: 'Nord',    tours: 14, avgEtaMin: 18, onTimePct: 88, revenueEur: 340, profitableScore: 84 },
  { zone: 'Mitte',  tours: 22, avgEtaMin: 12, onTimePct: 95, revenueEur: 520, profitableScore: 93 },
  { zone: 'Süd',    tours: 9,  avgEtaMin: 24, onTimePct: 72, revenueEur: 210, profitableScore: 61 },
  { zone: 'West',   tours: 11, avgEtaMin: 20, onTimePct: 81, revenueEur: 265, profitableScore: 74 },
  { zone: 'Außen',  tours: 5,  avgEtaMin: 34, onTimePct: 60, revenueEur: 140, profitableScore: 44 },
];

function scoreStyle(s: number) {
  if (s >= 80) return 'bg-matcha-500';
  if (s >= 60) return 'bg-amber-400';
  return 'bg-red-400';
}

function badgeStyle(s: number) {
  if (s >= 80) return 'bg-matcha-50 text-matcha-700';
  if (s >= 60) return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-700';
}

export function DispatchZoneErtragsStrip({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [open, setOpen] = useState(true);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) {
      setZones(MOCK_ZONES);
      return;
    }
    setLoading(true);
    fetch(`/api/delivery/admin/zone-earnings?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.zones) && d.zones.length > 0) setZones(d.zones);
        else setZones(MOCK_ZONES);
      })
      .catch(() => setZones(MOCK_ZONES))
      .finally(() => setLoading(false));
  }, [locationId]);

  const totalRevenue = zones.reduce((s, z) => s + z.revenueEur, 0);
  const totalTours = zones.reduce((s, z) => s + z.tours, 0);
  const avgScore = zones.length > 0 ? Math.round(zones.reduce((s, z) => s + z.profitableScore, 0) / zones.length) : 0;

  const bestZone = [...zones].sort((a, b) => b.profitableScore - a.profitableScore)[0];
  const worstZone = [...zones].sort((a, b) => a.profitableScore - b.profitableScore)[0];

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Zonen-Ertrag</span>
          {zones.length > 0 && (
            <span className="ml-1 rounded-full bg-matcha-50 text-matcha-700 px-2 py-0.5 text-[9px] font-black">
              Ø {avgScore}/100
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t">
          {/* Summary bar */}
          <div className="grid grid-cols-3 divide-x border-b">
            <div className="px-3 py-2 text-center">
              <div className="text-sm font-black tabular-nums">{totalTours}</div>
              <div className="text-[9px] text-muted-foreground">Touren</div>
            </div>
            <div className="px-3 py-2 text-center">
              <div className="text-sm font-black tabular-nums text-matcha-700">{euro(totalRevenue)}</div>
              <div className="text-[9px] text-muted-foreground">Umsatz</div>
            </div>
            <div className="px-3 py-2 text-center">
              <div className="text-sm font-black tabular-nums">{avgScore}</div>
              <div className="text-[9px] text-muted-foreground">Ø Score</div>
            </div>
          </div>

          {/* Zone rows */}
          <div className="divide-y">
            {zones.map((z) => (
              <div key={z.zone} className="flex items-center gap-3 px-4 py-2.5">
                <div className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black min-w-[44px] text-center', badgeStyle(z.profitableScore))}>
                  {z.zone}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {z.tours} Touren · Ø {z.avgEtaMin} Min · {z.onTimePct}% pünktlich
                    </span>
                    <span className="text-[10px] font-bold tabular-nums text-matcha-700">{euro(z.revenueEur)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', scoreStyle(z.profitableScore))}
                      style={{ width: `${z.profitableScore}%` }}
                    />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={cn('text-xs font-black tabular-nums', badgeStyle(z.profitableScore).split(' ')[1])}>
                    {z.profitableScore}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Best / Worst callout */}
          {bestZone && worstZone && bestZone.zone !== worstZone.zone && (
            <div className="flex gap-2 px-4 py-2.5 border-t bg-muted/20">
              <div className="flex items-center gap-1.5 text-[10px]">
                <TrendingUp className="h-3 w-3 text-matcha-600" />
                <span className="text-muted-foreground">Beste:</span>
                <span className="font-bold text-matcha-700">{bestZone.zone}</span>
              </div>
              <div className="mx-2 w-px bg-border" />
              <div className="flex items-center gap-1.5 text-[10px]">
                <TrendingDown className="h-3 w-3 text-red-500" />
                <span className="text-muted-foreground">Schwächste:</span>
                <span className="font-bold text-red-600">{worstZone.zone}</span>
              </div>
            </div>
          )}

          {!locationId && (
            <div className="px-4 py-1.5 bg-muted/20 border-t">
              <span className="text-[10px] text-muted-foreground">⚠ Demo-Daten — Echtdaten über Zone-Earnings-API</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
