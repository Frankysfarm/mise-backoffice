'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

/**
 * Phase 1694 — Zone-SLA-Live-Board (Dispatch)
 *
 * Je Zone A/B/C/D: SLA-Einhaltung % + Ø Lieferzeit + Ampel; Props batches+stops; useMemo.
 */

interface BatchInput {
  id: string;
  zone?: string | null;
  status?: string | null;
  dispatched_at?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
}

interface StopInput {
  id: string;
  batch_id?: string | null;
  geliefert_am?: string | null;
  delivered_at?: string | null;
  erwartet_am?: string | null;
  eta_at?: string | null;
  status?: string | null;
}

interface Props {
  batches: BatchInput[];
  stops: StopInput[];
}

const SLA_ZIEL_MIN = 30;
const ZONES = ['A', 'B', 'C', 'D'] as const;
type Zone = typeof ZONES[number];

interface ZoneStat {
  zone: Zone;
  gesamt: number;
  sla_ok: number;
  sla_pct: number;
  avg_liefer_min: number | null;
  ampel: 'gruen' | 'gelb' | 'rot';
}

const ZONE_COLOR: Record<Zone, string> = {
  A: 'bg-matcha-500',
  B: 'bg-sky-500',
  C: 'bg-amber-500',
  D: 'bg-orange-500',
};

const ZONE_BADGE: Record<Zone, string> = {
  A: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900 dark:text-matcha-300',
  B: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300',
  C: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  D: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
};

function ampelOf(sla_pct: number): ZoneStat['ampel'] {
  if (sla_pct >= 85) return 'gruen';
  if (sla_pct >= 65) return 'gelb';
  return 'rot';
}

const AMPEL_DOT: Record<ZoneStat['ampel'], string> = {
  gruen: 'bg-matcha-500',
  gelb:  'bg-amber-400',
  rot:   'bg-red-500',
};

const AMPEL_TEXT: Record<ZoneStat['ampel'], string> = {
  gruen: 'text-matcha-600 dark:text-matcha-400',
  gelb:  'text-amber-600 dark:text-amber-400',
  rot:   'text-red-600 dark:text-red-400',
};

export function DispatchPhase1694ZoneSlaLiveBoard({ batches, stops }: Props) {
  const [open, setOpen] = useState(true);

  const stats = useMemo<ZoneStat[]>(() => {
    const byZone: Record<string, { lieferzeiten: number[]; sla_ok: number; gesamt: number }> = {};
    for (const z of ZONES) byZone[z] = { lieferzeiten: [], sla_ok: 0, gesamt: 0 };

    const batchZone: Record<string, string> = {};
    for (const b of batches) {
      if (b.zone && ZONES.includes(b.zone as Zone)) {
        batchZone[b.id] = b.zone;
      }
    }

    for (const s of stops) {
      const deliveredAt = s.geliefert_am ?? s.delivered_at;
      if (!deliveredAt) continue;
      const batchId = s.batch_id;
      if (!batchId) continue;
      const zone = batchZone[batchId];
      if (!zone || !ZONES.includes(zone as Zone)) continue;

      const etaAt = s.erwartet_am ?? s.eta_at;
      if (etaAt) {
        const diffMin = (new Date(deliveredAt).getTime() - new Date(etaAt).getTime()) / 60000;
        byZone[zone].lieferzeiten.push(diffMin + SLA_ZIEL_MIN);
        if (diffMin <= 0) byZone[zone].sla_ok++;
      } else {
        byZone[zone].lieferzeiten.push(SLA_ZIEL_MIN);
        byZone[zone].sla_ok++;
      }
      byZone[zone].gesamt++;
    }

    return ZONES.map(zone => {
      const d = byZone[zone];
      const sla_pct = d.gesamt > 0 ? Math.round((d.sla_ok / d.gesamt) * 100) : 100;
      const avg = d.lieferzeiten.length > 0
        ? Math.round(d.lieferzeiten.reduce((a, b) => a + b, 0) / d.lieferzeiten.length)
        : null;
      return {
        zone,
        gesamt: d.gesamt,
        sla_ok: d.sla_ok,
        sla_pct,
        avg_liefer_min: avg,
        ampel: ampelOf(sla_pct),
      };
    });
  }, [batches, stops]);

  const hatAlarm = stats.some(s => s.ampel === 'rot');
  const hatWarn  = stats.some(s => s.ampel === 'gelb');

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <MapPin className={cn('h-4 w-4 shrink-0', hatAlarm ? 'text-red-500' : hatWarn ? 'text-amber-500' : 'text-matcha-500')} />
        <span className="text-sm font-semibold flex-1 text-foreground">Zone SLA Live-Board</span>
        {hatAlarm && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
        <span className="text-[10px] text-muted-foreground shrink-0">Ziel {SLA_ZIEL_MIN} Min</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {stats.map(s => (
            <div
              key={s.zone}
              className="rounded-lg border border-border bg-muted/40 px-2.5 py-2 space-y-1.5"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', ZONE_BADGE[s.zone])}>
                  Zone {s.zone}
                </span>
                <span className={cn('flex items-center gap-1 text-[10px] font-bold', AMPEL_TEXT[s.ampel])}>
                  <span className={cn('h-2 w-2 rounded-full', AMPEL_DOT[s.ampel])} />
                  {s.sla_pct}%
                </span>
              </div>

              {/* SLA Bar */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', ZONE_COLOR[s.zone])}
                  style={{ width: `${s.sla_pct}%` }}
                />
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between text-[9px] text-muted-foreground tabular-nums">
                <span>{s.gesamt} Stop{s.gesamt !== 1 ? 's' : ''}</span>
                <span>{s.avg_liefer_min !== null ? `Ø ${s.avg_liefer_min} Min` : '—'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <p className="text-[9px] text-muted-foreground mt-2 pt-2 border-t border-border">
          Grün ≥85% · Gelb ≥65% · Rot &lt;65% SLA-Einhaltung
        </p>
      )}
    </div>
  );
}
