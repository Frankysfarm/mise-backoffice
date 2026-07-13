'use client';

import { useEffect, useState } from 'react';
import { BarChart2, ChevronDown, Loader2, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1392 — Fahrer-Effizienz-Matrix-Widget (Dispatch)
 *
 * Visualisiert Phase1390-API: /api/delivery/admin/fahrer-effizienz-matrix
 * Heatmap-Tabelle: Fahrer (Zeilen) × Wochentag (Spalten)
 * Metriken: km/Stopp, Pünktlichkeit %, Trinkgeld Ø
 * Wochentag-Filter + Spalten-Summen
 * 15-Min-Polling. Nach Phase1387 in dispatch/client.tsx einbinden.
 */

type Metrik = 'puenktlichkeit_pct' | 'km_pro_stopp' | 'trinkgeld_avg';

interface Zelle {
  fahrer_id: string;
  wochentag: number;
  wochentag_label: string;
  km_pro_stopp: number | null;
  puenktlichkeit_pct: number | null;
  trinkgeld_avg: number | null;
  anzahl_touren: number;
}

interface FahrerInfo { id: string; name: string }
interface Wochentag { index: number; label: string }

interface ApiResponse {
  fahrer: FahrerInfo[];
  zellen: Zelle[];
  wochentage: Wochentag[];
  location_id: string;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const METRIK_LABELS: Record<Metrik, string> = {
  puenktlichkeit_pct: 'Pünktlichkeit %',
  km_pro_stopp: 'km/Stopp',
  trinkgeld_avg: 'Trinkgeld Ø €',
};

function metrikWert(zelle: Zelle, m: Metrik): number | null {
  return zelle[m];
}

function metrikFarbe(wert: number | null, m: Metrik): string {
  if (wert === null) return 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600';
  if (m === 'puenktlichkeit_pct') {
    if (wert >= 95) return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
    if (wert >= 85) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
    return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  }
  if (m === 'km_pro_stopp') {
    if (wert <= 1.5) return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
    if (wert <= 2.5) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
    return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  }
  // trinkgeld_avg — mehr = besser
  if (wert >= 0.6) return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
  if (wert >= 0.3) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

function formatWert(wert: number | null, m: Metrik): string {
  if (wert === null) return '—';
  if (m === 'puenktlichkeit_pct') return `${wert}%`;
  if (m === 'km_pro_stopp') return `${wert.toFixed(1)}`;
  return `${wert.toFixed(2)}€`;
}

function spaltensumme(zellen: Zelle[], fahrerList: FahrerInfo[], dow: number, m: Metrik): number | null {
  const vals = fahrerList
    .map((f) => zellen.find((z) => z.fahrer_id === f.id && z.wochentag === dow)?.[m] ?? null)
    .filter((v): v is number => v !== null);
  if (!vals.length) return null;
  if (m === 'puenktlichkeit_pct') return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  return parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
}

export function DispatchPhase1392FahrerEffizienzMatrixWidget({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [metrik, setMetrik] = useState<Metrik>('puenktlichkeit_pct');
  const [filterDow, setFilterDow] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/fahrer-effizienz-matrix?${params}`);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dowFilter = data?.wochentage.filter((w) =>
    filterDow === null || w.index === filterDow,
  ) ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Fahrer-Effizienz-Matrix</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Metrik-Wechsler */}
          {(Object.keys(METRIK_LABELS) as Metrik[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetrik(m)}
              className={cn(
                'text-xs px-2 py-1 rounded-full border transition-colors',
                metrik === m
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              {METRIK_LABELS[m]}
            </button>
          ))}
          <button onClick={load} disabled={loading} className="p-1 rounded hover:bg-muted transition-colors">
            <RefreshCw className={cn('h-3.5 w-3.5 text-muted-foreground', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Wochentag-Filter */}
      {data && (
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setFilterDow(null)}
            className={cn(
              'text-xs px-2 py-0.5 rounded border transition-colors',
              filterDow === null ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            Alle
          </button>
          {data.wochentage.map((w) => (
            <button
              key={w.index}
              onClick={() => setFilterDow(filterDow === w.index ? null : w.index)}
              className={cn(
                'text-xs px-2 py-0.5 rounded border transition-colors',
                filterDow === w.index ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left px-2 py-1.5 text-muted-foreground font-medium border-b border-border">Fahrer</th>
                {dowFilter.map((w) => (
                  <th key={w.index} className="text-center px-2 py-1.5 text-muted-foreground font-medium border-b border-border min-w-[60px]">
                    {w.label}
                  </th>
                ))}
                {filterDow === null && (
                  <th className="text-center px-2 py-1.5 text-muted-foreground font-medium border-b border-border">Ø</th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.fahrer.map((f, fi) => {
                const rowVals = dowFilter.map((w) => {
                  const z = data.zellen.find((c) => c.fahrer_id === f.id && c.wochentag === w.index);
                  return z ? metrikWert(z, metrik) : null;
                });
                const validVals = rowVals.filter((v): v is number => v !== null);
                const rowAvg = validVals.length > 0
                  ? parseFloat((validVals.reduce((a, b) => a + b, 0) / validVals.length).toFixed(2))
                  : null;
                return (
                  <tr key={f.id} className={fi % 2 === 0 ? 'bg-muted/30' : ''}>
                    <td className="px-2 py-1.5 font-medium text-foreground whitespace-nowrap">{f.name}</td>
                    {dowFilter.map((w, wi) => {
                      const wert = rowVals[wi] ?? null;
                      return (
                        <td key={w.index} className="px-1 py-1">
                          <span className={cn(
                            'inline-block w-full text-center rounded px-1.5 py-0.5 text-xs font-semibold',
                            metrikFarbe(wert, metrik),
                          )}>
                            {formatWert(wert, metrik)}
                          </span>
                        </td>
                      );
                    })}
                    {filterDow === null && (
                      <td className="px-1 py-1">
                        <span className={cn(
                          'inline-block w-full text-center rounded px-1.5 py-0.5 text-xs font-bold',
                          metrikFarbe(rowAvg, metrik),
                        )}>
                          {formatWert(rowAvg, metrik)}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
              {/* Spalten-Summen */}
              {filterDow === null && (
                <tr className="border-t border-border">
                  <td className="px-2 py-1.5 text-muted-foreground font-semibold text-xs">Ø Spalte</td>
                  {dowFilter.map((w) => {
                    const sum = spaltensumme(data.zellen, data.fahrer, w.index, metrik);
                    return (
                      <td key={w.index} className="px-1 py-1">
                        <span className={cn(
                          'inline-block w-full text-center rounded px-1.5 py-0.5 text-xs font-bold',
                          metrikFarbe(sum, metrik),
                        )}>
                          {formatWert(sum, metrik)}
                        </span>
                      </td>
                    );
                  })}
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <p className="text-xs text-muted-foreground text-right">
          Aktualisiert: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · alle 15 Min
        </p>
      )}
    </div>
  );
}
