'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Radio, RefreshCw } from 'lucide-react';

interface ZoneHeatEntry {
  zone: string;
  label: string;
  color: string;
  openBatches: number;
  activeBatches: number;
  driversInZone: number;
  capacityPct: number;
}

interface ZoneHeatData {
  zones: ZoneHeatEntry[];
  totalDrivers: number;
  freeDrivers: number;
}

const REFRESH_MS = 30_000;
const RADAR_SIZE = 180;
const CENTER = RADAR_SIZE / 2;
const MAX_RADIUS = 72;
const ZONES_ORDER = ['A', 'B', 'C', 'D'];

function polarToXY(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

function ZoneRadar({ zones }: { zones: ZoneHeatEntry[] }) {
  const angleStep = 360 / zones.length;
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  // Axes (one per zone)
  const axes = zones.map((z, i) => {
    const angle = i * angleStep;
    const tip = polarToXY(angle, MAX_RADIUS);
    const label = polarToXY(angle, MAX_RADIUS + 14);
    return { ...z, angle, tip, label };
  });

  // Radar polygon: capacityPct maps to radius
  const dataPoints = zones.map((z, i) => {
    const angle = i * angleStep;
    const r = (z.capacityPct / 100) * MAX_RADIUS;
    return polarToXY(angle, r);
  });
  const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  // Grid polygons
  const gridPolygons = gridLevels.map((level) => {
    const pts = zones.map((_, i) => {
      const angle = i * angleStep;
      const pt = polarToXY(angle, level * MAX_RADIUS);
      return `${pt.x},${pt.y}`;
    });
    return pts.join(' ');
  });

  return (
    <svg width={RADAR_SIZE} height={RADAR_SIZE} viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}>
      {/* Grid rings */}
      {gridPolygons.map((pts, idx) => (
        <polygon
          key={idx}
          points={pts}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={1}
        />
      ))}

      {/* Axes */}
      {axes.map((ax) => (
        <line
          key={ax.zone}
          x1={CENTER}
          y1={CENTER}
          x2={ax.tip.x}
          y2={ax.tip.y}
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={1}
        />
      ))}

      {/* Data polygon */}
      <polygon
        points={polygonPoints}
        fill="rgba(34,197,94,0.18)"
        stroke="#22c55e"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Data dots */}
      {dataPoints.map((pt, i) => (
        <circle
          key={i}
          cx={pt.x}
          cy={pt.y}
          r={3}
          fill={zones[i].color}
          stroke="white"
          strokeWidth={1}
        />
      ))}

      {/* Axis labels */}
      {axes.map((ax) => (
        <text
          key={`lbl-${ax.zone}`}
          x={ax.label.x}
          y={ax.label.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fontWeight="bold"
          fill={ax.color}
        >
          {ax.zone}
        </text>
      ))}
    </svg>
  );
}

export function DispatchZonenKapazitaetsRadar({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ZoneHeatData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastAt, setLastAt] = useState<Date | null>(null);

  async function load() {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/zone-heat-summary?location_id=${locationId}`);
      if (r.ok) {
        const json = (await r.json()) as ZoneHeatData;
        setData(json);
        setLastAt(new Date());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, REFRESH_MS);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  // Sort zones for radar to consistent order A/B/C/D
  const orderedZones = data
    ? ZONES_ORDER.map((z) => data.zones.find((e) => e.zone === z)).filter(Boolean) as ZoneHeatEntry[]
    : [];

  const totalOpen = orderedZones.reduce((s, z) => s + z.openBatches, 0);
  const totalActive = orderedZones.reduce((s, z) => s + z.activeBatches, 0);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
        <Radio className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Zonen-Kapazitäts-Radar
        </span>
        {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        <div className="ml-auto flex items-center gap-2">
          {lastAt && (
            <span className="text-[9px] text-muted-foreground tabular-nums">
              {lastAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {!data && !loading && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">Keine Daten</div>
      )}

      {data && (
        <div className="p-4 flex flex-col sm:flex-row gap-4 items-start">
          {/* Radar */}
          <div className="shrink-0 flex flex-col items-center gap-1">
            <ZoneRadar zones={orderedZones} />
            <div className="text-[9px] text-muted-foreground text-center">
              Kapazitäts-Auslastung je Zone
            </div>
          </div>

          {/* Zone table */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Summary badges */}
            <div className="flex gap-2 flex-wrap mb-3">
              <Badge variant="secondary" className="text-[10px]">
                {data.totalDrivers} Fahrer aktiv
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {data.freeDrivers} verfügbar
              </Badge>
              <Badge
                className={cn(
                  'text-[10px]',
                  totalOpen > 5 ? 'bg-red-500 text-white' : totalOpen > 2 ? 'bg-amber-400 text-white' : 'bg-matcha-500 text-white',
                )}
              >
                {totalOpen} offen
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {totalActive} aktiv
              </Badge>
            </div>

            {/* Per-zone rows */}
            <div className="space-y-1.5">
              {orderedZones.map((z) => {
                const load = z.capacityPct;
                const loadColor =
                  load >= 80 ? 'bg-red-400' : load >= 50 ? 'bg-amber-400' : 'bg-matcha-500';
                return (
                  <div key={z.zone} className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-black text-white"
                      style={{ backgroundColor: z.color }}
                    >
                      {z.zone}
                    </div>
                    <span className="text-[10px] text-muted-foreground w-14 shrink-0">{z.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', loadColor)}
                        style={{ width: `${load}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums w-8 text-right shrink-0">
                      {load}%
                    </span>
                    <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
                      {z.openBatches}↑ {z.driversInZone}🚴
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
