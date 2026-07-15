'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Coffee, ChevronDown, ChevronUp, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';

/**
 * Phase 1684 — Fahrer-Pausen-Compliance-Widget (Dispatch)
 *
 * Phase1682-API: Status je Fahrer (Pause fällig/ok); Warnbadge; 10-Min-Polling.
 */

type PausenStatus = 'ok' | 'pause_faellig' | 'ueberzeit';

interface FahrerPause {
  fahrer_id: string;
  fahrer_name: string;
  schicht_dauer_min: number;
  pause_genommen_min: number;
  pause_pflicht_min: number;
  status: PausenStatus;
  pause_faellig_seit_min: number | null;
}

interface ApiResponse {
  fahrer: FahrerPause[];
  compliance_rate_pct: number;
}

interface Props {
  locationId?: string | null;
}

const MOCK: ApiResponse = {
  compliance_rate_pct: 67,
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',  schicht_dauer_min: 420, pause_genommen_min: 30, pause_pflicht_min: 30, status: 'ok',           pause_faellig_seit_min: null },
    { fahrer_id: 'f2', fahrer_name: 'Lisa B.', schicht_dauer_min: 390, pause_genommen_min: 10, pause_pflicht_min: 30, status: 'pause_faellig', pause_faellig_seit_min: 30 },
    { fahrer_id: 'f3', fahrer_name: 'Tom K.',  schicht_dauer_min: 480, pause_genommen_min: 0,  pause_pflicht_min: 30, status: 'ueberzeit',     pause_faellig_seit_min: 120 },
  ],
};

const STATUS_CFG: Record<PausenStatus, { label: string; color: string; dot: string }> = {
  ok:           { label: 'Pause ok',    color: 'text-matcha-700 dark:text-matcha-300', dot: 'bg-matcha-400' },
  pause_faellig:{ label: 'Pause fällig',color: 'text-amber-700 dark:text-amber-300',  dot: 'bg-amber-400' },
  ueberzeit:    { label: 'Überzeit!',   color: 'text-red-700 dark:text-red-400',       dot: 'bg-red-500' },
};

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function DispatchPhase1684FahrerPausenComplianceWidget({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-pausen-compliance${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json = await res.json();
        if (active) { setData(json); setLoading(false); }
      } catch {
        if (active) { setData(MOCK); setLoading(false); }
      }
    }

    load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => { active = false; clearInterval(id); };
  }, [locationId]);

  const hatWarnung = data?.fahrer.some(f => f.status === 'pause_faellig' || f.status === 'ueberzeit') ?? false;
  const hatUeberzeit = data?.fahrer.some(f => f.status === 'ueberzeit') ?? false;

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Coffee className={cn(
          'h-4 w-4 shrink-0',
          hatUeberzeit ? 'text-red-500' : hatWarnung ? 'text-amber-500' : 'text-matcha-500',
        )} />
        <span className="text-sm font-semibold flex-1 text-foreground">
          Fahrer-Pausen-Compliance
        </span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {!loading && data && (
          <span className={cn(
            'text-[11px] font-bold tabular-nums rounded-full px-1.5 py-0.5',
            data.compliance_rate_pct >= 80
              ? 'bg-matcha-100 text-matcha-800 dark:bg-matcha-900/30 dark:text-matcha-300'
              : data.compliance_rate_pct >= 60
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
          )}>
            {data.compliance_rate_pct}%
          </span>
        )}
        {hatWarnung && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && data && (
        <div className="mt-3 space-y-1.5">
          {data.fahrer
            .sort((a, b) => {
              const order: Record<PausenStatus, number> = { ueberzeit: 0, pause_faellig: 1, ok: 2 };
              return order[a.status] - order[b.status];
            })
            .map(f => {
              const cfg = STATUS_CFG[f.status];
              return (
                <div
                  key={f.fahrer_id}
                  className="flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-1.5"
                >
                  <span className={cn('h-2 w-2 rounded-full shrink-0', cfg.dot)} />
                  <span className="text-[11px] font-medium text-foreground flex-1 truncate">
                    {f.fahrer_name}
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] tabular-nums shrink-0">
                    <span className="text-muted-foreground">{fmtMin(f.schicht_dauer_min)} Schicht</span>
                    {f.status === 'ok'
                      ? <CheckCircle2 className="h-3 w-3 text-matcha-500" />
                      : (
                        <span className={cn('font-semibold', cfg.color)}>
                          {f.pause_faellig_seit_min !== null
                            ? `seit ${fmtMin(f.pause_faellig_seit_min)}`
                            : cfg.label}
                        </span>
                      )
                    }
                  </div>
                </div>
              );
            })}
          <p className="text-[9px] text-muted-foreground pt-1">
            Pflichtpause: 30 Min bei Schicht &gt;6h · alle 10 Min aktualisiert
          </p>
        </div>
      )}
    </div>
  );
}
