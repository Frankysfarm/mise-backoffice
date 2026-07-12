'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Circle, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1151 — Tour-Echtzeit-Ampel (Dispatch)
// Live-Ampel Grün/Gelb/Rot je aktiver Tour nach Pünktlichkeit + verbleibender Zeit, 90s-Polling.

interface Props {
  locationId: string | null;
}

type AmpelStatus = 'gruen' | 'gelb' | 'rot';

interface TourAmpel {
  batch_id: string;
  fahrer_name: string;
  zone: string | null;
  stopps_gesamt: number;
  stopps_erledigt: number;
  fortschritt_pct: number;
  laufzeit_min: number;
  eta_min: number | null;
  verbleibend_min: number | null;
  ampel: AmpelStatus;
  grund: string;
}

interface ApiResponse {
  touren: TourAmpel[];
  gruen: number;
  gelb: number;
  rot: number;
  generiert_am: string;
}

function mockData(): TourAmpel[] {
  return [
    { batch_id: 'b1', fahrer_name: 'Marco S.', zone: 'A', stopps_gesamt: 3, stopps_erledigt: 2, fortschritt_pct: 67, laufzeit_min: 22, eta_min: 30, verbleibend_min: 8, ampel: 'gruen', grund: 'Pünktlich unterwegs' },
    { batch_id: 'b2', fahrer_name: 'Jana K.', zone: 'B', stopps_gesamt: 4, stopps_erledigt: 1, fortschritt_pct: 25, laufzeit_min: 28, eta_min: 35, verbleibend_min: 7, ampel: 'gelb', grund: 'Fortschritt knapp' },
    { batch_id: 'b3', fahrer_name: 'Tom H.', zone: 'C', stopps_gesamt: 2, stopps_erledigt: 1, fortschritt_pct: 50, laufzeit_min: 45, eta_min: 40, verbleibend_min: -5, ampel: 'rot', grund: 'ETA überschritten' },
  ];
}

const AMPEL_STYLE: Record<AmpelStatus, { bg: string; border: string; dot: string; label: string; badge: string }> = {
  gruen: { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'text-emerald-500', label: 'Pünktlich', badge: 'bg-emerald-500 text-white' },
  gelb: { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'text-amber-400', label: 'Achtung', badge: 'bg-amber-400 text-white' },
  rot: { bg: 'bg-red-50', border: 'border-red-200', dot: 'text-red-500', label: 'Verzögert', badge: 'bg-red-500 text-white' },
};

export function DispatchPhase1151TourEchtzeitAmpel({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [touren, setTouren] = useState<TourAmpel[]>([]);
  const [counts, setCounts] = useState({ gruen: 0, gelb: 0, rot: 0 });
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) { setTouren(mockData()); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/tour-echtzeit-ampel?location_id=${locationId}`);
      if (res.ok) {
        const data: ApiResponse = await res.json();
        setTouren(data.touren ?? []);
        setCounts({ gruen: data.gruen ?? 0, gelb: data.gelb ?? 0, rot: data.rot ?? 0 });
        setLastUpdated(data.generiert_am ?? null);
      } else {
        setTouren(mockData());
      }
    } catch {
      setTouren(mockData());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 90_000);
    return () => clearInterval(interval);
  }, [load]);

  const hatKritisch = counts.rot > 0;

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      hatKritisch ? 'border-red-300 bg-red-50/30' : 'border-border bg-card',
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <MapPin className={cn('h-4 w-4 shrink-0', hatKritisch ? 'text-red-500' : 'text-blue-500')} />
          <span className="text-sm font-bold uppercase tracking-wider">Tour-Echtzeit-Ampel</span>
          <span className="rounded-full bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5">{counts.gruen} ✓</span>
          <span className="rounded-full bg-amber-400 text-white text-[10px] font-black px-2 py-0.5">{counts.gelb} ⚠</span>
          {hatKritisch && (
            <span className="rounded-full bg-red-500 text-white text-[10px] font-black px-2 py-0.5 animate-pulse">{counts.rot} ✗</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t divide-y">
          {touren.length === 0 && (
            <div className="px-4 py-4 text-sm text-muted-foreground text-center">Keine aktiven Touren.</div>
          )}
          {touren.map((tour) => {
            const style = AMPEL_STYLE[tour.ampel];
            return (
              <div key={tour.batch_id} className={cn('px-4 py-3 flex items-center gap-3', style.bg)}>
                <Circle className={cn('h-5 w-5 shrink-0 fill-current', style.dot)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold truncate">{tour.fahrer_name}</span>
                    {tour.zone && (
                      <span className="text-[10px] rounded-full bg-white/70 border px-1.5 py-0.5 font-bold">
                        Zone {tour.zone}
                      </span>
                    )}
                    <span className={cn('text-[10px] rounded-full px-2 py-0.5 font-black', style.badge)}>
                      {style.label}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden min-w-[60px]">
                      <div
                        className={cn('h-full rounded-full',
                          tour.ampel === 'gruen' ? 'bg-emerald-500' :
                          tour.ampel === 'gelb' ? 'bg-amber-400' : 'bg-red-500'
                        )}
                        style={{ width: `${tour.fortschritt_pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {tour.stopps_erledigt}/{tour.stopps_gesamt} Stopps
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{tour.grund}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm font-black tabular-nums">{tour.laufzeit_min}m</div>
                  {tour.verbleibend_min !== null && (
                    <div className={cn('text-[9px] font-bold', tour.verbleibend_min < 0 ? 'text-red-600' : 'text-muted-foreground')}>
                      {tour.verbleibend_min < 0 ? `+${Math.abs(tour.verbleibend_min)}m` : `${tour.verbleibend_min}m`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {lastUpdated && (
            <div className="flex items-center gap-1 px-4 py-1.5 bg-muted/20">
              <RefreshCw className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                Aktualisiert {new Date(lastUpdated).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · 90s-Polling
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
