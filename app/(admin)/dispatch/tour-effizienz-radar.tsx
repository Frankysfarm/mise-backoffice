'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Driver {
  employee_id: string;
  ist_online: boolean;
  employee: { vorname: string; nachname: string } | null;
}

interface Batch {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_eta_min: number | null;
  total_distance_km: number | null;
  zone: string | null;
  stops?: {
    id: string;
    geliefert_am: string | null;
    angekommen_am?: string | null;
    order?: { eta_latest: string | null } | null;
  }[];
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
}

function computeDriverRadar(batches: Batch[], driverId: string, now: number) {
  const driverBatches = batches.filter(b => b.fahrer_id === driverId);
  if (driverBatches.length === 0) return null;

  const completedBatches = driverBatches.filter(b => b.status === 'abgeschlossen' || b.status === 'geliefert');
  const activeBatch = driverBatches.find(b => b.status === 'on_route' || b.status === 'unterwegs');

  // Pünktlichkeit: Anteil der Stops die on-time geliefert wurden
  const allStops = driverBatches.flatMap(b => b.stops ?? []);
  const deliveredStops = allStops.filter(s => s.geliefert_am);
  const onTimeStops = deliveredStops.filter(s => {
    if (!s.geliefert_am || !s.order?.eta_latest) return true;
    return new Date(s.geliefert_am) <= new Date(s.order.eta_latest);
  });
  const pünktlichkeit = deliveredStops.length > 0
    ? Math.round((onTimeStops.length / deliveredStops.length) * 100)
    : 80;

  // Auslastung: Stops pro Stunde (normalisiert auf 0-100)
  const totalDeliveries = deliveredStops.length;
  const auslastung = Math.min(100, Math.round((totalDeliveries / Math.max(1, driverBatches.length)) * 25));

  // Geschwindigkeit: Aktuelle Tour-Pace
  let geschwindigkeit = 75;
  if (activeBatch?.startzeit && activeBatch.total_eta_min) {
    const elapsedMin = (now - new Date(activeBatch.startzeit).getTime()) / 60_000;
    const completedStops = activeBatch.stops?.filter(s => s.geliefert_am).length ?? 0;
    const totalStops = activeBatch.stops?.length ?? 1;
    const expectedDone = (elapsedMin / activeBatch.total_eta_min) * totalStops;
    geschwindigkeit = Math.min(100, Math.round((completedStops / Math.max(0.1, expectedDone)) * 75));
  }

  // Streckeneffizienz: km pro Stop (niedriger = besser, normalisiert)
  const totalKm = driverBatches.reduce((acc, b) => acc + (b.total_distance_km ?? 0), 0);
  const streckeneffizienz = allStops.length > 0
    ? Math.min(100, Math.round(100 - (totalKm / Math.max(1, allStops.length)) * 5))
    : 70;

  // Zonenabdeckung: Vielfalt der Zonen (mehr = besser bis Limit)
  const zones = new Set(driverBatches.map(b => b.zone).filter(Boolean));
  const zonenabdeckung = Math.min(100, zones.size * 25);

  return {
    pünktlichkeit: Math.max(0, pünktlichkeit),
    auslastung: Math.max(0, auslastung),
    geschwindigkeit: Math.max(0, geschwindigkeit),
    streckeneffizienz: Math.max(0, streckeneffizienz),
    zonenabdeckung: Math.max(0, zonenabdeckung),
    gesamtScore: Math.round((pünktlichkeit + auslastung + geschwindigkeit + streckeneffizienz + zonenabdeckung) / 5),
    deliveries: totalDeliveries,
    isActive: !!activeBatch,
  };
}

const COLORS = ['#2d6b45', '#f4a623', '#3b82f6', '#8b5cf6', '#ec4899'];

