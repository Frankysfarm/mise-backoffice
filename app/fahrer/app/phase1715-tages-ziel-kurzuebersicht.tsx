'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Target, WifiOff, ChevronDown, ChevronUp, Loader2, CheckCircle2 } from 'lucide-react';

/**
 * Phase 1715 — Tages-Ziel-Kurzübersicht (Fahrer-App)
 *
 * Heutige Ziele (Stopps/Verdienst/SLA) auf einen Blick + Fortschrittsbalken.
 * GET /api/delivery/driver/schicht-ziel?driver_id=<id>
 * isOnline-Guard. 30-Min-Polling.
 */

interface ZielData {
  driver_id: string;
  stopps_heute: number;
  stopps_ziel: number;
  verdienst_eur: number;
  verdienst_ziel_eur: number;
  sla_pct: number;
  sla_ziel_pct: number;
  prognose: 'erreicht' | 'knapp' | 'nicht_erreicht';
  generiert_am: string;
}

interface Props {
  driverId?: string | null;
  isOnline?: boolean;
}

function buildMock(driverId: string): ZielData {
  const seed = driverId.charCodeAt(0) % 10;
  return {
    driver_id: driverId,
    stopps_heute: 4 + seed,
    stopps_ziel: 12,
    verdienst_eur: 32 + seed * 3,
    verdienst_ziel_eur: 80,
    sla_pct: 88 + seed,
    sla_ziel_pct: 90,
    prognose: seed > 6 ? 'erreicht' : seed > 3 ? 'knapp' : 'nicht_erreicht',
    generiert_am: new Date().toISOString(),
  };
}

const PROGNOSE_CFG = {
  erreicht:       { color: 'text-matcha-700 dark:text-matcha-300', bg: 'bg-matcha-50 dark:bg-matcha-900/20', label: '✓ Ziel erreichbar',  icon: CheckCircle2 },
  knapp:          { color: 'text-amber-700 dark:text-amber-300',   bg: 'bg-amber-50 dark:bg-amber-900/20',   label: '~ Knapp am Ziel',    icon: Target },
  nicht_erreicht: { color: 'text-red-700 dark:text-red-300',       bg: 'bg-red-50 dark:bg-red-900/20',       label: '✗ Ziel gefährdet',   icon: Target },
};

const POLL_MS = 30 * 60 * 1000;

function BarRow({ label, value, ziel, unit }: { label: string; value: number; ziel: number; unit: string }) {
  const pct = ziel > 0 ? Math.min(100, Math.round((value / ziel) * 100)) : 0;
  const barColor = pct >= 100 ? 'bg-matcha-400' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold tabular-nums text-foreground">
          {unit === '€' ? `${value.toFixed(0)}${unit}` : `${value}${unit}`} / {unit === '€' ? `${ziel}${unit}` : `${ziel}${unit}`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function FahrerPhase1715TagesZielKurzuebersicht({ driverId, isOnline = false }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ZielData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOnline || !driverId) return;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/driver/schicht-ziel?driver_id=${driverId}`);
        if (res.ok) {
          setData(await res.json());
        } else {
          setData(buildMock(driverId));
        }
      } catch {
        setData(buildMock(driverId));
      } finally {
        setLoading(false);
      }
    };

    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [driverId, isOnline]);

  if (!isOnline) {
    return (
      <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3">
        <WifiOff className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Tages-Ziel nur im Online-Modus verfügbar.</span>
      </div>
    );
  }

  if (!data && loading) {
    return (
      <div className="mx-4 mb-3 flex items-center justify-center rounded-xl border border-border bg-card py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const prognose = PROGNOSE_CFG[data.prognose];
  const PrognoseIcon = prognose.icon;

  return (
    <div className="mx-4 mb-3 rounded-xl border border-border bg-card overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="flex w-full items-center justify-between gap-2 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Target className="h-4 w-4 text-violet-500" />
          Heutige Ziele
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Prognose badge */}
          <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2', prognose.bg)}>
            <PrognoseIcon className={cn('h-4 w-4 shrink-0', prognose.color)} />
            <span className={cn('text-xs font-bold', prognose.color)}>{prognose.label}</span>
          </div>

          {/* Progress bars */}
          <BarRow label="Stopps" value={data.stopps_heute} ziel={data.stopps_ziel} unit=" Stopps" />
          <BarRow label="Verdienst" value={data.verdienst_eur} ziel={data.verdienst_ziel_eur} unit="€" />
          <BarRow
            label={`SLA (Ziel: ${data.sla_ziel_pct}%)`}
            value={data.sla_pct}
            ziel={data.sla_ziel_pct}
            unit="%"
          />
        </div>
      )}
    </div>
  );
}
