'use client';

/**
 * Phase 1891 — Fahrer-Kapazitäts-Ampel-Live (Dispatch)
 *
 * Zeigt in Echtzeit wie viele Fahrer für neue Touren verfügbar sind.
 * Ampel: grün ≥3, gelb 1–2, rot 0 freie Fahrer.
 * Berechnet aus Props (keine API). 30-Sek-Ticker. Collapsible.
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface Driver {
  employee_id?: string | null;
  employee?: { vorname?: string; nachname?: string } | null;
  status?: string | null;
  is_online?: boolean | null;
}

interface Batch {
  id?: string | null;
  status?: string | null;
  fahrer_id?: string | null;
}

interface Props {
  drivers: Driver[];
  batches: Batch[];
  className?: string;
}

const BUSY_STATI = new Set(['unterwegs', 'on_route', 'gestartet', 'aktiv', 'picking_up']);

function ampelMeta(frei: number) {
  if (frei >= 3) return { bg: 'bg-emerald-500', ring: 'ring-emerald-400', label: 'Gut', text: 'text-emerald-600 dark:text-emerald-400' };
  if (frei >= 1) return { bg: 'bg-yellow-500',  ring: 'ring-yellow-400',  label: 'Knapp', text: 'text-yellow-600 dark:text-yellow-400' };
  return           { bg: 'bg-red-500',           ring: 'ring-red-400',     label: 'Kritisch', text: 'text-red-600 dark:text-red-400' };
}

export function DispatchPhase1891FahrerKapazitaetsAmpelLive({ drivers, batches, className }: Props) {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const { freie, beschaeftigt, offline } = useMemo(() => {
    const busyDriverIds = new Set(
      batches
        .filter((b) => b.status && BUSY_STATI.has(b.status) && b.fahrer_id)
        .map((b) => b.fahrer_id!),
    );
    const online = drivers.filter((d) => d.is_online !== false);
    const beschaeftigt = online.filter((d) => d.employee_id && busyDriverIds.has(d.employee_id));
    const freie = online.filter((d) => !d.employee_id || !busyDriverIds.has(d.employee_id));
    const offline = drivers.filter((d) => d.is_online === false);
    return { freie, beschaeftigt, offline };
  }, [drivers, batches, tick]);

  const meta = ampelMeta(freie.length);

  return (
    <Card className={cn('p-3 space-y-2', className)}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <div className={cn('h-3 w-3 rounded-full', meta.bg, freie.length === 0 && 'animate-pulse')} />
          <span className="text-xs font-bold text-foreground">Fahrer-Kapazitäts-Ampel</span>
          <span className={cn('text-[10px] font-semibold', meta.text)}>{meta.label}</span>
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="space-y-2">
          {/* KPI-Reihe */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Frei', value: freie.length, color: meta.text },
              { label: 'Im Einsatz', value: beschaeftigt.length, color: 'text-blue-600 dark:text-blue-400' },
              { label: 'Offline', value: offline.length, color: 'text-muted-foreground' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-lg bg-muted/40 p-2 text-center ring-1 ring-border/50">
                <div className={cn('text-xl font-black tabular-nums', kpi.color)}>{kpi.value}</div>
                <div className="text-[10px] text-muted-foreground">{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Freie Fahrer namentlich */}
          {freie.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Verfügbar</p>
              <div className="flex flex-wrap gap-1">
                {freie.slice(0, 6).map((d, i) => (
                  <span
                    key={d.employee_id ?? i}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
                  >
                    <Bike className="h-2.5 w-2.5" />
                    {d.employee?.vorname ?? `Fahrer ${i + 1}`}
                  </span>
                ))}
                {freie.length > 6 && (
                  <span className="text-[10px] text-muted-foreground self-center">+{freie.length - 6}</span>
                )}
              </div>
            </div>
          )}

          {freie.length === 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-50 dark:bg-red-950 px-3 py-2 ring-1 ring-red-300">
              <Zap className="h-3.5 w-3.5 text-red-500 animate-pulse shrink-0" />
              <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                Alle Fahrer im Einsatz — keine freie Kapazität!
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
