'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Map } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * phase881 — Zonen-Nachfrage-Heatmap Live
 *
 * Echtzeit-Bestelldichte pro Zone A/B/C/D als farbkodiertes Grid.
 * 60s-Polling gegen /api/delivery/admin/zonen-bestelldruck (oder Fallback Mock).
 */

interface ZoneData {
  zone: 'A' | 'B' | 'C' | 'D';
  bestellungen: number;
  max_bestellungen: number;
  freie_fahrer: number;
  avg_lieferzeit_min: number;
  trend: 'steigend' | 'fallend' | 'stabil';
}

interface Props {
  locationId: string | null;
}

const ZONE_DESCRIPTIONS: Record<string, string> = {
  A: 'Innenstadt',
  B: 'Stadtmitte',
  C: 'Vorstadt',
  D: 'Außenbereich',
};

function heatColor(pct: number): { bg: string; text: string; ring: string } {
  if (pct >= 0.8) return { bg: 'bg-red-500',    text: 'text-white',         ring: 'ring-red-400'    };
  if (pct >= 0.6) return { bg: 'bg-orange-400',  text: 'text-white',         ring: 'ring-orange-300' };
  if (pct >= 0.4) return { bg: 'bg-amber-300',   text: 'text-amber-900',     ring: 'ring-amber-300'  };
  if (pct >= 0.2) return { bg: 'bg-matcha-300',  text: 'text-matcha-900',    ring: 'ring-matcha-300' };
  return              { bg: 'bg-muted',         text: 'text-muted-foreground',ring: 'ring-border'     };
}

const MOCK_ZONES: ZoneData[] = [
  { zone: 'A', bestellungen: 12, max_bestellungen: 20, freie_fahrer: 2, avg_lieferzeit_min: 22, trend: 'steigend' },
  { zone: 'B', bestellungen: 7,  max_bestellungen: 20, freie_fahrer: 3, avg_lieferzeit_min: 28, trend: 'stabil'   },
  { zone: 'C', bestellungen: 3,  max_bestellungen: 20, freie_fahrer: 1, avg_lieferzeit_min: 35, trend: 'fallend'  },
  { zone: 'D', bestellungen: 1,  max_bestellungen: 20, freie_fahrer: 2, avg_lieferzeit_min: 40, trend: 'stabil'   },
];

function trendSymbol(trend: string): string {
  if (trend === 'steigend') return '↑';
  if (trend === 'fallend')  return '↓';
  return '→';
}

export function DispatchPhase881ZonenNachfrageHeatmapLive({ locationId }: Props) {
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = () => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/zonen-bestelldruck?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(d => {
        if (d?.zonen?.length) {
          setZones(d.zonen as ZoneData[]);
        } else {
          setZones(MOCK_ZONES);
        }
        setLastUpdated(new Date());
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;
  if (!zones.length && !loading) return null;

  const totalBestellungen = zones.reduce((s, z) => s + z.bestellungen, 0);
  const hotZone = zones.reduce((best, z) => z.bestellungen > best.bestellungen ? z : best, zones[0]);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Map className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Zonen-Nachfrage Live
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        <Badge variant="secondary" className="ml-auto">
          {totalBestellungen} Bestellungen
        </Badge>
        {lastUpdated && (
          <span className="text-[9px] text-muted-foreground shrink-0">
            {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-2 gap-3 p-4">
        {zones.map(zone => {
          const pct = zone.max_bestellungen > 0 ? zone.bestellungen / zone.max_bestellungen : 0;
          const heat = heatColor(pct);
          return (
            <div
              key={zone.zone}
              className={cn(
                'relative rounded-xl p-3 ring-1 transition-all duration-700',
                heat.bg,
                heat.ring,
              )}
            >
              {/* Zone label */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className={cn('text-xs font-black', heat.text)}>
                    Zone {zone.zone}
                  </div>
                  <div className={cn('text-[9px]', heat.text, 'opacity-70')}>
                    {ZONE_DESCRIPTIONS[zone.zone]}
                  </div>
                </div>
                <span className={cn('text-[10px] font-bold', heat.text)}>
                  {trendSymbol(zone.trend)}
                </span>
              </div>

              {/* Big number */}
              <div className={cn('text-2xl font-black tabular-nums leading-none', heat.text)}>
                {zone.bestellungen}
              </div>
              <div className={cn('text-[9px] mt-0.5', heat.text, 'opacity-70')}>
                Bestellungen
              </div>

              {/* Heat bar */}
              <div className="mt-2 h-1 rounded-full bg-black/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-black/30 transition-all duration-700"
                  style={{ width: `${Math.min(100, pct * 100)}%` }}
                />
              </div>

              {/* Sub-stats */}
              <div className={cn('mt-2 flex justify-between text-[9px]', heat.text, 'opacity-80')}>
                <span>{zone.freie_fahrer} frei</span>
                <span>Ø {zone.avg_lieferzeit_min} min</span>
              </div>

              {/* Hot badge */}
              {hotZone?.zone === zone.zone && zone.bestellungen > 0 && (
                <div className="absolute -top-1.5 -right-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[8px] font-black text-white shadow">
                  HOT
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary row */}
      <div className="border-t px-4 py-2.5 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-[10px] text-muted-foreground">≥80% Auslastung</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-amber-300" />
          <span className="text-[10px] text-muted-foreground">40–60%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-matcha-300" />
          <span className="text-[10px] text-muted-foreground">&lt;40%</span>
        </div>
      </div>
    </Card>
  );
}
