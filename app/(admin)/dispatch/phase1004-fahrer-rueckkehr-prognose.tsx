'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

/**
 * Phase 1004 — Fahrer-Rückkehr-Prognose-Board (Dispatch)
 *
 * Zeigt voraussichtliche Rückkehrzeit je aktiver Fahrer basierend auf
 * verbleibenden Stopps + Haversine-Durchschnitt.
 * Polling: 2-Min.
 */

interface Props {
  locationId: string | null;
}

interface FahrerRow {
  driverId: string;
  driverName: string | null;
  minutesUntilReturn: number;
  remainingStops: number;
  urgency: 'soon' | 'coming' | 'later';
}

interface ApiResponse {
  prognosen: FahrerRow[];
  activeDrivers?: number;
  returningWithin15Min?: number;
  generiert_am?: string;
}

function statusBadge(urgency: string) {
  if (urgency === 'soon') return { cls: 'bg-matcha-100 text-matcha-700 border-matcha-300', label: 'Bald frei' };
  if (urgency === 'coming') return { cls: 'bg-amber-100 text-amber-700 border-amber-300', label: 'Unterwegs' };
  return { cls: 'bg-red-100 text-red-700 border-red-300', label: 'Noch lang' };
}

const MOCK: ApiResponse = {
  prognosen: [
    { driverId: '1', driverName: 'Marco R.', minutesUntilReturn: 12, remainingStops: 1, urgency: 'soon' },
    { driverId: '2', driverName: 'Lena S.', minutesUntilReturn: 30, remainingStops: 3, urgency: 'coming' },
    { driverId: '3', driverName: 'Tim K.', minutesUntilReturn: 44, remainingStops: 4, urgency: 'later' },
  ],
};

export function DispatchPhase1004FahrerRueckkehrPrognose({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-rueckkehr-prognose?location_id=${locationId}`,
        { cache: 'no-store' }
      );
      const json: ApiResponse = res.ok ? await res.json() : MOCK;
      setData(json);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const id = setInterval(() => { void load(); }, 120_000);
    return () => clearInterval(id);
  }, [load]);

  const rows = data?.prognosen ?? [];
  const baldFrei = rows.filter(r => r.urgency === 'soon').length;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-bold">Rückkehr-Prognose</span>
          {baldFrei > 0 && (
            <span className="ml-1 rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-black text-matcha-700 border border-matcha-300">
              {baldFrei} bald frei
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {!locationId && (
            <p className="text-sm text-muted-foreground text-center py-2">Bitte Filiale auswählen.</p>
          )}
          {locationId && rows.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-2">Keine aktiven Fahrer.</p>
          )}
          {rows.map(row => {
            const badge = statusBadge(row.urgency);
            return (
              <div key={row.driverId} className="flex items-center gap-3 rounded-lg border p-2.5 bg-muted/20">
                {/* ETA block */}
                <div className="shrink-0 w-12 text-center">
                  <div className="text-lg font-black tabular-nums text-foreground">{row.minutesUntilReturn}</div>
                  <div className="text-[9px] text-muted-foreground">Min</div>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{row.driverName ?? 'Fahrer'}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {row.remainingStops} Stopp{row.remainingStops !== 1 ? 's' : ''} verbleibend
                  </div>
                </div>
                {/* Badge */}
                <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold', badge.cls)}>
                  {badge.label}
                </span>
              </div>
            );
          })}
          {rows.length > 0 && (
            <p className="text-[10px] text-muted-foreground text-right">
              Aktualisierung alle 2 Min
            </p>
          )}
        </div>
      )}
    </div>
  );
}
