'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Radio, Bike, Car, Loader2 } from 'lucide-react';

interface DriverSignalInfo {
  driverId: string;
  driverName: string;
  vehicle: string | null;
  state: string;
  lastSignal: string | null;
  lastSignalAt: string | null;
}

interface GetSignalsResponse {
  drivers: DriverSignalInfo[];
}

interface PostSignalResponse {
  ok: boolean;
  state: string;
  driver: { id: string; name: string };
}

interface Props {
  locationId: string | null;
}

const STATE_STYLES: Record<string, string> = {
  available: 'bg-matcha-100 text-matcha-700 border-matcha-200',
  break:     'bg-amber-100 text-amber-700 border-amber-200',
  offline:   'bg-muted/50 text-muted-foreground border-border',
};

const STATE_LABELS: Record<string, string> = {
  available: 'Verfügbar',
  break:     'Pause',
  offline:   'Offline',
};

const SIGNAL_LABELS: Record<string, string> = {
  available: 'Verfügbar',
  break:     'Pause',
  end:       'Ende',
};

function timeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'gerade eben';
  if (diffMin === 1) return 'vor 1 Min';
  if (diffMin < 60) return `vor ${diffMin} Min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH === 1) return 'vor 1 Std';
  return `vor ${diffH} Std`;
}

function VehicleIcon({ vehicle }: { vehicle: string | null }) {
  if (vehicle === 'car') return <Car className="size-3.5 shrink-0 text-muted-foreground" />;
  return <Bike className="size-3.5 shrink-0 text-muted-foreground" />;
}

export function DispatchFahrerVerfuegbarkeitsSignalPanel({ locationId }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [drivers, setDrivers] = useState<DriverSignalInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // driverId

  const fetchDrivers = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/driver-availability-signal?location_id=${locationId}`);
      if (res.ok) {
        const data = (await res.json()) as GetSignalsResponse;
        setDrivers(data.drivers);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void fetchDrivers();
    const interval = setInterval(() => { void fetchDrivers(); }, 30_000);
    return () => clearInterval(interval);
  }, [fetchDrivers]);

  async function sendSignal(driverId: string, signal: 'available' | 'break' | 'end') {
    if (actionLoading) return;
    setActionLoading(driverId);
    try {
      const res = await fetch('/api/delivery/admin/driver-availability-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, signal, location_id: locationId }),
      });
      if (res.ok) {
        const data = (await res.json()) as PostSignalResponse;
        setDrivers((prev: DriverSignalInfo[]) =>
          prev.map((d: DriverSignalInfo) =>
            d.driverId === driverId
              ? { ...d, state: data.state, lastSignal: signal, lastSignalAt: new Date().toISOString() }
              : d,
          ),
        );
      }
    } catch {
      // silently ignore
    } finally {
      setActionLoading(null);
    }
  }

  if (!locationId) return null;

  return (
    <Card className="mb-3 overflow-hidden border border-border bg-background">
      {/* Header */}
      <div
        className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-muted/30"
        onClick={() => setCollapsed((v: boolean) => !v)}
      >
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Fahrer-Verfügbarkeit</span>
          {!loading && (
            <Badge variant="outline" className="text-xs">
              {drivers.filter((d: DriverSignalInfo) => d.state === 'available').length} verfügbar
            </Badge>
          )}
        </div>
        {collapsed
          ? <ChevronDown className="size-4 text-muted-foreground" />
          : <ChevronUp className="size-4 text-muted-foreground" />
        }
      </div>

      {!collapsed && (
        <div className="border-t border-border px-4 pb-3 pt-2">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : drivers.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Keine Fahrer gefunden
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {drivers.map((driver: DriverSignalInfo) => {
                const isUpdating = actionLoading === driver.driverId;
                const stateStyle = STATE_STYLES[driver.state] ?? STATE_STYLES.offline;
                const stateLabel = STATE_LABELS[driver.state] ?? 'Offline';

                return (
                  <div
                    key={driver.driverId}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/10 px-3 py-2"
                  >
                    {/* Name + vehicle */}
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <VehicleIcon vehicle={driver.vehicle} />
                      <span className="truncate text-sm font-medium">{driver.driverName}</span>
                    </div>

                    {/* State badge */}
                    <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', stateStyle)}>
                      {stateLabel}
                    </span>

                    {/* Last signal */}
                    {driver.lastSignal && driver.lastSignalAt && (
                      <span className="text-xs text-muted-foreground">
                        {SIGNAL_LABELS[driver.lastSignal] ?? driver.lastSignal} · {timeAgo(driver.lastSignalAt)}
                      </span>
                    )}

                    {/* Quick-action buttons */}
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={isUpdating || driver.state === 'available'}
                        onClick={() => void sendSignal(driver.driverId, 'available')}
                        className={cn(
                          'rounded border px-2 py-0.5 text-xs font-medium transition-opacity',
                          'border-matcha-200 bg-matcha-50 text-matcha-700 hover:bg-matcha-100',
                          (isUpdating || driver.state === 'available') && 'opacity-40',
                        )}
                      >
                        {isUpdating ? <Loader2 className="inline size-3 animate-spin" /> : 'Verfügbar'}
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating || driver.state === 'break'}
                        onClick={() => void sendSignal(driver.driverId, 'break')}
                        className={cn(
                          'rounded border px-2 py-0.5 text-xs font-medium transition-opacity',
                          'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
                          (isUpdating || driver.state === 'break') && 'opacity-40',
                        )}
                      >
                        Pause
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating || driver.state === 'offline'}
                        onClick={() => void sendSignal(driver.driverId, 'end')}
                        className={cn(
                          'rounded border px-2 py-0.5 text-xs font-medium transition-opacity',
                          'border-border bg-muted/50 text-muted-foreground hover:bg-muted',
                          (isUpdating || driver.state === 'offline') && 'opacity-40',
                        )}
                      >
                        Ende
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
