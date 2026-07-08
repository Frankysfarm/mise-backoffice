'use client';

import { useEffect, useState } from 'react';
import { Navigation, MapPin, CheckCircle2, Clock, Package, ChevronRight, Loader2 } from 'lucide-react';

interface Stop {
  id: string;
  adresse?: string | null;
  plz?: string | null;
  ort?: string | null;
  lat?: number | null;
  lng?: number | null;
  customer_name?: string | null;
  geliefert_am?: string | null;
  eta_min?: number | null;
  order_id?: string | null;
}

interface Props {
  driverId: string;
}

function buildNavUrl(stop: Stop): string {
  if (stop.lat && stop.lng) {
    return `https://maps.google.com/?q=${stop.lat},${stop.lng}`;
  }
  const addr = [stop.adresse, stop.plz, stop.ort].filter(Boolean).join(', ');
  return `https://maps.google.com/?q=${encodeURIComponent(addr)}`;
}

export function FahrerPhase648TourStoppLiveKommando({ driverId }: Props) {
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(`/api/delivery/driver/tour?driver_id=${driverId}`);
        if (r.ok && !cancelled) {
          const data = await r.json();
          const raw: Stop[] = data.stops ?? data.tour?.stops ?? [];
          setStops(raw.filter((s) => !s.geliefert_am));
        }
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [driverId]);

  async function handleComplete(stopId: string) {
    setCompleting(stopId);
    try {
      await fetch('/api/delivery/driver/stop-complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, stop_id: stopId }),
      });
      setStops((prev) => prev.filter((s) => s.id !== stopId));
    } catch {}
    finally { setCompleting(null); }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-matcha-600" />
        <span className="text-sm text-muted-foreground">Lade Tour-Stopps…</span>
      </div>
    );
  }

  if (stops.length === 0) {
    return (
      <div className="rounded-xl border border-matcha-200 dark:border-matcha-800 bg-matcha-50 dark:bg-matcha-950/20 p-4 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-matcha-600 dark:text-matcha-400 shrink-0" />
        <div>
          <div className="text-sm font-bold text-matcha-700 dark:text-matcha-300">Tour abgeschlossen</div>
          <div className="text-xs text-muted-foreground">Alle Stopps erledigt — gut gemacht!</div>
        </div>
      </div>
    );
  }

  const current = stops[0];
  const remaining = stops.slice(1);

  return (
    <div className="space-y-3">
      {/* Aktueller Stopp */}
      <div className="rounded-xl border-2 border-matcha-400 dark:border-matcha-600 bg-matcha-50 dark:bg-matcha-950/30 overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-4 py-2 bg-matcha-500 dark:bg-matcha-700">
          <Package className="h-4 w-4 text-white shrink-0" />
          <span className="text-xs font-bold text-white uppercase tracking-wide">Aktueller Stopp</span>
          <span className="ml-auto text-[10px] text-matcha-100 font-bold">
            {stops.length} verbleibend
          </span>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-matcha-600 dark:text-matcha-400 shrink-0 mt-0.5" />
            <div>
              {current.customer_name && (
                <div className="text-sm font-bold text-foreground">{current.customer_name}</div>
              )}
              <div className="text-sm text-muted-foreground">
                {[current.adresse, current.plz, current.ort].filter(Boolean).join(', ') || 'Adresse nicht verfügbar'}
              </div>
              {current.eta_min != null && (
                <div className="flex items-center gap-1 mt-1 text-xs text-amber-600 dark:text-amber-400">
                  <Clock className="h-3 w-3" />
                  <span>ETA: ~{current.eta_min} Min</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <a
              href={buildNavUrl(current)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-matcha-600 hover:bg-matcha-700 active:bg-matcha-800 text-white px-4 py-2.5 text-sm font-bold transition"
            >
              <Navigation className="h-4 w-4" />
              Navigation starten
            </a>
            <button
              onClick={() => handleComplete(current.id)}
              disabled={completing === current.id}
              className="flex items-center justify-center gap-2 rounded-lg bg-white dark:bg-gray-800 border-2 border-matcha-400 text-matcha-700 dark:text-matcha-300 px-4 py-2.5 text-sm font-bold hover:bg-matcha-50 disabled:opacity-50 transition"
            >
              {completing === current.id
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <CheckCircle2 className="h-4 w-4" />}
              Geliefert
            </button>
          </div>
        </div>
      </div>

      {/* Nächste Stopps */}
      {remaining.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Nächste Stopps ({remaining.length})
            </span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {remaining.slice(0, 3).map((stop, idx) => (
              <div key={stop.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="shrink-0 w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-black text-muted-foreground">
                  {idx + 2}
                </span>
                <div className="flex-1 min-w-0">
                  {stop.customer_name && (
                    <div className="text-xs font-semibold text-foreground truncate">{stop.customer_name}</div>
                  )}
                  <div className="text-xs text-muted-foreground truncate">
                    {[stop.adresse, stop.plz].filter(Boolean).join(', ')}
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </div>
            ))}
            {remaining.length > 3 && (
              <div className="px-4 py-2 text-center text-xs text-muted-foreground">
                +{remaining.length - 3} weitere Stopps
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
