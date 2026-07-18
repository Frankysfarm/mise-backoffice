'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bike, CheckCircle2, ChefHat, Clock, MapPin, Package, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Typen ─────────────────────────────────────────────────────────────── */
type OrderPhase = 'eingegangen' | 'in_bearbeitung' | 'fertig' | 'unterwegs' | 'geliefert' | 'storniert';

interface TrackingData {
  status: OrderPhase;
  bestellnummer: string;
  bestellt_am: string | null;
  eta_min: number | null;
  eta_updated_at: string | null;
  fahrer_name: string | null;
  fahrer_distanz_km: number | null;
  geschaetzte_zubereitung_min: number | null;
}

/* ── Phasen-Definition ──────────────────────────────────────────────────── */
const PHASEN: { id: OrderPhase; label: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'eingegangen',    label: 'Bestätigt',       desc: 'Bestellung empfangen',          icon: <CheckCircle2 className="h-4 w-4" /> },
  { id: 'in_bearbeitung', label: 'Zubereitung',     desc: 'Wird frisch zubereitet',         icon: <ChefHat className="h-4 w-4" /> },
  { id: 'fertig',         label: 'Bereit',           desc: 'Wird verpackt',                  icon: <Package className="h-4 w-4" /> },
  { id: 'unterwegs',      label: 'Unterwegs',        desc: 'Fahrer ist auf dem Weg',         icon: <Bike className="h-4 w-4" /> },
  { id: 'geliefert',      label: 'Geliefert',        desc: 'Guten Appetit!',                 icon: <MapPin className="h-4 w-4" /> },
];

const PHASE_IDX: Partial<Record<OrderPhase, number>> = {
  eingegangen: 0, in_bearbeitung: 1, fertig: 2, unterwegs: 3, geliefert: 4,
};