export function DispatchTourEffizienzRadar({ batches, drivers }: Props) {
  const [now, setNow] = useState(Date.now());
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const activeDrivers = useMemo(() =>
    drivers.filter(d => d.ist_online).slice(0, 5),
    [drivers],
  );

  const radarData = useMemo(() => {
    const target = selectedDriver
      ? drivers.find(d => d.employee_id === selectedDriver)
      : activeDrivers[0];
    if (!target) return null;
    return computeDriverRadar(batches, target.employee_id, now);
  }, [selectedDriver, activeDrivers, batches, now, drivers]);

  const chartData = useMemo(() => {
    if (!radarData) return [];
    return [
      { axis: 'Pünktlichkeit', score: radarData.pünktlichkeit, fullMark: 100 },
      { axis: 'Auslastung',    score: radarData.auslastung,    fullMark: 100 },
      { axis: 'Geschwindigkeit', score: radarData.geschwindigkeit, fullMark: 100 },
      { axis: 'Strecke',       score: radarData.streckeneffizienz, fullMark: 100 },
      { axis: 'Zonen',         score: radarData.zonenabdeckung, fullMark: 100 },
    ];
  }, [radarData]);

  const currentDriver = selectedDriver
    ? drivers.find(d => d.employee_id === selectedDriver)
    : activeDrivers[0];

  if (activeDrivers.length === 0) return null;

  const scoreColor = radarData
    ? radarData.gesamtScore >= 75 ? 'text-matcha-600' : radarData.gesamtScore >= 50 ? 'text-amber-600' : 'text-red-600'
    : 'text-muted-foreground';

  const ScoreTrend = radarData
    ? radarData.gesamtScore >= 70 ? TrendingUp : radarData.gesamtScore >= 50 ? Minus : TrendingDown
    : Minus;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Activity className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Tour-Effizienz-Radar
        </span>
        {radarData && (
          <div className={cn('flex items-center gap-1 text-xs font-bold tabular-nums', scoreColor)}>
            <ScoreTrend className="h-3 w-3" />
            {radarData.gesamtScore}
          </div>
        )}
      </div>

      {/* Driver selector */}
      {activeDrivers.length > 1 && (
        <div className="flex gap-1.5 px-4 py-2 border-b overflow-x-auto">
          {activeDrivers.map((d, i) => {
            const driverScore = computeDriverRadar(batches, d.employee_id, now);
            const isSelected = (selectedDriver ?? activeDrivers[0]?.employee_id) === d.employee_id;
            return (
              <button
                key={d.employee_id}
                onClick={() => setSelectedDriver(d.employee_id)}
                className={cn(
                  'shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold transition-all border',
                  isSelected
                    ? 'bg-matcha-600 text-white border-matcha-600'
                    : 'bg-white text-muted-foreground border-border hover:border-matcha-300',
                )}
                style={{ borderLeftColor: isSelected ? undefined : COLORS[i], borderLeftWidth: 3 }}
              >
                {d.employee?.vorname ?? 'Fahrer'}
                {driverScore && (
                  <span className={cn('text-[9px]', isSelected ? 'opacity-80' : '')}>
                    {driverScore.gesamtScore}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="p-4">
        {radarData && chartData.length > 0 ? (
          <>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={{ fontSize: 9, fill: '#6b7280', fontWeight: 600 }}
                  />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#2d6b45"
                    fill="#2d6b45"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                  <Tooltip
                    formatter={(v) => [`${v ?? ''}`, 'Score']}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Metric tiles */}
            <div className="grid grid-cols-5 gap-1 mt-2">
              {chartData.map(({ axis, score }) => (
                <div key={axis} className="text-center">
                  <div className={cn(
                    'text-sm font-black tabular-nums',
                    score >= 75 ? 'text-matcha-700' : score >= 50 ? 'text-amber-600' : 'text-red-600',
                  )}>
                    {score}
                  </div>
                  <div className="text-[8px] text-muted-foreground leading-tight">{axis}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-3 pt-2 border-t">
              <div className="text-[10px] text-muted-foreground">
                {currentDriver?.employee?.vorname} {currentDriver?.employee?.nachname}
              </div>
              <div className="ml-auto flex items-center gap-2 text-[10px]">
                {radarData.isActive && (
                  <span className="flex items-center gap-0.5 text-matcha-600 font-bold">
                    <span className="h-1.5 w-1.5 rounded-full bg-matcha-500 animate-pulse inline-block" />
                    Aktiv
                  </span>
                )}
                <span className="text-muted-foreground">{radarData.deliveries} Lieferungen</span>
              </div>
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Kein aktiver Fahrer ausgewählt
          </div>
        )}
      </div>
    </Card>
  );
}
