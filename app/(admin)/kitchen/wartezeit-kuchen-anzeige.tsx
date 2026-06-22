'use client';

/**
 * WartezeitKuechenAnzeige — Phase 419
 *
 * Zeigt der Küche in Echtzeit:
 * - Aktuelle Ø-Prep-Zeit vs. 15-Min-Ziel (Ampel)
 * - Offene Bestellungen in der Queue
 * - Überfällige Bestellungen (>15 Min in Prep)
 * - Auto-Refresh alle 60 Sekunden
 */

import { useCallback, useEffect, useState } from 'react';
import { ChefHat, Clock, AlertTriangle, CheckCircle2, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KuechenWartezeit {
  avgPrepMin:    number | null;
  zielPrepMin:   number;
  deltaMin:      number | null;
  ampel:         'gruen' | 'gelb' | 'rot';
  aktuelleQueue: number;
  ueberfaellig:  number;
}

export function WartezeitKuechenAnzeige({ locationId }: { locationId: string | null }) {
  const [data, setData]       = useState<KuechenWartezeit | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const laden = useCallback(() => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/wartezeit-analyse?action=kueche&location_id=${encodeURIComponent(locationId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.kueche) {
          setData(d.kueche);
          setLastUpdate(new Date());
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    laden();
    const t = setInterval(laden, 60_000);
    return () => clearInterval(t);
  }, [laden]);

  if (!locationId) return null;

  const ampelColors = {
    gruen: { bg: 'bg-matcha-50', border: 'border-matcha-200', text: 'text-matcha-700', dot: 'bg-matcha-500' },
    gelb:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  dot: 'bg-amber-400' },
    rot:   { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    dot: 'bg-red-500' },
  };

  const ampel = data?.ampel ?? 'gruen';
  const c = ampelColors[ampel];

  const fmt = (min: number | null): string => {
    if (min === null) return '—';
    return `${min.toFixed(1)} Min`;
  };

  return (
    <div className={cn('rounded-2xl border p-4 space-y-3', c.bg, c.border)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('flex h-7 w-7 items-center justify-center rounded-full', c.dot === 'bg-matcha-500' ? 'bg-matcha-100' : c.dot === 'bg-amber-400' ? 'bg-amber-100' : 'bg-red-100')}>
            <ChefHat className={cn('h-4 w-4', c.text)} />
          </div>
          <span className={cn('text-sm font-bold', c.text)}>Küchen-Wartezeit</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn('h-2 w-2 rounded-full animate-pulse', c.dot)} />
          {loading && <Loader2 className="h-3 w-3 animate-spin text-stone-400" />}
        </div>
      </div>

      {data && (
        <>
          {/* Haupt-Metrik */}
          <div className="flex items-end gap-3">
            <div>
              <div className={cn('text-3xl font-black tabular-nums leading-none', c.text)}>
                {data.avgPrepMin !== null ? data.avgPrepMin.toFixed(1) : '—'}
              </div>
              <div className="text-[10px] font-semibold text-stone-500 mt-0.5">Ø Prep-Zeit (Min)</div>
            </div>
            <div className="pb-1">
              {data.deltaMin !== null && data.deltaMin > 0 ? (
                <div className="flex items-center gap-1 text-xs font-bold text-red-600">
                  <TrendingUp className="h-3.5 w-3.5" />
                  +{data.deltaMin.toFixed(1)} über Ziel
                </div>
              ) : data.deltaMin !== null && data.deltaMin < 0 ? (
                <div className="flex items-center gap-1 text-xs font-bold text-matcha-700">
                  <TrendingDown className="h-3.5 w-3.5" />
                  {Math.abs(data.deltaMin).toFixed(1)} unter Ziel
                </div>
              ) : (
                <div className="flex items-center gap-1 text-xs font-bold text-matcha-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Im Ziel
                </div>
              )}
              <div className="text-[10px] text-stone-400">Ziel: {data.zielPrepMin} Min</div>
            </div>
          </div>

          {/* Queue-Status */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/70 border border-white/80 p-2.5 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Clock className="h-3.5 w-3.5 text-stone-400" />
              </div>
              <div className="text-xl font-black tabular-nums text-stone-800">{data.aktuelleQueue}</div>
              <div className="text-[9px] font-semibold text-stone-500 uppercase tracking-wide">In Queue</div>
            </div>
            <div className={cn(
              'rounded-xl p-2.5 text-center',
              data.ueberfaellig > 0 ? 'bg-red-100 border border-red-200' : 'bg-white/70 border border-white/80',
            )}>
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <AlertTriangle className={cn('h-3.5 w-3.5', data.ueberfaellig > 0 ? 'text-red-500' : 'text-stone-400')} />
              </div>
              <div className={cn('text-xl font-black tabular-nums', data.ueberfaellig > 0 ? 'text-red-700' : 'text-stone-800')}>
                {data.ueberfaellig}
              </div>
              <div className="text-[9px] font-semibold text-stone-500 uppercase tracking-wide">Überfällig</div>
            </div>
          </div>

          {lastUpdate && (
            <div className="text-[9px] text-stone-400 text-right">
              Stand: {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
            </div>
          )}
        </>
      )}

      {!data && !loading && (
        <div className="text-sm text-stone-400 text-center py-2">Keine Daten verfügbar.</div>
      )}
    </div>
  );
}
