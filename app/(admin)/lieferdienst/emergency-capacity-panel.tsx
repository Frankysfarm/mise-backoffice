'use client';

/**
 * EmergencyCapacityPanel — Phase 410
 * Echtzeit-Kachel für offene Kapazitäts-Notfallevents.
 * Zeigt: offene Events, Standby-Pool-Größe, Severitäts-Badges, Lösen-Button.
 * API: GET /api/delivery/admin/emergency-capacity?location_id=...
 */

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Users, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EmergencyEvent {
  id: string;
  severity: 'warning' | 'critical';
  activeDrivers: number;
  requiredDrivers: number;
  capacityGap: number;
  pendingOrders: number;
  standbyNotified: number;
  detectedAt: string;
}

interface Dashboard {
  openEmergencies: EmergencyEvent[];
  standbyPoolSize: number;
  currentCapacity: {
    activeDrivers: number;
    requiredDrivers: number;
    capacityGap: number;
    severity: 'warning' | 'critical' | null;
  };
  last7DaysSummary: {
    totalEvents: number;
    avgActivated: number;
    resolutionRate: number;
  };
}

function ageLabel(iso: string): string {
  const ageMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (ageMin < 1) return 'jetzt';
  if (ageMin < 60) return `vor ${ageMin} Min`;
  return `vor ${Math.floor(ageMin / 60)} Std`;
}

export function EmergencyCapacityPanel({ locationId }: { locationId: string | null }) {
  const [data, setData]       = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/admin/emergency-capacity?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) setData(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  async function handleResolve(eventId: string) {
    if (!locationId) return;
    setResolving(eventId);
    try {
      await fetch('/api/delivery/admin/emergency-capacity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve',
          location_id: locationId,
          event_id: eventId,
          resolution_type: 'manual',
        }),
      });
      await load();
    } catch { /* silent */ }
    finally { setResolving(null); }
  }

  const hasCritical = data?.openEmergencies.some((e) => e.severity === 'critical');

  return (
    <Card className={cn('overflow-hidden', hasCritical && 'border-red-400 shadow-red-100 shadow-md')}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center gap-2 border-b px-4 py-2.5 text-left"
      >
        <AlertTriangle className={cn('h-4 w-4 shrink-0', hasCritical ? 'text-red-600' : 'text-amber-500')} />
        <span className="text-xs font-bold uppercase tracking-wider">Kapazitäts-Notfall</span>
        {data?.openEmergencies.length ? (
          <Badge className={cn('ml-1', hasCritical ? 'bg-red-600 text-white' : 'bg-amber-400 text-white')}>
            {data.openEmergencies.length} offen
          </Badge>
        ) : (
          <Badge variant="secondary" className="ml-1 text-[10px]">OK</Badge>
        )}
        <ChevronDown className={cn('ml-auto h-4 w-4 transition-transform text-muted-foreground', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {loading && <div className="text-xs text-muted-foreground text-center py-3">Lade…</div>}

          {!loading && data && (
            <>
              {/* Kapazitätsstatus */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Aktive Fahrer', value: data.currentCapacity.activeDrivers },
                  { label: 'Benötigt', value: data.currentCapacity.requiredDrivers },
                  { label: 'Standby-Pool', value: data.standbyPoolSize },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
                    <div className="text-lg font-bold tabular-nums">{value}</div>
                    <div className="text-[10px] text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>

              {/* Offene Events */}
              {data.openEmergencies.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Offene Events
                  </div>
                  {data.openEmergencies.map((ev) => (
                    <div
                      key={ev.id}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 flex items-start gap-3',
                        ev.severity === 'critical'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-amber-50 border-amber-200',
                      )}
                    >
                      <Zap className={cn('mt-0.5 h-4 w-4 shrink-0', ev.severity === 'critical' ? 'text-red-600' : 'text-amber-600')} />
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            'text-[10px] font-black uppercase rounded-full px-2 py-0.5',
                            ev.severity === 'critical' ? 'bg-red-600 text-white' : 'bg-amber-400 text-white',
                          )}>
                            {ev.severity === 'critical' ? 'KRITISCH' : 'WARNUNG'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{ageLabel(ev.detectedAt)}</span>
                        </div>
                        <div className="text-xs">
                          <span className="font-semibold">{ev.capacityGap} Fahrer</span>
                          {' '}fehlen · {ev.activeDrivers}/{ev.requiredDrivers} verfügbar
                          {ev.standbyNotified > 0 && (
                            <span className="text-muted-foreground ml-1">· {ev.standbyNotified} Standby benachrichtigt</span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {ev.pendingOrders} offene Bestellungen
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] shrink-0"
                        disabled={resolving === ev.id}
                        onClick={() => handleResolve(ev.id)}
                      >
                        {resolving === ev.id ? '…' : 'Lösen'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-matcha-50 border border-matcha-200 px-3 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-matcha-600 shrink-0" />
                  <span className="text-xs text-matcha-700 font-medium">Kein aktiver Kapazitäts-Notfall</span>
                </div>
              )}

              {/* 7-Tage-Zusammenfassung */}
              {data.last7DaysSummary.totalEvents > 0 && (
                <div className="border-t pt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-sm font-bold">{data.last7DaysSummary.totalEvents}</div>
                    <div className="text-[10px] text-muted-foreground">Events 7 Tage</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold">{data.last7DaysSummary.avgActivated.toFixed(1)}</div>
                    <div className="text-[10px] text-muted-foreground">Ø aktiviert</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold">{Math.round(data.last7DaysSummary.resolutionRate * 100)}%</div>
                    <div className="text-[10px] text-muted-foreground">Auflösungsrate</div>
                  </div>
                </div>
              )}
            </>
          )}

          {!loading && !data && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/30 border px-3 py-2.5">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">Kein Standort ausgewählt</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
