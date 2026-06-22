'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ErreichbarkeitDashboard } from '@/lib/delivery/fahrer-erreichbarkeit';

interface Props {
  locationId: string | null;
}

const POLL_MS = 3 * 60 * 1000; // 3 Min

function ampelColor(antwort: string) {
  if (antwort === 'bestätigt') return 'text-matcha-600 bg-matcha-50 border-matcha-200';
  if (antwort === 'abgelehnt') return 'text-red-600 bg-red-50 border-red-200';
  return 'text-amber-600 bg-amber-50 border-amber-200';
}

function ampelIcon(antwort: string) {
  if (antwort === 'bestätigt') return <CheckCircle className="w-3.5 h-3.5 text-matcha-500" />;
  if (antwort === 'abgelehnt') return <XCircle className="w-3.5 h-3.5 text-red-500" />;
  return <Clock className="w-3.5 h-3.5 text-amber-500" />;
}

function ampelLabel(antwort: string) {
  if (antwort === 'bestätigt') return 'Bestätigt';
  if (antwort === 'abgelehnt') return 'Abgelehnt';
  return 'Keine Antwort';
}

function formatTime(iso: string | null) {
  if (!iso) return '–';
  return new Date(iso).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  });
}

export function FahrerErreichbarkeitsPanel({ locationId }: Props) {
  const [data, setData]       = useState<ErreichbarkeitDashboard | null>(null);
  const [pinging, setPinging] = useState(false);
  const [open, setOpen]       = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-erreichbarkeit?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) setData(await res.json() as ErreichbarkeitDashboard);
    } catch {
      // still polling
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(iv);
  }, [load]);

  const handlePingAll = async () => {
    if (!locationId || pinging) return;
    setPinging(true);
    try {
      await fetch('/api/delivery/admin/fahrer-erreichbarkeit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ping', location_id: locationId }),
      });
      await load();
    } finally {
      setPinging(false);
    }
  };

  if (!locationId || data === null) return null;
  if (data.totalPinged === 0 && !data.nextShiftStart) return null;

  const confirmPct = data.totalPinged > 0
    ? Math.round(data.confirmRate * 100)
    : 0;

  const overallStatus = data.totalPinged === 0
    ? 'idle'
    : confirmPct >= 80
    ? 'gut'
    : confirmPct >= 50
    ? 'mittel'
    : 'kritisch';

  const headerBg = overallStatus === 'gut'
    ? 'bg-matcha-50 border-matcha-200'
    : overallStatus === 'mittel'
    ? 'bg-amber-50 border-amber-200'
    : overallStatus === 'kritisch'
    ? 'bg-red-50 border-red-200'
    : 'bg-muted border-border';

  return (
    <Card className={`border ${headerBg} overflow-hidden`}>
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        onClick={() => setOpen((v: boolean) => !v)}
      >
        <Bell className="w-4 h-4 shrink-0 text-violet-600" />
        <span className="font-semibold text-sm flex-1">Fahrer-Erreichbarkeit</span>
        {data.nextShiftStart && (
          <span className="text-xs text-muted-foreground mr-2">
            Nächste Schicht {formatTime(data.nextShiftStart)}
          </span>
        )}
        {/* Ampel-Summary */}
        {data.totalPinged > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-bold mr-1">
            <span className="text-matcha-600">{data.bestätigt}✓</span>
            <span className="text-amber-600">{data.keineAntwort}?</span>
            <span className="text-red-600">{data.abgelehnt}✗</span>
          </div>
        )}
        <span className="text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI-Row */}
          {data.totalPinged > 0 && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-matcha-200 bg-matcha-50 p-2">
                <div className="text-lg font-black text-matcha-700">{data.bestätigt}</div>
                <div className="text-[10px] text-matcha-600">Bestätigt</div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                <div className="text-lg font-black text-amber-700">{data.keineAntwort}</div>
                <div className="text-[10px] text-amber-600">Keine Antwort</div>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-2">
                <div className="text-lg font-black text-red-700">{data.abgelehnt}</div>
                <div className="text-[10px] text-red-600">Abgelehnt</div>
              </div>
            </div>
          )}

          {/* Bestätigungs-Balken */}
          {data.totalPinged > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-medium">
                <span className="text-muted-foreground">Bestätigungsrate</span>
                <span className={confirmPct >= 80 ? 'text-matcha-600' : confirmPct >= 50 ? 'text-amber-600' : 'text-red-600'}>
                  {confirmPct}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    confirmPct >= 80 ? 'bg-matcha-500' : confirmPct >= 50 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${confirmPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Fahrer-Liste */}
          {data.fahrer.length > 0 ? (
            <div className="divide-y rounded-lg border overflow-hidden">
              {data.fahrer.map((f) => (
                <div
                  key={f.driverId}
                  className={`flex items-center gap-2 px-3 py-2 text-sm border-l-2 ${ampelColor(f.antwort)}`}
                >
                  {ampelIcon(f.antwort)}
                  <span className="flex-1 font-medium truncate">{f.driverName}</span>
                  {f.schichtStart && (
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatTime(f.schichtStart)}
                    </span>
                  )}
                  <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 border ${ampelColor(f.antwort)}`}>
                    {ampelLabel(f.antwort)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              Noch keine Fahrer für die nächste Schicht angepingt.
            </p>
          )}

          {/* Aktionen */}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs gap-1"
              onClick={handlePingAll}
              disabled={pinging}
            >
              <Bell className="w-3 h-3" />
              {pinging ? 'Pinge...' : 'Alle pingen'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs gap-1"
              onClick={() => void load()}
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground text-right">
            Aktualisiert {formatTime(data.lastUpdated)}
          </p>
        </div>
      )}
    </Card>
  );
}
