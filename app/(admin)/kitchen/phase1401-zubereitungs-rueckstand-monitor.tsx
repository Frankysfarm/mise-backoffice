'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1401 — Zubereitungs-Rückstand-Monitor (Kitchen)
 *
 * Zeigt Bestellungen, die länger als X Minuten in Zubereitung sind:
 *   • Schwellwerte: 15 Min = Warnung, 25 Min = Kritisch
 *   • Sortiert nach Wartezeit (längste zuerst)
 *   • Bestellnummer + vergangene Zeit + Status-Ampel
 *   • Props-basiert, kein API-Aufruf
 *
 * Nach Phase1396 in kitchen/client.tsx einbinden.
 */

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  created_at?: string | null;
  accepted_at?: string | null;
  zubereitungs_start?: string | null;
}

interface Props {
  orders: Order[];
}

interface RueckstandRow {
  id: string;
  nr: string;
  warteSek: number;
  warteLabel: string;
  stufe: 'ok' | 'warnung' | 'kritisch';
}

const WARN_SEK = 15 * 60;
const KRIT_SEK = 25 * 60;

const STUFE_STYLE = {
  ok:       { bg: 'bg-green-50 dark:bg-green-950/20',   border: 'border-green-200 dark:border-green-800',   text: 'text-green-700 dark:text-green-300',   dot: 'bg-green-500'   },
  warnung:  { bg: 'bg-yellow-50 dark:bg-yellow-950/20', border: 'border-yellow-200 dark:border-yellow-700', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-500' },
  kritisch: { bg: 'bg-red-50 dark:bg-red-950/25',       border: 'border-red-300 dark:border-red-700',       text: 'text-red-700 dark:text-red-300',       dot: 'bg-red-500 animate-pulse' },
};

function formatSek(sek: number): string {
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, '0')} Min`;
}

export function KitchenPhase1401ZubereitungsRueckstandMonitor({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const now = Date.now();

  const rows = useMemo<RueckstandRow[]>(() => {
    return orders
      .filter((o) => o.status === 'in_zubereitung' || o.status === 'angenommen')
      .map((o) => {
        const startStr = o.zubereitungs_start ?? o.accepted_at ?? o.created_at;
        const startMs = startStr ? new Date(startStr).getTime() : now;
        const warteSek = Math.max(0, Math.round((now - startMs) / 1000));
        const stufe: RueckstandRow['stufe'] =
          warteSek >= KRIT_SEK ? 'kritisch' : warteSek >= WARN_SEK ? 'warnung' : 'ok';
        return {
          id: o.id,
          nr: o.bestellnummer ?? o.id.slice(0, 6),
          warteSek,
          warteLabel: formatSek(warteSek),
          stufe,
        };
      })
      .sort((a, b) => b.warteSek - a.warteSek)
      .slice(0, 10);
  }, [orders, now]);

  const kritisch = rows.filter((r) => r.stufe === 'kritisch');
  const warnung  = rows.filter((r) => r.stufe === 'warnung');

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        <Clock className={cn('h-4 w-4', kritisch.length > 0 ? 'text-red-500' : warnung.length > 0 ? 'text-yellow-500' : 'text-green-500')} />
        <span className="font-semibold text-sm">Zubereitungs-Rückstand</span>
        <span className="ml-1 text-xs text-muted-foreground">{rows.length} in Arbeit</span>
        {kritisch.length > 0 && (
          <span className="flex items-center gap-1 ml-1 text-xs font-bold text-red-600 dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" /> {kritisch.length} kritisch
          </span>
        )}
        <span className="ml-auto">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-1.5">
          {rows.map((row) => {
            const s = STUFE_STYLE[row.stufe];
            return (
              <div
                key={row.id}
                className={cn('flex items-center gap-3 rounded-lg border px-3 py-2', s.bg, s.border)}
              >
                <div className={cn('h-2 w-2 rounded-full shrink-0', s.dot)} />
                <span className={cn('font-mono text-sm font-semibold', s.text)}>#{row.nr}</span>
                <div className="flex-1" />
                <span className={cn('text-sm font-bold tabular-nums', s.text)}>{row.warteLabel}</span>
              </div>
            );
          })}

          <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> &lt; 15 Min</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-yellow-500" /> 15–25 Min</span>
            <span className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-red-500" /> &gt; 25 Min</span>
          </div>
        </div>
      )}
    </div>
  );
}