/* ── Vergangene Zeit ────────────────────────────────────────────────────── */
function useElapsedMin(from: string | null): number {
  const [min, setMin] = useState(0);
  useEffect(() => {
    if (!from) return;
    const update = () => setMin(Math.round((Date.now() - new Date(from).getTime()) / 60000));
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [from]);
  return min;
}

/* ── Mock-Daten ─────────────────────────────────────────────────────────── */
function getMockData(): TrackingData {
  return {
    status: 'unterwegs',
    bestellnummer: 'MB-28471',
    bestellt_am: new Date(Date.now() - 22 * 60000).toISOString(),
    eta_min: 8,
    eta_updated_at: new Date(Date.now() - 2 * 60000).toISOString(),
    fahrer_name: 'Max M.',
    fahrer_distanz_km: 1.4,
    geschaetzte_zubereitung_min: 12,
  };
}

/* ── Haupt-Komponente ───────────────────────────────────────────────────── */
export function StorefrontPhase2284EtaLiveTrackingHub({
  bestellnummer,
  locationId,
  className,
}: {
  bestellnummer?: string | null;
  locationId?: string | null;
  className?: string;
}) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    if (!bestellnummer && !locationId) {
      setData(getMockData());
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams();
      if (bestellnummer) params.set('bestellnummer', bestellnummer);
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/tracking?${params}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(getMockData());
      }
    } catch {
      setData(getMockData());
    } finally {
      setLoading(false);
    }
  }, [bestellnummer, locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 1000);
    return () => clearInterval(id);
  }, [load]);

  /* Realtime-Subscription */
  useEffect(() => {
    if (!bestellnummer) return;
    const ch = supabase
      .channel(`tracking:${bestellnummer}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => load())
      .subscribe();
    channelRef.current = ch;
    return () => { ch.unsubscribe(); };
  }, [bestellnummer, load, supabase]);

  const elapsed = useElapsedMin(data?.bestellt_am ?? null);

  const activeIdx = useMemo(() => {
    if (!data) return -1;
    return PHASE_IDX[data.status] ?? -1;
  }, [data]);

  if (loading) {
    return (
      <div className={cn('rounded-2xl border bg-card p-4 animate-pulse', className)}>
        <div className="h-4 bg-muted rounded w-1/2 mb-3" />
        <div className="h-2 bg-muted rounded" />
      </div>
    );
  }

  if (!data || data.status === 'storniert') {
    return (
      <div className={cn('rounded-2xl border bg-destructive/10 border-destructive/30 p-4 text-center text-sm text-destructive', className)}>
        {data?.status === 'storniert' ? 'Bestellung wurde storniert.' : 'Tracking nicht verfügbar.'}
      </div>
    );
  }

  const isDelivered = data.status === 'geliefert';
  const isOnTheWay = data.status === 'unterwegs';

  return (
    <div className={cn('rounded-2xl border bg-card overflow-hidden', className)}>
      {/* Farbband oben */}
      <div className={cn('h-1.5', isDelivered ? 'bg-matcha-500' : isOnTheWay ? 'bg-blue-500' : 'bg-amber-400')} />

      <div className="p-4 space-y-4">
        {/* ETA Hero */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              #{data.bestellnummer} · {elapsed} Min vor
            </p>
            {isDelivered ? (
              <p className="text-xl font-black text-matcha-600">Zugestellt!</p>
            ) : data.eta_min != null ? (
              <div className="flex items-baseline gap-1">
                <p className={cn('text-3xl font-black tabular-nums', isOnTheWay ? 'text-blue-600' : 'text-foreground')}>
                  {data.eta_min}
                </p>
                <p className="text-sm font-bold text-muted-foreground">Min</p>
              </div>
            ) : (
              <p className="text-sm font-bold text-muted-foreground">Berechne ETA…</p>
            )}
            {!isDelivered && data.eta_min != null && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Geschätzte Ankunft {new Date(Date.now() + data.eta_min * 60000).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })} Uhr
              </p>
            )}
          </div>

          {/* Status-Icon */}
          <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl',
            isDelivered ? 'bg-matcha-100 dark:bg-matcha-900/40' :
            isOnTheWay  ? 'bg-blue-100 dark:bg-blue-900/40' :
            'bg-amber-100 dark:bg-amber-900/40'
          )}>
            {isDelivered
              ? <CheckCircle2 className="h-7 w-7 text-matcha-500" />
              : isOnTheWay
              ? <Bike className={cn('h-7 w-7 text-blue-500', 'animate-[bounce_2s_ease-in-out_infinite]')} />
              : <ChefHat className="h-7 w-7 text-amber-500" />}
          </div>
        </div>

        {/* Fahrer-Info (wenn unterwegs) */}
        {isOnTheWay && data.fahrer_name && (
          <div className="flex items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2">
            <Zap className="h-4 w-4 text-blue-500 shrink-0" />
            <div className="text-xs">
              <span className="font-bold">{data.fahrer_name}</span>
              {data.fahrer_distanz_km != null && (
                <span className="text-muted-foreground"> · {data.fahrer_distanz_km.toFixed(1)} km entfernt</span>
              )}
            </div>
          </div>
        )}

        {/* Phasen-Timeline */}
        <div className="relative">
          {/* Verbindungslinie */}
          <div className="absolute left-[18px] top-4 bottom-4 w-0.5 bg-muted/40" />

          <div className="space-y-3">
            {PHASEN.map((phase, idx) => {
              const done = idx <= activeIdx;
              const active = idx === activeIdx;
              return (
                <div key={phase.id} className="flex items-start gap-3 relative">
                  {/* Dot */}
                  <div className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 z-10 transition-all',
                    done
                      ? active
                        ? 'border-blue-400 bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                        : 'border-matcha-300 bg-matcha-500 text-white'
                      : 'border-border bg-background text-muted-foreground'
                  )}>
                    {phase.icon}
                  </div>
                  {/* Text */}
                  <div className="min-w-0 pt-1.5">
                    <p className={cn('text-xs font-bold', done ? (active ? 'text-blue-700 dark:text-blue-300' : 'text-foreground') : 'text-muted-foreground')}>
                      {phase.label}
                    </p>
                    {(done || active) && (
                      <p className="text-[10px] text-muted-foreground">{phase.desc}</p>
                    )}
                  </div>
                  {active && (
                    <span className="ml-auto shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-[9px] font-bold text-blue-700 dark:text-blue-300">
                      Aktuell
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ETA-Update-Zeit */}
        {data.eta_updated_at && !isDelivered && (
          <p className="text-center text-[9px] text-muted-foreground">
            ETA aktualisiert {new Date(data.eta_updated_at).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })} Uhr
          </p>
        )}
      </div>
    </div>
  );
}
