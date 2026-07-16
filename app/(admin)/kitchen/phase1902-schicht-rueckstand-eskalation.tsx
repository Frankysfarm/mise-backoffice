'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Flame, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

/**
 * Phase 1902 — Schicht-Rückstand-Eskalation (Kitchen)
 *
 * Wenn >3 Bestellungen länger als 30 Min in Zubereitung: roter Alarm
 * + Eskalations-Stufen (Warnung / Kritisch / Eskalation). useMemo; Collapsible.
 */

interface Order {
  id: string;
  status?: string;
  created_at?: string;
  customer_name?: string;
  items?: unknown[];
}

type EskalationsStufe = 'ok' | 'warnung' | 'kritisch' | 'eskalation';

interface RueckstandBestellung {
  id: string;
  wartezeit_min: number;
  customer_name: string;
}

interface Props {
  orders: Order[];
  ruckstandSchwelle?: number;
  eskalationsSchwelle?: number;
  className?: string;
}

function stufeLabel(stufe: EskalationsStufe): string {
  if (stufe === 'warnung') return 'Warnung';
  if (stufe === 'kritisch') return 'Kritisch';
  if (stufe === 'eskalation') return 'Eskalation';
  return 'OK';
}

export function KitchenPhase1902SchichtRueckstandEskalation({
  orders,
  ruckstandSchwelle = 30,
  eskalationsSchwelle = 3,
  className,
}: Props) {
  const [offen, setOffen] = useState(true);

  const { rueckstaende, stufe } = useMemo(() => {
    const jetzt = Date.now();
    const liste: RueckstandBestellung[] = [];

    for (const o of orders) {
      if (o.status !== 'preparing' && o.status !== 'in_preparation') continue;
      if (!o.created_at) continue;
      const wartezeit_min = Math.floor((jetzt - new Date(o.created_at).getTime()) / 60_000);
      if (wartezeit_min >= ruckstandSchwelle) {
        liste.push({
          id: o.id,
          wartezeit_min,
          customer_name: o.customer_name ?? `#${o.id.slice(-4)}`,
        });
      }
    }

    liste.sort((a, b) => b.wartezeit_min - a.wartezeit_min);

    let stufe: EskalationsStufe = 'ok';
    if (liste.length > eskalationsSchwelle + 4) stufe = 'eskalation';
    else if (liste.length > eskalationsSchwelle + 1) stufe = 'kritisch';
    else if (liste.length > eskalationsSchwelle) stufe = 'warnung';

    return { rueckstaende: liste, stufe };
  }, [orders, ruckstandSchwelle, eskalationsSchwelle]);

  const hatRueckstand = rueckstaende.length > 0;

  const stufeStyle: Record<EskalationsStufe, string> = {
    ok: 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300',
    warnung: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300',
    kritisch: 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300',
    eskalation: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300',
  };

  const headerBadgeStyle: Record<EskalationsStufe, string> = {
    ok: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    warnung: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    kritisch: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    eskalation: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  };

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Flame className={cn('h-4 w-4 shrink-0', stufe === 'ok' ? 'text-green-500' : 'text-red-500')} />
        <span className="text-xs font-bold uppercase tracking-wider">Rückstand-Eskalation</span>
        <span className={cn('ml-1 text-[10px] font-bold rounded-full px-2 py-0.5', headerBadgeStyle[stufe])}>
          {hatRueckstand ? `${rueckstaende.length} Bstlg. · ${stufeLabel(stufe)}` : 'Kein Rückstand'}
        </span>
        {offen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {/* Status-Banner */}
          <div className={cn('rounded-xl border px-3 py-2 flex items-start gap-2', stufeStyle[stufe])}>
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold">{stufeLabel(stufe)}</p>
              <p className="text-[11px] mt-0.5">
                {stufe === 'ok'
                  ? `Kein Rückstand — alle Bestellungen unter ${ruckstandSchwelle} Min.`
                  : stufe === 'warnung'
                  ? `${rueckstaende.length} Bestellung${rueckstaende.length !== 1 ? 'en' : ''} über ${ruckstandSchwelle} Min — Küche beobachten.`
                  : stufe === 'kritisch'
                  ? `${rueckstaende.length} Bestellungen im Rückstand — sofort priorisieren!`
                  : `${rueckstaende.length} Bestellungen eskaliert — Teamleitung informieren!`}
              </p>
            </div>
          </div>

          {/* Rückstand-Liste */}
          {rueckstaende.length > 0 && (
            <div className="space-y-1.5">
              {rueckstaende.map((b) => (
                <div
                  key={b.id}
                  className="rounded-xl border bg-muted/30 px-3 py-2 flex items-center justify-between gap-2"
                >
                  <span className="text-xs font-medium truncate">{b.customer_name}</span>
                  <span
                    className={cn(
                      'text-xs font-black tabular-nums shrink-0',
                      b.wartezeit_min >= 60
                        ? 'text-red-600 dark:text-red-400'
                        : b.wartezeit_min >= 45
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-amber-600 dark:text-amber-400',
                    )}
                  >
                    {b.wartezeit_min} Min
                  </span>
                </div>
              ))}
            </div>
          )}

          {rueckstaende.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Alle Bestellungen im Zeitplan ✓
            </p>
          )}

          <p className="text-[10px] text-muted-foreground text-right">
            Schwelle: &gt;{eskalationsSchwelle} Bstlg. über {ruckstandSchwelle} Min · Echtzeit
          </p>
        </div>
      )}
    </div>
  );
}
