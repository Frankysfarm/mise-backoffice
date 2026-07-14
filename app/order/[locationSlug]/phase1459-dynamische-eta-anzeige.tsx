'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Bike, MapPin, Zap, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1459 — Dynamische ETA-Anzeige (Storefront)
// Live-Lieferzeit-Anzeige mit Fahrer-Näherungsindikator, Countdown
// und dynamisch aktualisierten ETA-Werten — kein statischer Zeiger.

interface Props {
  locationId: string;
  orderId?: string | null;
  estimatedMinutes?: number | null;
}

interface EtaData {
  etaMin: number;
  driverDistanceKm?: number | null;
  driverName?: string | null;
  status?: string | null;
  updatedAt?: string | null;
}

function fetchEta(locationId: string, orderId?: string | null): Promise<EtaData | null> {
  const url = orderId
    ? `/api/delivery/tracking?order_id=${orderId}&location_id=${locationId}`
    : `/api/delivery/eta/live?location_id=${locationId}`;
  return fetch(url, { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      if (!d) return null;
      return {
        etaMin: d.eta_min ?? d.etaMin ?? d.estimated_minutes ?? null,
        driverDistanceKm: d.driver_distance_km ?? d.driverDistanceKm ?? null,
        driverName: d.driver_name ?? d.driverName ?? null,
        status: d.status ?? null,
        updatedAt: d.updated_at ?? null,
      };
    })
    .catch(() => null);
}

function EtaRing({ etaMin, totalMin }: { etaMin: number; totalMin: number }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, etaMin / totalMin));
  const dash = pct * circ;
  const cx = 46;

  const color = etaMin <= 5 ? '#22c55e' : etaMin <= 15 ? '#f59e0b' : '#3b82f6';

  return (
    <div className="relative" style={{ width: 92, height: 92 }}>
      <svg width={92} height={92} viewBox="0 0 92 92" className="-rotate-90">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e2e8f0" strokeWidth={7} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black tabular-nums leading-none" style={{ color }}>{etaMin}</span>
        <span className="text-[10px] text-muted-foreground font-medium">Min</span>
      </div>
    </div>
  );
}

function ProximityPulse({ distKm }: { distKm: number }) {
  const near = distKm < 1;
  return (
    <div className={cn('flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold',
      near ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700')}>
      <span className={cn('w-2 h-2 rounded-full', near ? 'bg-emerald-500 animate-ping' : 'bg-blue-400')} />
      <Bike className="h-3.5 w-3.5" />
      {distKm < 0.1 ? 'Gleich da!' : `${distKm.toFixed(1)} km entfernt`}
    </div>
  );
}

export function DynamischeEtaAnzeige({ locationId, orderId, estimatedMinutes }: Props) {
  const [data, setData] = useState<EtaData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetchEta(locationId, orderId)
      .then(d => {
        setData(prev => d ?? prev ?? (estimatedMinutes ? { etaMin: estimatedMinutes } : null));
      })
      .finally(() => setLoading(false));
  }, [locationId, orderId, estimatedMinutes]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const eta = data?.etaMin ?? estimatedMinutes;
  const isDelivered = data?.status === 'delivered' || data?.status === 'geliefert';

  if (loading && !eta) return null;

  if (isDelivered) {
    return (
      <Card className="p-4 flex items-center gap-3 bg-emerald-50 border-emerald-200">
        <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
        <div>
          <div className="font-bold text-emerald-800">Geliefert!</div>
          <div className="text-sm text-emerald-600">Deine Bestellung wurde zugestellt.</div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        {eta !== null && eta !== undefined && (
          <EtaRing etaMin={Math.max(0, eta)} totalMin={estimatedMinutes ?? 45} />
        )}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Geschätzte Lieferzeit</span>
          </div>
          {eta !== null && eta !== undefined && (
            <div className="text-lg font-black">
              {eta <= 0 ? 'Gleich da!' : `Noch ca. ${eta} Minuten`}
            </div>
          )}
          {data?.driverName && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Bike className="h-3 w-3" />
              <span>{data.driverName} ist unterwegs</span>
            </div>
          )}
          {data?.driverDistanceKm !== null && data?.driverDistanceKm !== undefined && (
            <ProximityPulse distKm={data.driverDistanceKm} />
          )}
          {!data?.driverDistanceKm && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Zap className="h-3 w-3 text-amber-400" />
              <span>Live-Updates alle 60 Sekunden</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
