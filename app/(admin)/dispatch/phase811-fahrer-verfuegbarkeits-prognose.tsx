'use client';

import { useEffect, useState } from 'react';
import { Users, Clock, CheckCircle } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface FahrerVerfuegbarkeit {
  driverId: string;
  name: string;
  status: 'frei' | 'unterwegs' | 'pause';
  freiInMin: number | null;
  aktiveTour: string | null;
  verbleibendeStopps: number;
}

interface VerfuegbarkeitData {
  fahrer: FahrerVerfuegbarkeit[];
  naechstFrei: number | null;
  freiSofort: number;
  gesamt: number;
  aktualisiert: string;
}

const MOCK: VerfuegbarkeitData = {
  freiSofort: 1,
  gesamt: 4,
  naechstFrei: 8,
  aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  fahrer: [
    { driverId: '1', name: 'Max M.', status: 'frei', freiInMin: 0, aktiveTour: null, verbleibendeStopps: 0 },
    { driverId: '2', name: 'Lisa K.', status: 'unterwegs', freiInMin: 8, aktiveTour: 'Tour 3', verbleibendeStopps: 2 },
    { driverId: '3', name: 'Tom B.', status: 'unterwegs', freiInMin: 15, aktiveTour: 'Tour 1', verbleibendeStopps: 3 },
    { driverId: '4', name: 'Anna S.', status: 'pause', freiInMin: 5, aktiveTour: null, verbleibendeStopps: 0 },
  ],
};

export function DispatchPhase811FahrerVerfuegbarkeitsPrognose({ locationId }: Props) {
  const [data, setData] = useState<VerfuegbarkeitData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!locationId) {
      setData(MOCK);
      setLoading(false);
      return;
    }
    try {
      const [batchRes, driverRes] = await Promise.all([
        fetch(`/api/delivery/admin/active-tours?location_id=${locationId}`, { cache: 'no-store' }),
        fetch(`/api/delivery/admin/drivers?location_id=${locationId}`, { cache: 'no-store' }),
      ]);

      type BatchRow = { id: string; driver_id: string; stop_count: number; stops?: unknown[]; driverName?: string; started_at?: string };
      type DriverRow = { id: string; vorname?: string; nachname?: string; is_online?: boolean };

      let batches: BatchRow[] = [];
      let drivers: DriverRow[] = [];

      if (batchRes.ok) {
        const j = await batchRes.json();
        batches = Array.isArray(j.batches) ? j.batches : Array.isArray(j) ? j : [];
      }
      if (driverRes.ok) {
        const j = await driverRes.json();
        drivers = Array.isArray(j.drivers) ? j.drivers : Array.isArray(j) ? j : [];
      }

      const activeBatchByDriver = new Map<string, BatchRow>();
      for (const b of batches) {
        if (b.driver_id) activeBatchByDriver.set(b.driver_id, b);
      }

      const AVG_MIN_PER_STOP = 5;

      const fahrerList: FahrerVerfuegbarkeit[] = drivers.map((d) => {
        const name = `${d.vorname ?? ''} ${(d.nachname ?? '').slice(0, 1)}.`.trim() || 'Fahrer';
        const batch = activeBatchByDriver.get(d.id);
        if (batch) {
          const stopsArr = Array.isArray(batch.stops) ? batch.stops : [];
          const remaining = stopsArr.filter((s: unknown) => {
            const stop = s as Record<string, unknown>;
            return !stop.geliefert_am;
          }).length || Math.max(1, (batch.stop_count ?? 2) - 1);
          const freiInMin = Math.round(remaining * AVG_MIN_PER_STOP);
          return {
            driverId: d.id,
            name,
            status: 'unterwegs' as const,
            freiInMin,
            aktiveTour: batch.id.slice(-6).toUpperCase(),
            verbleibendeStopps: remaining,
          };
        }
        return {
          driverId: d.id,
          name,
          status: d.is_online ? ('frei' as const) : ('pause' as const),
          freiInMin: d.is_online ? 0 : 5,
          aktiveTour: null,
          verbleibendeStopps: 0,
        };
      });

      fahrerList.sort((a, b) => (a.freiInMin ?? 999) - (b.freiInMin ?? 999));

      const freiSofort = fahrerList.filter((f) => f.status === 'frei').length;
      const unterwegs = fahrerList.filter((f) => f.status === 'unterwegs');
      const naechstFrei =
        unterwegs.length > 0
          ? Math.min(...unterwegs.map((f) => f.freiInMin ?? 99))
          : null;

      setData({
        fahrer: fahrerList,
        freiSofort,
        gesamt: fahrerList.length,
        naechstFrei,
        aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      });
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="h-20 animate-pulse bg-muted rounded" />
      </div>
    );
  }
  if (!data) return null;

  const statusColor = (f: FahrerVerfuegbarkeit) =>
    f.status === 'frei'
      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
      : f.status === 'unterwegs'
      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700';

  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold">Fahrer-Verfügbarkeits-Prognose</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{data.aktualisiert}</span>
      </div>

      {/* KPI-Zeile */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-2 py-1.5 text-center">
          <div className="text-lg font-black tabular-nums text-emerald-700 dark:text-emerald-300">
            {data.freiSofort}
          </div>
          <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">Sofort frei</div>
        </div>
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-2 py-1.5 text-center">
          <div className="text-lg font-black tabular-nums text-blue-700 dark:text-blue-300">
            {data.gesamt - data.freiSofort}
          </div>
          <div className="text-[9px] text-blue-600 dark:text-blue-400 font-medium">Unterwegs</div>
        </div>
        <div className="rounded-lg bg-muted px-2 py-1.5 text-center">
          <div className="text-lg font-black tabular-nums text-foreground">
            {data.naechstFrei !== null ? `${data.naechstFrei}m` : '–'}
          </div>
          <div className="text-[9px] text-muted-foreground font-medium">Nächst frei</div>
        </div>
      </div>

      {/* Fahrer-Liste */}
      <div className="space-y-1.5">
        {data.fahrer.slice(0, 5).map((f) => (
          <div
            key={f.driverId}
            className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 bg-background"
          >
            <div className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold border ${statusColor(f)}`}>
              {f.status === 'frei' ? 'FREI' : f.status === 'unterwegs' ? 'TOUR' : 'PAUSE'}
            </div>
            <span className="flex-1 text-xs font-medium truncate">{f.name}</span>
            {f.status === 'frei' ? (
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : (
              <div className="flex items-center gap-1 shrink-0">
                {f.status === 'unterwegs' && f.verbleibendeStopps > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {f.verbleibendeStopps} Stopps
                  </span>
                )}
                <div className="flex items-center gap-0.5 text-[10px] font-bold tabular-nums text-foreground">
                  <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                  ~{f.freiInMin}m
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[9px] text-muted-foreground">30s-Update · ETA basiert auf Stopp-Anzahl</p>
    </div>
  );
}
