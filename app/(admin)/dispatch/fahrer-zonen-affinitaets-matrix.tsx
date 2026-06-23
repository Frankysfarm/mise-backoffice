'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, MapPin, Star, TrendingUp } from 'lucide-react';

type ZoneName = 'A' | 'B' | 'C' | 'D';

interface ZoneScore {
  affinityScore: number;
  totalDeliveries: number;
  onTimeCount: number;
  avgStars: number | null;
  ratingCount: number;
  combinedScore: number;
}

interface FahrerRow {
  driverId: string;
  driverName: string;
  zones: Record<ZoneName, ZoneScore | null>;
  bestZone: ZoneName | null;
  totalDeliveries: number;
  lastDeliveryAt: string | null;
}

interface ApiResponse {
  ok: boolean;
  rows: FahrerRow[];
  topDriverPerZone: Record<ZoneName, { driverId: string; driverName: string; score: number } | null>;
  total: number;
}

interface Props {
  locationId: string | null;
}

const ZONE_COLORS: Record<ZoneName, string> = {
  A: 'text-matcha-700 bg-matcha-50 border-matcha-300',
  B: 'text-blue-700 bg-blue-50 border-blue-300',
  C: 'text-amber-700 bg-amber-50 border-amber-300',
  D: 'text-red-700 bg-red-50 border-red-300',
};

function scoreColor(score: number | null): string {
  if (score == null) return 'text-muted-foreground bg-muted/40';
  if (score >= 70) return 'text-matcha-700 bg-matcha-50 font-bold';
  if (score >= 40) return 'text-amber-700 bg-amber-50 font-semibold';
  return 'text-muted-foreground bg-muted/30';
}

function ScoreCell({ zone, data, isBest }: { zone: ZoneName; data: ZoneScore | null; isBest: boolean }) {
  if (!data) {
    return (
      <td className="px-3 py-2 text-center">
        <span className="text-[10px] text-muted-foreground">–</span>
      </td>
    );
  }
  return (
    <td className="px-3 py-2">
      <div className={cn(
        'rounded-lg px-2 py-1.5 text-center relative',
        scoreColor(data.combinedScore),
        isBest && 'ring-2 ring-matcha-400',
      )}>
        {isBest && (
          <span className="absolute -top-1.5 -right-1.5 text-[8px] bg-matcha-500 text-white rounded-full px-1 font-black">✓</span>
        )}
        <div className="text-sm font-black tabular-nums">{data.combinedScore}</div>
        <div className="text-[9px] text-muted-foreground tabular-nums">{data.totalDeliveries} Lief.</div>
        {data.avgStars != null && (
          <div className="flex items-center justify-center gap-0.5 mt-0.5">
            <Star className="h-2 w-2 fill-amber-400 text-amber-400" />
            <span className="text-[9px] font-bold tabular-nums">{data.avgStars.toFixed(1)}</span>
          </div>
        )}
      </div>
    </td>
  );
}

export function DispatchFahrerZonenAffinitaetsMatrix({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = () => {
    if (!locationId) { setLoading(false); return; }
    fetch(`/api/delivery/admin/fahrer-zonen-affinitaet?location_id=${locationId}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) return null;
  if (!data?.rows?.length) return null;

  return (
    <Card className="overflow-hidden border-blue-200 bg-blue-50/30">
      <button
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b border-blue-200/60 hover:bg-blue-50/60 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
          Fahrer-Zonen-Affinität
        </span>
        <Badge variant="secondary" className="bg-blue-100 text-blue-800 ml-1">
          {data.total} Fahrer
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] text-blue-500 font-bold">Score 0–100</span>
          {open ? <ChevronUp className="h-3 w-3 text-blue-500" /> : <ChevronDown className="h-3 w-3 text-blue-500" />}
        </div>
      </button>

      {open && (
        <>
          {/* Top driver per zone summary */}
          <div className="px-4 py-2 border-b border-blue-100/60 flex flex-wrap gap-2">
            {(['A', 'B', 'C', 'D'] as ZoneName[]).map((zone) => {
              const top = data.topDriverPerZone[zone];
              return (
                <div key={zone} className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold', ZONE_COLORS[zone])}>
                  <span className="font-black">Zone {zone}</span>
                  <TrendingUp className="h-2.5 w-2.5" />
                  <span>{top ? `${top.driverName} (${top.score})` : '–'}</span>
                </div>
              );
            })}
          </div>

          {/* Matrix table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-blue-100/60 bg-blue-50/50">
                  <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-blue-700">Fahrer</th>
                  {(['A', 'B', 'C', 'D'] as ZoneName[]).map((z) => (
                    <th key={z} className={cn('px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider', ZONE_COLORS[z].split(' ')[0])}>
                      Zone {z}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-blue-700">Empfehlung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {data.rows.map((row) => (
                  <tr key={row.driverId} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-4 py-2">
                      <div className="font-semibold text-foreground">{row.driverName}</div>
                      <div className="text-[9px] text-muted-foreground tabular-nums">{row.totalDeliveries} gesamt</div>
                    </td>
                    {(['A', 'B', 'C', 'D'] as ZoneName[]).map((z) => (
                      <ScoreCell key={z} zone={z} data={row.zones[z]} isBest={row.bestZone === z} />
                    ))}
                    <td className="px-3 py-2 text-center">
                      {row.bestZone ? (
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black',
                          ZONE_COLORS[row.bestZone],
                        )}>
                          Zone {row.bestZone}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-1.5 text-[9px] text-blue-400 border-t border-blue-100/60">
            Score = 50% Affinität + 30% Kundenbewertung + 20% Pünktlichkeit · ✓ = Empfohlene Zone · 60s Auto-Refresh
          </div>
        </>
      )}
    </Card>
  );
}
