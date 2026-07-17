'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Bike, CheckCircle2, ChefHat, Clock, MapPin, Navigation2, Package, Timer } from 'lucide-react';

/* ── Phasen ──────────────────────────────────────────────────────────────── */
type DeliveryPhase = 'bestätigt' | 'küche' | 'bereit' | 'unterwegs' | 'angekommen' | 'geliefert';

const PHASE_META: Record<DeliveryPhase, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  bestätigt:  { label: 'Bestätigt',     icon: Package,       color: 'text-blue-600',    bg: 'bg-blue-50'    },
  küche:      { label: 'In der Küche',  icon: ChefHat,       color: 'text-amber-600',   bg: 'bg-amber-50'   },
  bereit:     { label: 'Bereit',        icon: CheckCircle2,  color: 'text-green-600',   bg: 'bg-green-50'   },
  unterwegs:  { label: 'Unterwegs',     icon: Bike,          color: 'text-matcha-600',  bg: 'bg-matcha-50'  },
  angekommen: { label: 'Fast da!',      icon: Navigation2,   color: 'text-matcha-700',  bg: 'bg-matcha-100' },
  geliefert:  { label: 'Geliefert',     icon: CheckCircle2,  color: 'text-green-700',   bg: 'bg-green-100'  },
};

const PHASE_ORDER: DeliveryPhase[] = ['bestätigt', 'küche', 'bereit', 'unterwegs', 'angekommen', 'geliefert'];

/* ── Countdown-Anzeige ──────────────────────────────────────────────────── */
function LiveCountdown({ restSec, phase }: { restSec: number | null; phase: DeliveryPhase }) {
  if (restSec === null || phase === 'geliefert') return null;
  if (restSec <= 0) {
    return (
      <div className="rounded-2xl bg-green-50 border border-green-200 px-4 py-3 text-center">
        <div className="text-2xl font-black text-green-600">Jeden Moment!</div>
        <div className="text-xs text-green-500 mt-0.5">Deine Bestellung ist gleich da</div>
      </div>
    );
  }
  const min = Math.floor(restSec / 60);
  const sec = restSec % 60;
  const urgent = restSec < 5 * 60;

  return (
    <div className={cn(
      'rounded-2xl border px-4 py-3 text-center',
      urgent ? 'bg-matcha-50 border-matcha-300' : 'bg-white border-border',
    )}>
      <div className={cn('text-4xl font-black tabular-nums tracking-tight', urgent ? 'text-matcha-700' : 'text-foreground')}>
        {String(min).padStart(2, '0')}:{String(sec).padStart(2, '0')}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">Geschätzte Restzeit</div>
      {urgent && (
        <div className="mt-1 text-xs font-bold text-matcha-600">
          Deine Lieferung ist fast da!
        </div>
      )}
    </div>
  );
}

