'use client';

/**
 * Phase 1889 — Zonen-Preis-Elastizitäts-Widget (Dispatch)
 *
 * Scatter-ähnliche Tabelle: Liefergebühr vs. Volumen je Zone A/B/C/D.
 * Empfehlungs-Badge (senken / beibehalten / erhöhen).
 * Alert-Banner wenn Elastizität >1.5 in einer Zone.
 * 30-Min-Polling. Collapsible.
 * GET /api/delivery/admin/zonen-preis-elastizitaet (Phase 1888)
 */

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Tag,
  RefreshCw,
} from 'lucide-react';

interface ZoneElastizitaet {
  zone: string;
  gebuehr_aktuell_eur: number;
  volumen_heute: number;
  volumen_7d_schnitt: number;
  elastizitaet: number;
  empfehlung: 'senken' | 'beibehalten' | 'erhöhen';
  empfehlung_preis: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  mock?: boolean;
}

interface Props {
  locationId: string | null;
  className?: string;
}

const ZONE_LABEL: Record<string, string> = { A: 'Nah', B: 'Standard', C: 'Weit', D: 'Außen' };

const EMP_COLOR: Record<string, string> = {
  senken:      'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  beibehalten: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  erhöhen:     'bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300',
};

const TREND_ICON = { steigend: TrendingUp, stabil: Minus, fallend: TrendingDown };
const TREND_COLOR = {
  steigend: 'text-matcha-600 dark:text-matcha-400',
  stabil:   'text-amber-600 dark:text-amber-400',
  fallend:  'text-red-600 dark:text-red-400',
};

export function DispatchPhase1889ZonenPreisElastizitaetWidget({ locationId, className }: Props) {
  const [data, setData]       = useState<ZoneElastizitaet[]>([]);
  const [offen, setOffen]     = useState(true);
  const [laden, setLaden]     = useState(false);
  const [zuletzt, setZuletzt] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!locationId) return;
    setLaden(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/zonen-preis-elastizitaet?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        setData(json.zonen ?? []);
        setZuletzt(json.generiert_um ?? null);
      }
    } catch {
      /* ignore — mock data steht bereit */
    } finally {
      setLaden(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetch_]);

  const alerts = data.filter((z) => z.elastizitaet > 1.5);

  if (!locationId) return null;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Tag className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Zonen-Preis-Elastizität</span>
        {laden && <RefreshCw className="h-3 w-3 text-muted-foreground animate-spin ml-1" />}
        {alerts.length > 0 && (
          <span className="ml-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
            {alerts.length} elastisch ⚠
          </span>
        )}
        {offen
          ? <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />}
      </button>

      {offen && (
        <div className="p-3 space-y-3">
          {alerts.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                Zone{alerts.length > 1 ? 'n' : ''}{' '}
                {alerts.map((z) => z.zone).join(', ')} — Elastizität &gt;1.5:
                Liefergebühr senken empfohlen.
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left py-1 pr-2 font-semibold">Zone</th>
                  <th className="text-right py-1 px-2 font-semibold">Gebühr</th>
                  <th className="text-right py-1 px-2 font-semibold">Vol. Heute</th>
                  <th className="text-right py-1 px-2 font-semibold">Ø 7d</th>
                  <th className="text-right py-1 px-2 font-semibold">Elastizität</th>
                  <th className="text-center py-1 px-2 font-semibold">Empfehlung</th>
                  <th className="text-right py-1 pl-2 font-semibold">Zielpreis</th>
                </tr>
              </thead>
              <tbody>
                {data.map((z) => {
                  const TrendIcon = TREND_ICON[z.trend] ?? Minus;
                  const trendColor = TREND_COLOR[z.trend] ?? '';
                  return (
                    <tr key={z.zone} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="py-2 pr-2 font-bold">
                        {z.zone}
                        <span className="ml-1 font-normal text-muted-foreground">{ZONE_LABEL[z.zone]}</span>
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums">
                        {z.gebuehr_aktuell_eur.toFixed(2)} €
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums">
                        <span className={cn('flex items-center justify-end gap-0.5', trendColor)}>
                          <TrendIcon className="h-3 w-3" />
                          {z.volumen_heute}
                        </span>
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums text-muted-foreground">
                        {z.volumen_7d_schnitt.toFixed(1)}
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums font-semibold">
                        <span className={z.elastizitaet > 1.5 ? 'text-red-600 dark:text-red-400' : z.elastizitaet < 0.8 ? 'text-matcha-600 dark:text-matcha-400' : 'text-amber-600 dark:text-amber-400'}>
                          {z.elastizitaet.toFixed(2)}
                        </span>
                      </td>
                      <td className="text-center py-2 px-2">
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', EMP_COLOR[z.empfehlung])}>
                          {z.empfehlung}
                        </span>
                      </td>
                      <td className="text-right py-2 pl-2 tabular-nums text-matcha-700 dark:text-matcha-300 font-semibold">
                        {z.empfehlung_preis.toFixed(2)} €
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {zuletzt && (
            <p className="text-[10px] text-muted-foreground text-right">
              Stand: {new Date(zuletzt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · 30-Min-Polling
            </p>
          )}
        </div>
      )}
    </div>
  );
}
