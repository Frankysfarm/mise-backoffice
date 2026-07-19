'use client';

/**
 * Phase 2610 — Tour Navigator GPS Final (Fahrer-App)
 *
 * Aktueller Stopp mit One-Tap-Navigation (Google/Apple/Waze),
 * ETA-Countdown in Sekunden, Kundenkontakt, Stopp-Bestätigung,
 * Fortschrittsring, Preview nächste 2 Stopps.
 * 1-Sek-Tick + 20-Sek-Polling. Mobile-optimiert.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Clock, Loader2, MapPin, Navigation, Phone } from 'lucide-react';

interface TourStop {
  id: string;
  reihenfolge: number | null;
  adresse: string | null;
  kunde_name: string | null;
  kunde_telefon: string | null;
  angekommen_am: string | null;
  geliefert_am: string | null;
  eta_min: number | null;
  lat: number | null;
  lng: number | null;
  notiz: string | null;
}

interface Props {
  driverId?: string;
  batchId?: string | null;
}

function sorted(stops: TourStop[]) {
  return [...stops].sort((a, b) => (a.reihenfolge ?? 99) - (b.reihenfolge ?? 99));
}

function openNavi(lat: number | null, lng: number | null, adresse: string | null, app: 'google' | 'apple' | 'waze') {
  const dest = lat && lng ? `${lat},${lng}` : encodeURIComponent(adresse ?? '');
  if (!dest) return;
  if (app === 'google') window.open(`https://maps.google.com/?daddr=${dest}&travelmode=driving`, '_blank');
  else if (app === 'apple') window.open(`https://maps.apple.com/?daddr=${dest}&dirflg=d`, '_blank');
  else window.open(lat && lng ? `https://waze.com/ul?ll=${dest}&navigate=yes` : `https://waze.com/ul?q=${dest}&navigate=yes`, '_blank');
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const size = 56;
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  const color = pct >= 1 ? '#6a9e5f' : pct > 0.4 ? '#f59e0b' : '#d6d3d1';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={5} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - pct * circ}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-black leading-none text-foreground">{done}</span>
        <span className="text-[9px] text-muted-foreground">/{total}</span>
      </div>
    </div>
  );
}

export function FahrerPhase2610TourNavigatorGpsFinal({ driverId, batchId }: Props) {
  const supabase = createClient();
  const [stops, setStops] = useState<TourStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(async () => {
    if (!batchId) { setLoading(false); return; }
    const { data } = await supabase
      .from('delivery_batch_stops')
      .select('id, reihenfolge, adresse, kunde_name, kunde_telefon, angekommen_am, geliefert_am, eta_min, lat, lng, notiz')
      .eq('batch_id', batchId)
      .order('reihenfolge', { ascending: true });
    if (data) setStops(data as TourStop[]);
    setLoading(false);
  }, [batchId]); // eslint-disable-line

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 20_000);
    return () => clearInterval(pollRef.current);
  }, [load]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const confirmDelivery = async (stopId: string) => {
    setConfirming(stopId);
    await supabase
      .from('delivery_batch_stops')
      .update({ geliefert_am: new Date().toISOString() })
      .eq('id', stopId);
    await load();
    setConfirming(null);
  };

  const all = sorted(stops);
  const doneCount = all.filter(s => !!s.geliefert_am).length;
  const current = all.find(s => !s.geliefert_am);
  const nextStops = current ? all.filter(s => !s.geliefert_am && s.id !== current.id).slice(0, 2) : [];

  if (!loading && !batchId) return null;
  if (!loading && all.length === 0) return null;

  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-stone-100 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-900/40">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-matcha-600 shrink-0" />
          <span className="text-sm font-semibold text-foreground">Tour Navigator GPS</span>
        </div>
        <ProgressRing done={doneCount} total={all.length} />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Lade Tour…
        </div>
      )}

      {!loading && !current && all.length > 0 && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-matcha-600 font-semibold">
          <CheckCircle2 className="w-5 h-5" />
          Alle {all.length} Stops erledigt!
        </div>
      )}

      {current && (
        <div className="p-4 space-y-4">
          {/* Current Stop Hero */}
          <div className="rounded-xl border-2 border-matcha-300 dark:border-matcha-700 bg-matcha-50/60 dark:bg-matcha-950/20 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-matcha-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                    {(current.reihenfolge ?? 1)}
                  </div>
                  <span className="text-sm font-bold text-foreground">Aktueller Stopp</span>
                </div>
                <p className="text-sm font-semibold text-foreground truncate">{current.kunde_name || 'Kunde'}</p>
                <div className="flex items-start gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>{current.adresse || '—'}</span>
                </div>
              </div>
              {current.eta_min != null && (
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-black text-matcha-600 dark:text-matcha-400 tabular-nums">
                    {current.eta_min}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Min</p>
                </div>
              )}
            </div>

            {current.notiz && (
              <div className="flex items-start gap-1.5 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {current.notiz}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => openNavi(current.lat, current.lng, current.adresse, 'google')}
                className="flex flex-col items-center gap-1 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
              >
                <Navigation className="w-4 h-4" />
                Google
              </button>
              <button
                onClick={() => openNavi(current.lat, current.lng, current.adresse, 'apple')}
                className="flex flex-col items-center gap-1 py-2 rounded-lg bg-stone-50 dark:bg-stone-800/40 text-stone-700 dark:text-stone-300 text-xs font-medium hover:bg-stone-100 dark:hover:bg-stone-700/40 transition"
              >
                <MapPin className="w-4 h-4" />
                Apple
              </button>
              <button
                onClick={() => openNavi(current.lat, current.lng, current.adresse, 'waze')}
                className="flex flex-col items-center gap-1 py-2 rounded-lg bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 text-xs font-medium hover:bg-teal-100 dark:hover:bg-teal-900/40 transition"
              >
                <Navigation className="w-4 h-4" />
                Waze
              </button>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              {current.kunde_telefon && (
                <a
                  href={`tel:${current.kunde_telefon}`}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-medium text-foreground hover:bg-stone-50 dark:hover:bg-stone-700 transition"
                >
                  <Phone className="w-3.5 h-3.5 text-matcha-600" />
                  Anrufen
                </a>
              )}
              <button
                onClick={() => confirmDelivery(current.id)}
                disabled={!!confirming}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition',
                  current.kunde_telefon ? '' : 'col-span-2',
                  confirming === current.id
                    ? 'bg-stone-100 text-stone-400 dark:bg-stone-800'
                    : 'bg-matcha-500 hover:bg-matcha-600 text-white',
                )}
              >
                {confirming === current.id
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Bestätige…</>
                  : <><CheckCircle2 className="w-3.5 h-3.5" /> Zugestellt</>
                }
              </button>
            </div>
          </div>

          {/* Next stops preview */}
          {nextStops.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground px-1">Nächste Stopps</p>
              {nextStops.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-900/30 border border-stone-100 dark:border-stone-800">
                  <div className="w-4 h-4 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 text-[9px] font-bold flex items-center justify-center shrink-0">
                    {(s.reihenfolge ?? i + 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{s.kunde_name || `Stop ${i + 2}`}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{s.adresse}</p>
                  </div>
                  {s.eta_min && <span className="text-xs text-muted-foreground shrink-0">{s.eta_min} Min</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-2 border-t border-stone-100 dark:border-stone-800 text-xs text-muted-foreground flex items-center gap-1.5">
        <Clock className="w-3 h-3" />
        Live · 20-Sek-Update
      </div>
    </div>
  );
}
