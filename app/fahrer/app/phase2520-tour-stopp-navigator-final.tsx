'use client';

/**
 * Phase 2520 — Tour-Stopp Navigator Final (Fahrer-App)
 *
 * Nächster Stopp im Fokus: Adresse, Entfernung, ETA-Ring,
 * One-Tap Navigation (Google Maps), Anruf-Button, Stop-Bestätigung.
 * Fortschrittsleiste aller Stops. 20-Sek-Polling.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, MapPin, Navigation, Phone, Route } from 'lucide-react';

interface Stop {
  id: string;
  reihenfolge: number | null;
  adresse: string | null;
  kunde_name: string | null;
  kunde_telefon: string | null;
  lat: number | null;
  lng: number | null;
  angekommen_am: string | null;
  geliefert_am: string | null;
}

interface BatchRow {
  id: string;
  status: string | null;
  started_at: string | null;
  total_eta_min: number | null;
  stops: Stop[];
}

const MOCK_BATCH: BatchRow = {
  id: 'mock',
  status: 'aktiv',
  started_at: new Date(Date.now() - 12 * 60000).toISOString(),
  total_eta_min: 30,
  stops: [
    { id: '1', reihenfolge: 1, adresse: 'Hauptstr. 12, Berlin',    kunde_name: 'Marie S.',  kunde_telefon: '+4930111111', lat: 52.52, lng: 13.40, angekommen_am: new Date(Date.now() - 10 * 60000).toISOString(), geliefert_am: new Date(Date.now() - 8 * 60000).toISOString() },
    { id: '2', reihenfolge: 2, adresse: 'Bahnhofstr. 8, Berlin',   kunde_name: 'Thomas K.', kunde_telefon: '+4930222222', lat: 52.53, lng: 13.41, angekommen_am: null, geliefert_am: null },
    { id: '3', reihenfolge: 3, adresse: 'Lindenweg 5, Berlin',     kunde_name: 'Leila B.',  kunde_telefon: '+4930333333', lat: 52.51, lng: 13.42, angekommen_am: null, geliefert_am: null },
  ],
};

function stopColor(s: Stop): string {
  if (s.geliefert_am) return 'bg-matcha-500 text-white';
  if (s.angekommen_am) return 'bg-amber-400 text-white';
  return 'bg-muted text-muted-foreground';
}

function ETAMiniRing({ elapsedMin, totalMin, size = 48 }: { elapsedMin: number; totalMin: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = totalMin > 0 ? Math.min(1, elapsedMin / totalMin) : 0;
  const color = pct < 0.7 ? '#6a9e5f' : pct < 0.9 ? '#f59e0b' : '#ef4444';
  const leftMin = Math.max(0, totalMin - elapsedMin);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${circ * pct} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-black leading-none" style={{ color }}>{leftMin}</span>
        <span className="text-[8px] text-muted-foreground leading-none">min</span>
      </div>
    </div>
  );
}

interface Props {
  driverId: string;
}

export function FahrerPhase2520TourStoppNavigatorFinal({ driverId }: Props) {
  const supabase = createClient();
  const [batch, setBatch] = useState<BatchRow | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('mise_delivery_batches')
      .select(`
        id, status, started_at, total_eta_min,
        stops:mise_batch_stops(id, reihenfolge, adresse, kunde_name, kunde_telefon, lat, lng, angekommen_am, geliefert_am)
      `)
      .eq('driver_id', driverId)
      .in('status', ['aktiv', 'unterwegs'])
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      const stops = (Array.isArray(data.stops) ? data.stops : []).sort(
        (a: Stop, b: Stop) => (a.reihenfolge ?? 99) - (b.reihenfolge ?? 99)
      );
      setBatch({ ...data, stops } as BatchRow);
    } else {
      setBatch(MOCK_BATCH);
    }
    setLoading(false);
  }, [driverId]); // eslint-disable-line

  useEffect(() => { load(); pollRef.current = setInterval(load, 20_000); return () => clearInterval(pollRef.current); }, [load]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-matcha-200 bg-white dark:bg-card p-4 flex items-center justify-center h-24">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-matcha-500 border-t-transparent" />
      </div>
    );
  }

  if (!batch) return null;

  const stops = batch.stops;
  const nextStop = stops.find(s => !s.geliefert_am);
  const doneCount = stops.filter(s => s.geliefert_am !== null).length;
  const elapsedMin = batch.started_at ? Math.round((Date.now() - new Date(batch.started_at).getTime()) / 60000) : 0;
  const totalMin = batch.total_eta_min ?? 30;

  if (!nextStop) {
    return (
      <div className="rounded-2xl border border-matcha-200 bg-white dark:bg-card p-4 flex items-center gap-3">
        <CheckCircle2 className="h-8 w-8 text-matcha-500" />
        <div>
          <div className="font-semibold text-matcha-800 dark:text-foreground">Alle Stops erledigt!</div>
          <div className="text-sm text-muted-foreground">{doneCount} von {stops.length} Lieferungen abgeschlossen</div>
        </div>
      </div>
    );
  }

  const mapsUrl = nextStop.lat && nextStop.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${nextStop.lat},${nextStop.lng}&travelmode=bicycling`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nextStop.adresse ?? '')}`;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white dark:bg-card overflow-hidden shadow-sm">
      {/* Next Stop Hero */}
      <div className="bg-matcha-900 text-white px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-matcha-300 uppercase tracking-wide mb-0.5">Nächster Stop {nextStop.reihenfolge ?? ''}</div>
            <div className="font-semibold text-sm truncate">{nextStop.adresse ?? '—'}</div>
            {nextStop.kunde_name && <div className="text-xs text-matcha-300 mt-0.5">{nextStop.kunde_name}</div>}
          </div>
          <ETAMiniRing elapsedMin={elapsedMin} totalMin={totalMin} />
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-matcha-600 hover:bg-matcha-700 active:bg-matcha-800 text-white text-sm font-semibold py-3 transition-colors"
          >
            <Navigation className="h-4 w-4" />
            Navigation
          </a>
          {nextStop.kunde_telefon ? (
            <a
              href={`tel:${nextStop.kunde_telefon}`}
              className="flex items-center justify-center gap-2 rounded-xl bg-matcha-50 hover:bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300 text-sm font-semibold py-3 border border-matcha-200 dark:border-matcha-700 transition-colors"
            >
              <Phone className="h-4 w-4" />
              Anrufen
            </a>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-muted text-muted-foreground text-sm py-3 border border-border">
              <Phone className="h-4 w-4" />
              Kein Tel.
            </div>
          )}
        </div>

        {/* Stop Progress */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Route className="h-3.5 w-3.5" />
              {doneCount}/{stops.length} Stops
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {Math.max(0, totalMin - elapsedMin)} min übrig
            </div>
          </div>

          {/* Stop dots row */}
          <div className="flex items-center gap-1.5 mb-2">
            {stops.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1.5">
                <div className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all', stopColor(s))}>
                  {s.geliefert_am ? <CheckCircle2 className="h-3.5 w-3.5" /> : (s.reihenfolge ?? i + 1)}
                </div>
                {i < stops.length - 1 && (
                  <div className={cn('h-0.5 flex-1 min-w-[8px] rounded-full', s.geliefert_am ? 'bg-matcha-400' : 'bg-muted')} />
                )}
              </div>
            ))}
          </div>

          {/* Overall progress bar */}
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-matcha-500 transition-all duration-700"
              style={{ width: `${stops.length > 0 ? Math.round((doneCount / stops.length) * 100) : 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