/* ── Phasen-Timeline ────────────────────────────────────────────────────── */
function PhaseTimeline({ currentPhase }: { currentPhase: DeliveryPhase }) {
  const currentIdx = PHASE_ORDER.indexOf(currentPhase);
  return (
    <div className="flex items-center">
      {PHASE_ORDER.filter(p => p !== 'angekommen').map((phase, idx, arr) => {
        const realIdx = PHASE_ORDER.indexOf(phase);
        const done    = realIdx < currentIdx;
        const active  = realIdx === currentIdx;
        const meta    = PHASE_META[phase];
        const Icon    = meta.icon;

        return (
          <div key={phase} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all',
                done   ? 'bg-matcha-600 border-matcha-600'  :
                active ? 'bg-white border-matcha-500 shadow-md shadow-matcha-100' :
                         'bg-muted/30 border-muted',
              )}>
                <Icon className={cn('h-3.5 w-3.5', done ? 'text-white' : active ? meta.color : 'text-muted-foreground')} />
              </div>
              <span className={cn(
                'text-[9px] font-bold text-center leading-tight max-w-[52px]',
                active ? meta.color : done ? 'text-matcha-600' : 'text-muted-foreground/50',
              )}>
                {meta.label}
              </span>
            </div>
            {idx < arr.length - 1 && (
              <div className={cn('flex-1 h-0.5 -mt-5', done || active ? 'bg-matcha-400' : 'bg-muted')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Fahrer-Position (Proximity) ────────────────────────────────────────── */
function DriverProximity({ distanceM }: { distanceM: number | null }) {
  if (distanceM === null) return null;
  const km = distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)} km` : `${distanceM} m`;
  const near = distanceM < 500;
  return (
    <div className={cn(
      'flex items-center gap-2 rounded-xl border px-3 py-2',
      near ? 'bg-matcha-50 border-matcha-200' : 'bg-muted/30 border-border',
    )}>
      <MapPin className={cn('h-4 w-4 shrink-0', near ? 'text-matcha-600' : 'text-muted-foreground')} />
      <div>
        <div className={cn('text-xs font-bold', near ? 'text-matcha-700' : 'text-foreground')}>
          {near ? 'Fahrer ist fast bei dir!' : `Fahrer noch ${km} entfernt`}
        </div>
        <div className="text-[10px] text-muted-foreground">Live-Standort</div>
      </div>
      {near && (
        <span className="ml-auto text-[10px] font-black text-matcha-600 bg-matcha-100 rounded-full px-2 py-0.5">
          Gleich da
        </span>
      )}
    </div>
  );
}

/* ── Haupt-Komponente ───────────────────────────────────────────────────── */
export function Phase2100LiveEtaTrackingFinal({
  orderId,
}: {
  orderId?: string | null;
}) {
  const [phase, setPhase] = useState<DeliveryPhase>('bestätigt');
  const [restSec, setRestSec] = useState<number | null>(null);
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [fahrerName, setFahrerName] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const targetRef = useRef<Date | null>(null);
  const supaRef   = useRef(createClient());

  /* Tick */
  useEffect(() => {
    const iv = setInterval(() => {
      setTick(t => t + 1);
      if (targetRef.current) {
        const sec = Math.floor((targetRef.current.getTime() - Date.now()) / 1000);
        setRestSec(sec);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  /* Daten laden */
  useEffect(() => {
    if (!orderId) return;
    const supa = supaRef.current;

    async function load() {
      const { data: order } = await supa
        .from('orders')
        .select('id,status,type,estimated_delivery_at,estimated_delivery_min')
        .eq('id', orderId)
        .single();

      if (!order) return;

      /* Status → Phase mappen */
      const statusMap: Record<string, DeliveryPhase> = {
        eingegangen: 'bestätigt', angenommen: 'bestätigt',
        in_bearbeitung: 'küche', zubereitungs: 'küche',
        bereit: 'bereit', fertig: 'bereit',
        unterwegs: 'unterwegs', abgeholt: 'unterwegs',
        geliefert: 'geliefert', abgeschlossen: 'geliefert',
      };
      setPhase(statusMap[order.status] ?? 'bestätigt');

      const etaAt = order.estimated_delivery_at
        ? new Date(order.estimated_delivery_at)
        : order.estimated_delivery_min
          ? new Date(Date.now() + order.estimated_delivery_min * 60 * 1000)
          : null;

      targetRef.current = etaAt;
      if (etaAt) {
        setRestSec(Math.floor((etaAt.getTime() - Date.now()) / 1000));
      }

      /* Fahrer-Info */
      const { data: batch } = await supa
        .from('delivery_batches')
        .select('driver_id,driver_distance_m')
        .contains('order_ids', [orderId])
        .in('status', ['unterwegs', 'abgeholt'])
        .limit(1)
        .single();

      if (batch) {
        setDistanceM(batch.driver_distance_m ?? null);
        if (batch.driver_id) {
          const { data: driver } = await supa
            .from('drivers')
            .select('name')
            .eq('id', batch.driver_id)
            .single();
          setFahrerName(driver?.name ?? null);
        }
      }
    }

    load();
    const ch = supa
      .channel(`eta-tracking-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, load)
      .subscribe();

    return () => { supa.removeChannel(ch); };
  }, [orderId]);

  if (!orderId) return null;

  const phaseMeta = PHASE_META[phase];
  const PhaseIcon = phaseMeta.icon;

  return (
    <div className="space-y-4">
      {/* Aktuelle Phase */}
      <div className={cn('rounded-2xl border px-4 py-3 flex items-center gap-3', phaseMeta.bg)}>
        <div className={cn('h-10 w-10 rounded-full flex items-center justify-center', phaseMeta.bg, 'border border-current/20')}>
          <PhaseIcon className={cn('h-5 w-5', phaseMeta.color)} />
        </div>
        <div>
          <div className={cn('text-base font-black', phaseMeta.color)}>{phaseMeta.label}</div>
          <div className="text-xs text-muted-foreground">
            {phase === 'küche'      && 'Dein Essen wird zubereitet…'}
            {phase === 'bereit'     && 'Fertig – Fahrer kommt gleich!'}
            {phase === 'unterwegs'  && (fahrerName ? `${fahrerName} ist unterwegs zu dir` : 'Fahrer ist unterwegs')}
            {phase === 'angekommen' && 'Dein Fahrer ist gleich da!'}
            {phase === 'geliefert'  && 'Guten Appetit! 🎉'}
            {phase === 'bestätigt'  && 'Deine Bestellung wurde bestätigt'}
          </div>
        </div>
        {phase !== 'geliefert' && restSec !== null && restSec > 0 && (
          <div className="ml-auto flex items-center gap-1 shrink-0">
            <Timer className={cn('h-3.5 w-3.5', phaseMeta.color)} />
            <span className={cn('text-sm font-black tabular-nums', phaseMeta.color)}>
              ~{Math.ceil(restSec / 60)} Min
            </span>
          </div>
        )}
      </div>

      {/* Countdown */}
      {phase !== 'geliefert' && (
        <LiveCountdown restSec={restSec} phase={phase} />
      )}

      {/* Timeline */}
      <PhaseTimeline currentPhase={phase} />

      {/* Fahrer-Nähe (nur wenn unterwegs) */}
      {(phase === 'unterwegs' || phase === 'angekommen') && (
        <DriverProximity distanceM={distanceM} />
      )}

      {/* Geliefert-Abschluss */}
      {phase === 'geliefert' && (
        <div className="rounded-2xl border border-green-200 bg-green-50 text-center px-4 py-6">
          <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
          <div className="text-lg font-black text-green-700">Geliefert!</div>
          <div className="text-xs text-green-600 mt-1">Wir hoffen, es schmeckt 😊</div>
        </div>
      )}
    </div>
  );
}
