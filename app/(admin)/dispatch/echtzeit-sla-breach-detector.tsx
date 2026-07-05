'use client';

/**
 * Phase 555 Dispatch — Echtzeit-SLA-Breach-Detector
 *
 * Zeigt Touren, bei denen SLA-Verletzung droht (ETA > versprochene Zeit).
 * Alert + Handlungsempfehlung. Kein Polling nötig — Props-getrieben.
 */

import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, TrendingUp, Siren, ChevronDown, ChevronUp } from 'lucide-react';

// Matches dispatch Batch type (embedded stops + fahrer)
interface BatchStop {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order?: { bestellnummer: string; eta_earliest?: string | null; eta_latest?: string | null } | null;
}

interface DispatchBatch {
  id: string;
  status: string;
  fahrer_id?: string | null;
  fahrer?: { vorname: string; nachname: string } | null;
  startzeit?: string | null;
  started_at?: string | null;      // alternative field name
  total_eta_min: number | null;
  stops: BatchStop[];
  promised_delivery_min?: number | null;
}

interface Props {
  batches: DispatchBatch[];
  locationId: string | null;
}

const WARNUNG_SCHWELLE   = 5;   // Min Verzögerung → Warnung
const KRITISCH_SCHWELLE  = 12;  // Min Verzögerung → Kritisch
const DEFAULT_PROMISE    = 35;  // Fallback-Versprechen in Min

type RisikoLevel = 'ok' | 'warnung' | 'kritisch';

interface TourRisiko {
  batchId: string;
  driverName: string;
  stopsDone: number;
  stopsTotal: number;
  etaMin: number | null;
  promisedMin: number;
  delayMin: number;
  level: RisikoLevel;
  empfehlung: string;
}

function buildRisiken(batches: DispatchBatch[]): TourRisiko[] {
  const now = Date.now();
  return batches
    .filter(b => ['unterwegs', 'in_delivery', 'aktiv', 'active', 'gestartet'].includes(b.status))
    .map(b => {
      const startStr    = b.startzeit ?? b.started_at ?? null;
      const elapsedMin  = startStr ? (now - new Date(startStr).getTime()) / 60_000 : 0;
      const etaMin      = b.total_eta_min !== null
        ? Math.max(0, b.total_eta_min - elapsedMin)
        : null;
      const promised    = b.promised_delivery_min ?? DEFAULT_PROMISE;
      const totalExp    = elapsedMin + (etaMin ?? 0);
      const delayMin    = Math.round(Math.max(0, totalExp - promised));

      const stopsDone   = b.stops.filter(s => s.geliefert_am).length;
      const stopsTotal  = b.stops.length;

      const fn = b.fahrer
        ? `${b.fahrer.vorname} ${b.fahrer.nachname.charAt(0)}.`
        : '?';

      const level: RisikoLevel =
        delayMin >= KRITISCH_SCHWELLE ? 'kritisch' :
        delayMin >= WARNUNG_SCHWELLE  ? 'warnung'  : 'ok';

      const empfehlung =
        level === 'kritisch' ? 'Sofort: Kunden benachrichtigen + Gutschein prüfen' :
        level === 'warnung'  ? 'Kunden proaktiv per Push informieren'               :
                               'Tour läuft planmäßig';

      return { batchId: b.id, driverName: fn, stopsDone, stopsTotal, etaMin: etaMin !== null ? Math.round(etaMin) : null, promisedMin: promised, delayMin, level, empfehlung };
    })
    .sort((a, b) => b.delayMin - a.delayMin);
}

const LEVEL_CFG: Record<RisikoLevel, {
  bg: string; border: string; text: string; badge: string; icon: typeof AlertTriangle;
}> = {
  kritisch: { bg: 'bg-red-50',    border: 'border-red-400',    text: 'text-red-800',    badge: 'bg-red-600 text-white',    icon: Siren        },
  warnung:  { bg: 'bg-amber-50',  border: 'border-amber-400',  text: 'text-amber-800',  badge: 'bg-amber-500 text-white',  icon: AlertTriangle },
  ok:       { bg: 'bg-matcha-50', border: 'border-matcha-300', text: 'text-matcha-800', badge: 'bg-matcha-600 text-white', icon: CheckCircle2  },
};

export function DispatchEchtzeitSLABreachDetector({ batches, locationId }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const risiken = useMemo(() => buildRisiken(batches), [batches]);

  if (risiken.length === 0) return null;

  const critCount = risiken.filter(r => r.level === 'kritisch').length;
  const warnCount = risiken.filter(r => r.level === 'warnung').length;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30 text-left"
      >
        <TrendingUp size={16} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-bold text-foreground flex-1">Echtzeit-SLA-Breach-Detector</span>
        <div className="flex items-center gap-2">
          {critCount > 0 && (
            <span className="rounded-full bg-red-600 text-white px-2 py-0.5 text-[9px] font-bold">
              {critCount} kritisch
            </span>
          )}
          {warnCount > 0 && (
            <span className="rounded-full bg-amber-500 text-white px-2 py-0.5 text-[9px] font-bold">
              {warnCount} Warnung
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{risiken.length} Touren</span>
          {collapsed
            ? <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
            : <ChevronUp   size={14} className="shrink-0 text-muted-foreground" />}
        </div>
      </button>

      {!collapsed && (
        <div className="divide-y divide-border">
          {risiken.map(r => {
            const cfg  = LEVEL_CFG[r.level];
            const Icon = cfg.icon;
            return (
              <div key={r.batchId} className={cn('flex items-start gap-3 px-4 py-3', cfg.bg)}>
                <span className={cn('mt-0.5 rounded-full p-1.5 shrink-0 border', cfg.border)}>
                  <Icon size={12} className={cfg.text} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-xs font-bold', cfg.text)}>{r.driverName}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold', cfg.badge)}>
                      {r.level === 'ok' ? 'Im Plan' : `+${r.delayMin} Min Verzög.`}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {r.stopsDone}/{r.stopsTotal} Stopps
                    </span>
                  </div>
                  <div className={cn('mt-0.5 text-[10px] opacity-80', cfg.text)}>
                    {r.empfehlung}
                  </div>
                </div>
                {r.etaMin !== null && (
                  <div className="shrink-0 text-right">
                    <div className={cn('font-mono text-sm font-black tabular-nums', cfg.text)}>
                      {r.etaMin} Min
                    </div>
                    <div className="text-[8px] text-muted-foreground">ETA</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
