'use client';

/**
 * KitchenStornoHotspotStrip — Phase 416
 *
 * Küchen-Perspektive der Storno-Muster-Matrix:
 * Zeigt Hotspot-Stunden mit Ursache kueche_verzoegerung, damit das
 * Küchenteam proaktiv zu kritischen Zeiten gegensteuern kann.
 */

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, RefreshCw, XCircle } from 'lucide-react';

type StornoCause = 'kueche_verzoegerung' | 'kein_fahrer' | 'kunde_storniert' | 'zone_problem' | 'unbekannt';

interface StornoHotspot {
  dayOfWeek: number;
  hourOfDay: number;
  stornoRate: number;
  stornoCount: number;
  totalCount: number;
  qualityLabel: string;
  primaryCause: StornoCause | null;
  recommendation: string;
}

const DOW = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function KitchenStornoHotspotStrip({ locationId }: { locationId: string | null }) {
  const [hotspots, setHotspots] = useState<StornoHotspot[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/storno-muster-matrix?location_id=${locationId}&action=hotspots`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const data = await res.json() as { hotspots: StornoHotspot[] };
        // Küche interessiert sich primär für kueche_verzoegerung-Hotspots
        setHotspots(data.hotspots ?? []);
        setLastFetch(new Date());
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(timer);
  }, [load]);

  const kuechemHotspots = hotspots.filter((h) => h.primaryCause === 'kueche_verzoegerung');
  const otherHotspots = hotspots.filter((h) => h.primaryCause !== 'kueche_verzoegerung');

  if (!locationId) return null;
  if (!loading && hotspots.length === 0) return null;

  // Find current-hour relevance
  const now = new Date();
  const currentDow = now.getDay();
  const currentHour = now.getHours();
  const currentHotspot = hotspots.find(
    (h) => h.dayOfWeek === currentDow && h.hourOfDay === currentHour,
  );

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
        <span className="text-sm font-bold flex-1">Storno-Hotspots — Küchen-Analyse</span>
        <div className="flex items-center gap-2">
          {hotspots.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
              {hotspots.length} Hotspot{hotspots.length !== 1 ? 's' : ''}
            </span>
          )}
          {loading && <RefreshCw className="h-3 w-3 text-muted-foreground animate-spin" />}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Current-hour alert */}
        {currentHotspot && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-red-700">Jetzt kritisch — {currentHour}:00 Uhr</div>
              <div className="text-[11px] text-red-600 mt-0.5">
                Historische Stornorate {(currentHotspot.stornoRate * 100).toFixed(1)}% in dieser Stunde.
                {currentHotspot.primaryCause === 'kueche_verzoegerung' && ' Küchenverzögerungen als Hauptursache.'}
              </div>
            </div>
          </div>
        )}

        {/* Kitchen-caused hotspots */}
        {kuechemHotspots.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Stornos durch Küchenverzögerung
            </div>
            <div className="flex flex-wrap gap-2">
              {kuechemHotspots.map((h) => (
                <div
                  key={`${h.dayOfWeek}-${h.hourOfDay}`}
                  className={cn(
                    'flex flex-col items-center rounded-lg px-2.5 py-2 border text-center',
                    'bg-orange-50 border-orange-200',
                  )}
                >
                  <div className="text-[9px] font-bold text-orange-700 uppercase">{DOW[h.dayOfWeek]}</div>
                  <div className="text-base font-black text-orange-800 tabular-nums">{h.hourOfDay}:00</div>
                  <div className="text-[10px] font-bold text-red-600">{(h.stornoRate * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top recommendation */}
        {kuechemHotspots[0] && (
          <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
            <span className="font-bold text-foreground">Tipp: </span>
            {kuechemHotspots[0].recommendation}
          </div>
        )}

        {/* Other hotspots summary */}
        {otherHotspots.length > 0 && (
          <div className="text-[10px] text-muted-foreground border-t pt-2">
            +{otherHotspots.length} Hotspot{otherHotspots.length !== 1 ? 's' : ''} aus anderen Ursachen
            (Fahrer, Zone, Kunde) — im Lieferdienst-Dashboard sichtbar.
          </div>
        )}

        {hotspots.length === 0 && !loading && (
          <div className="text-center py-3 text-[11px] text-emerald-600 font-medium">
            Keine Storno-Hotspots gefunden — gute Küchen-Performance!
          </div>
        )}

        {lastFetch && (
          <div className="text-[9px] text-muted-foreground text-right">
            Aktualisiert {lastFetch.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );
}
