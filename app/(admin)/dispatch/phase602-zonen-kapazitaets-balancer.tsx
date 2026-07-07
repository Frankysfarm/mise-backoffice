'use client';

import { useEffect, useState } from 'react';
import { MapPin, AlertTriangle, CheckCircle2, ArrowRightLeft } from 'lucide-react';

type ZoneInfo = {
  zone: string;
  activeDrivers: number;
  pendingOrders: number;
  ratio: number; // orders per driver
  status: 'ok' | 'overloaded' | 'underloaded';
};

export function DispatchPhase602ZonenKapazitaetsBalancer({
  locationId,
}: {
  locationId: string | null;
}) {
  const [zones, setZones] = useState<ZoneInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams();
        if (locationId) params.set('location_id', locationId);
        const res = await fetch(
          `/api/delivery/admin/tour-effizienz-snapshot?${params}`,
          { cache: 'no-store' },
        );
        // Wenn Endpunkt keine Zonen-Daten hat, nutzen wir Mock-Struktur
        // die aus Batch-Daten abgeleitet werden können
        const [analyticsRes] = await Promise.all([
          fetch(
            `/api/delivery/admin/analytics?${locationId ? `location_id=${locationId}&` : ''}period=today`,
            { cache: 'no-store' },
          ),
        ]);
        const analytics = analyticsRes.ok ? await analyticsRes.json() : null;

        // Zonen aus Analytics oder Mock
        const rawZones: ZoneInfo[] = (analytics?.zones ?? []).map((z: any) => {
          const activeDrivers = z.active_drivers ?? z.activeDrivers ?? 1;
          const pendingOrders = z.pending_orders ?? z.pendingOrders ?? 0;
          const ratio = activeDrivers > 0 ? pendingOrders / activeDrivers : pendingOrders;
          return {
            zone: z.zone ?? z.name ?? 'Zone',
            activeDrivers,
            pendingOrders,
            ratio,
            status: ratio >= 3 ? 'overloaded' : ratio === 0 && activeDrivers > 0 ? 'underloaded' : 'ok',
          };
        });

        if (rawZones.length === 0) {
          // Keine Zonen-Daten verfügbar — keine Anzeige
          setZones([]);
        } else {
          setZones(rawZones);
        }
      } catch {
        setZones([]);
      } finally {
        setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (loading || zones.length < 2) return null;

  const overloaded = zones.filter((z) => z.status === 'overloaded');
  const underloaded = zones.filter((z) => z.status === 'underloaded');

  return (
    <div className="rounded-xl bg-white border border-stone-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">
          Zonen-Kapazitäts-Balancer
        </span>
        {overloaded.length > 0 && (
          <span className="ml-auto flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-2 py-0.5 text-[10px] font-bold text-red-700">
            <AlertTriangle className="w-3 h-3" />
            {overloaded.length} überlastet
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {zones.map((z) => {
          const pct = Math.min(100, Math.round(z.ratio * 33));
          const color = z.status === 'overloaded'
            ? 'border-red-200 bg-red-50'
            : z.status === 'underloaded'
              ? 'border-amber-200 bg-amber-50'
              : 'border-matcha-200 bg-matcha-50';
          const barColor = z.status === 'overloaded' ? 'bg-red-500'
            : z.status === 'underloaded' ? 'bg-amber-400' : 'bg-matcha-500';
          const textColor = z.status === 'overloaded' ? 'text-red-700'
            : z.status === 'underloaded' ? 'text-amber-700' : 'text-matcha-700';
          return (
            <div key={z.zone} className={`rounded-xl border px-3 py-2.5 ${color}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-stone-600 truncate">{z.zone}</span>
                {z.status === 'overloaded' ? (
                  <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                ) : z.status === 'ok' ? (
                  <CheckCircle2 className="w-3 h-3 text-matcha-500 shrink-0" />
                ) : (
                  <ArrowRightLeft className="w-3 h-3 text-amber-500 shrink-0" />
                )}
              </div>
              <div className={`text-base font-black tabular-nums ${textColor}`}>
                {z.pendingOrders}
                <span className="text-[9px] font-semibold text-stone-400 ml-1">
                  / {z.activeDrivers} Fahrer
                </span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-stone-200 overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="text-[9px] text-stone-400 mt-0.5">
                {z.ratio.toFixed(1)} Auftr./Fahrer
              </div>
            </div>
          );
        })}
      </div>

      {overloaded.length > 0 && underloaded.length > 0 && (
        <div className="mt-3 flex items-start gap-2 p-2 rounded-lg bg-blue-50 border border-blue-100">
          <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-blue-700 font-medium">
            Empfehlung: Fahrer von{' '}
            <strong>{underloaded.map((z) => z.zone).join(', ')}</strong> nach{' '}
            <strong>{overloaded.map((z) => z.zone).join(', ')}</strong> umverteilen
          </p>
        </div>
      )}
    </div>
  );
}
