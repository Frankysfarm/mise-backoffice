'use client';

import { useEffect, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

type LoadLevel = 'ok' | 'busy' | 'overloaded';

interface ZoneLoad {
  zone: string;
  activeOrders: number;
  pendingOrders: number;
  availableDrivers: number;
  assignedDrivers: number;
  loadLevel: LoadLevel;
  ratioOrdersPerDriver: number | null;
}

interface LoadSummary {
  totalActiveOrders: number;
  totalPendingOrders: number;
  totalAvailableDrivers: number;
  overloadedZones: number;
}

interface ApiResponse {
  ok: boolean;
  zones: ZoneLoad[];
  summary: LoadSummary;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const loadStyle: Record<LoadLevel, { row: string; badge: string; label: string; bar: string; dot: string }> = {
  ok:         { row: 'bg-green-50',  badge: 'bg-green-100 text-green-700',  label: 'Normal',      bar: 'bg-green-500',  dot: 'bg-green-500' },
  busy:       { row: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-700',  label: 'Ausgelastet', bar: 'bg-amber-400',  dot: 'bg-amber-400' },
  overloaded: { row: 'bg-red-50',    badge: 'bg-red-100 text-red-700',      label: 'Überlastet',  bar: 'bg-red-500',    dot: 'bg-red-500 animate-pulse' },
};

export function DispatchZonenAuslastungLive({ locationId }: Props) {
  const [zones, setZones] = useState<ZoneLoad[]>([]);
  const [summary, setSummary] = useState<LoadSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/zonen-auslastung-realtime?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        setZones(d.zones ?? []);
        setSummary(d.summary ?? null);
        setLastUpdate(d.generatedAt ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;
  if (!loading && zones.length === 0) return null;

  const overloaded = zones.filter((z) => z.loadLevel === 'overloaded').length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-3 border-b border-stone-100 hover:bg-stone-50 transition text-left"
      >
        <MapPin className="h-4 w-4 text-violet-500 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Zonen-Auslastung Live</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {overloaded > 0 && (
          <span className="ml-auto rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-[10px] font-bold animate-pulse">
            {overloaded} überlastet
          </span>
        )}
        {!loading && overloaded === 0 && summary && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            {summary.totalActiveOrders + summary.totalPendingOrders} Bestellungen · {summary.totalAvailableDrivers} Fahrer frei
          </span>
        )}
        <span className="ml-1 text-stone-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div>
          {/* Summary Row */}
          {summary && (
            <div className="flex gap-4 px-5 py-2 border-b border-stone-100 bg-stone-50 text-[11px] text-stone-500 font-medium">
              <span>{summary.totalActiveOrders} aktiv</span>
              <span>{summary.totalPendingOrders} ausstehend</span>
              <span>{summary.totalAvailableDrivers} Fahrer verfügbar</span>
              {lastUpdate && (
                <span className="ml-auto">
                  {new Date(lastUpdate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
          )}

          {/* Zone Grid */}
          <div className="divide-y divide-stone-100">
            {zones.map((z) => {
              const s = loadStyle[z.loadLevel];
              const totalOrders = z.activeOrders + z.pendingOrders;
              const totalDrivers = z.availableDrivers + z.assignedDrivers;
              const barPct = totalDrivers > 0
                ? Math.min(100, Math.round((totalOrders / (totalDrivers * 3)) * 100))
                : totalOrders > 0 ? 100 : 0;

              return (
                <div key={z.zone} className={cn('px-5 py-3 flex items-center gap-3', s.row)}>
                  {/* Zone Dot + Name */}
                  <div className="flex items-center gap-2 w-20 shrink-0">
                    <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', s.dot)} />
                    <span className="font-bold text-sm">Zone {z.zone}</span>
                  </div>

                  {/* Bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', s.badge)}>
                        {s.label}
                      </span>
                      <span className="text-[11px] text-stone-500">
                        {z.activeOrders} aktiv · {z.pendingOrders} ausstehend
                      </span>
                    </div>
                    <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', s.bar)}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Drivers */}
                  <div className="text-right shrink-0 min-w-[80px]">
                    <div className="font-mono text-sm font-bold tabular-nums">
                      {z.availableDrivers} <span className="text-[10px] text-stone-400 font-normal">frei</span>
                    </div>
                    <div className="text-[10px] text-stone-500">
                      {z.assignedDrivers} aktiv
                      {z.ratioOrdersPerDriver !== null && (
                        <span className="ml-1">· {z.ratioOrdersPerDriver}×</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
