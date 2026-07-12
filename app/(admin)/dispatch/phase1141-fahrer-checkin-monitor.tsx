'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, UserCheck, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1141 — Fahrer-Check-In-Monitor (Dispatch)
// Welche Fahrer haben sich heute eingeloggt vs. geplant + Verspätungs-Alert

interface Props {
  locationId: string | null;
}

type CheckInStatus = 'eingeloggt' | 'verpaetet' | 'nicht_erschienen' | 'nicht_geplant';

interface FahrerCheckIn {
  fahrer_id: string;
  fahrer_name: string;
  geplanter_start: string | null;
  tatsaechlicher_start: string | null;
  verpaetung_min: number;
  status: CheckInStatus;
}

interface ApiResponse {
  fahrer: FahrerCheckIn[];
  eingeloggt: number;
  verpaetet: number;
  nicht_erschienen: number;
  location_id: string;
  generiert_am: string;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max Mustermann', geplanter_start: null, tatsaechlicher_start: new Date().toISOString(), verpaetung_min: 3, status: 'eingeloggt' },
    { fahrer_id: 'f2', fahrer_name: 'Anna Schmidt', geplanter_start: null, tatsaechlicher_start: null, verpaetung_min: 24, status: 'verpaetet' },
    { fahrer_id: 'f3', fahrer_name: 'Karim Bensalem', geplanter_start: null, tatsaechlicher_start: null, verpaetung_min: 180, status: 'nicht_erschienen' },
    { fahrer_id: 'f4', fahrer_name: 'Laura Meier', geplanter_start: null, tatsaechlicher_start: new Date().toISOString(), verpaetung_min: 0, status: 'nicht_geplant' },
  ],
  eingeloggt: 2,
  verpaetet: 1,
  nicht_erschienen: 1,
  location_id: 'mock',
  generiert_am: new Date().toISOString(),
};

const STATUS_LABEL: Record<CheckInStatus, string> = {
  eingeloggt: 'Eingeloggt',
  verpaetet: 'Verspätet',
  nicht_erschienen: 'Nicht erschienen',
  nicht_geplant: 'Ungeplant',
};

const STATUS_COLOR: Record<CheckInStatus, string> = {
  eingeloggt: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  verpaetet: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  nicht_erschienen: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  nicht_geplant: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
};

function formatTime(iso: string | null): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function DispatchPhase1141FahrerCheckInMonitor({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-checkin-monitor?location_id=${encodeURIComponent(locationId)}`);
      if (!res.ok) throw new Error('fetch');
      setData(await res.json() as ApiResponse);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const hasAlert = (data?.nicht_erschienen ?? 0) > 0 || (data?.verpaetet ?? 0) > 0;
  const headerBg = hasAlert
    ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
    : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20';
  const headerText = hasAlert
    ? 'text-amber-700 dark:text-amber-300'
    : 'text-emerald-700 dark:text-emerald-300';

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', headerBg)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {hasAlert
            ? <AlertTriangle className={cn('h-4 w-4', headerText)} />
            : <UserCheck className={cn('h-4 w-4', headerText)} />}
          <span className={cn('font-bold text-sm', headerText)}>Fahrer Check-In Monitor</span>
          {data && (
            <>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                {data.eingeloggt} eingeloggt
              </span>
              {data.verpaetet > 0 && (
                <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold">
                  {data.verpaetet} verspätet
                </span>
              )}
              {data.nicht_erschienen > 0 && (
                <span className="rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 text-[10px] font-bold">
                  {data.nicht_erschienen} fehlt
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {loading && <span className="text-[10px] text-muted-foreground">…</span>}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && data && (
        <div className="border-t border-inherit px-4 pb-4 pt-3 space-y-2">
          {data.fahrer.map(f => (
            <div
              key={f.fahrer_id}
              className="rounded-lg border border-border bg-background/60 dark:bg-background/20 px-3 py-2 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{f.fahrer_name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    Geplant: {formatTime(f.geplanter_start)} · Check-In: {formatTime(f.tatsaechlicher_start)}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', STATUS_COLOR[f.status])}>
                  {STATUS_LABEL[f.status]}
                </span>
                {f.verpaetung_min > 0 && f.status !== 'eingeloggt' && (
                  <span className="text-[10px] font-bold text-red-600 dark:text-red-400 tabular-nums">
                    +{f.verpaetung_min} Min
                  </span>
                )}
              </div>
            </div>
          ))}
          {data.fahrer.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">Keine Fahrer für heute geplant.</p>
          )}
        </div>
      )}
    </div>
  );
}
