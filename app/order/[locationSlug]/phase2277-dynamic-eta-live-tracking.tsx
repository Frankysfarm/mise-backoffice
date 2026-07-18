'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, ChefHat, Clock, MapPin, Package, Zap } from 'lucide-react';

/* ── Typen ─────────────────────────────────────────────────────────────── */
type Phase = 'eingegangen' | 'in_bearbeitung' | 'fertig' | 'unterwegs' | 'geliefert' | 'storniert';

interface TrackingData {
  status: Phase;
  bestellnummer: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  fahrer_name: string | null;
  eta_min: number | null;
}

/* ── Phasen-Konfiguration ───────────────────────────────────────────────── */
const PHASEN: { id: Phase; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'eingegangen',    label: 'Bestätigt',    icon: <CheckCircle2 className="h-4 w-4" />, desc: 'Deine Bestellung wurde empfangen' },
  { id: 'in_bearbeitung', label: 'Wird zubereitet', icon: <ChefHat className="h-4 w-4" />,    desc: 'Das Küchen-Team kümmert sich drum' },
  { id: 'fertig',         label: 'Bereit',        icon: <Package className="h-4 w-4" />,      desc: 'Wir verpacken deine Bestellung' },
  { id: 'unterwegs',      label: 'Unterwegs',     icon: <Bike className="h-4 w-4" />,         desc: 'Dein Fahrer ist auf dem Weg' },
  { id: 'geliefert',      label: 'Zugestellt',    icon: <MapPin className="h-4 w-4" />,       desc: 'Guten Appetit! 🎉' },
];

function phaseIndex(status: Phase): number {
  const idx = PHASEN.findIndex(p => p.id === status);
  return idx >= 0 ? idx : 0;
}

/* ── ETA-Berechnung ─────────────────────────────────────────────────────── */
function computeEta(data: TrackingData): { minuten: number | null; label: string } {
  if (data.status === 'geliefert') return { minuten: null, label: 'Zugestellt ✓' };
  if (data.status === 'storniert') return { minuten: null, label: 'Storniert' };

  if (data.eta_min !== null) {
    return { minuten: data.eta_min, label: `~${data.eta_min} Min` };
  }

  if (data.bestellt_am && data.geschaetzte_zubereitung_min) {
    const ordered = new Date(data.bestellt_am).getTime();
    const totalMin = data.geschaetzte_zubereitung_min + 15; // +15 for delivery
    const eta = ordered + totalMin * 60_000;
    const remaining = Math.max(0, Math.ceil((eta - Date.now()) / 60_000));
    return { minuten: remaining, label: `~${remaining} Min` };
  }

  return { minuten: null, label: 'Wird berechnet…' };
}

/* ── Countdown-Ring ─────────────────────────────────────────────────────── */
function EtaRing({ minuten, status }: { minuten: number | null; status: Phase }) {
  if (status === 'geliefert') {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-matcha-100 dark:bg-matcha-900/40">
        <CheckCircle2 className="h-10 w-10 text-matcha-500" />
      </div>
    );
  }
  if (status === 'storniert') {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
        <span className="text-2xl">✕</span>
      </div>
    );
  }
  return (
    <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40 border-2 border-blue-200 dark:border-blue-800">
      {minuten !== null ? (
        <>
          <span className="text-2xl font-black tabular-nums text-blue-700">{minuten}</span>
          <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wide">Min</span>
        </>
      ) : (
        <Clock className="h-8 w-8 text-blue-400 animate-pulse" />
      )}
    </div>
  );
}

/* ── Phasen-Timeline ────────────────────────────────────────────────────── */
function PhasenTimeline({ status }: { status: Phase }) {
  const currentIdx = phaseIndex(status);

  return (
    <div className="space-y-0">
      {PHASEN.map((phase, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isPending = idx > currentIdx;

        return (
          <div key={phase.id} className="flex items-start gap-3">
            {/* Icon & Connector */}
            <div className="flex flex-col items-center">
              <div className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all',
                isDone ? 'bg-matcha-500 text-white' :
                isCurrent ? 'bg-blue-500 text-white ring-2 ring-blue-300 ring-offset-1' :
                'bg-muted text-muted-foreground',
              )}>
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : phase.icon}
              </div>
              {idx < PHASEN.length - 1 && (
                <div className={cn('mt-0.5 h-6 w-0.5 rounded-full', isDone ? 'bg-matcha-400' : 'bg-muted/40')} />
              )}
            </div>

            {/* Text */}
            <div className={cn('pb-4 pt-1.5 min-w-0 flex-1', isPending && 'opacity-40')}>
              <p className={cn('text-xs font-bold', isCurrent && 'text-blue-700 dark:text-blue-400')}>
                {phase.label}
              </p>
              {isCurrent && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{phase.desc}</p>
              )}
            </div>

            {isCurrent && (
              <span className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 mt-1.5">
                Aktuell
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Haupt-Komponente ───────────────────────────────────────────────────── */
export function StorefrontPhase2277DynamicEtaLiveTracking({ orderId }: { orderId?: string | null }) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [tick, setTick] = useState(0);
  const supaRef = useRef(createClient());

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000); // Update every 30s
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!orderId) return;
    const supa = supaRef.current;

    async function load() {
      const { data: order } = await supa
        .from('customer_orders')
        .select('id,status,bestellnummer,bestellt_am,geschaetzte_zubereitung_min')
        .eq('id', orderId)
        .maybeSingle();

      if (!order) return;

      // Try to get driver info
      const { data: batch } = await supa
        .from('delivery_batches')
        .select('id,total_eta_min,employee:employees(vorname,nachname)')
        .contains('order_ids', [orderId])
        .in('status', ['unterwegs', 'on_route', 'gestartet'])
        .maybeSingle();

      const batchAny = batch as Record<string, unknown> | null;

      setData({
        status: order.status as Phase,
        bestellnummer: order.bestellnummer,
        bestellt_am: order.bestellt_am,
        geschaetzte_zubereitung_min: order.geschaetzte_zubereitung_min,
        fahrer_name: batchAny?.employee
          ? `${(batchAny.employee as Record<string, unknown>).vorname ?? ''} ${(batchAny.employee as Record<string, unknown>).nachname ?? ''}`.trim()
          : null,
        eta_min: batchAny?.total_eta_min as number | null ?? null,
      });
    }

    load();
    const sub = supa
      .channel(`phase2277-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` }, load)
      .subscribe();
    return () => { supa.removeChannel(sub); };
  }, [orderId, tick]);

  if (!orderId || !data) return null;
  if (data.status === 'storniert') return null;

  const { minuten, label } = computeEta(data);

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* ETA Hero */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">Bestellung #{data.bestellnummer}</p>
            <p className="text-lg font-black mt-0.5">
              {data.status === 'geliefert' ? 'Zugestellt!' : 'Kommt bald!'}
            </p>
            {data.fahrer_name && data.status === 'unterwegs' && (
              <p className="text-xs opacity-80 mt-0.5 flex items-center gap-1">
                <Bike className="h-3 w-3" /> {data.fahrer_name} ist unterwegs
              </p>
            )}
          </div>
          <EtaRing minuten={minuten} status={data.status} />
        </div>

        {minuten !== null && data.status !== 'geliefert' && (
          <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
            <Zap className="h-4 w-4 shrink-0" />
            <div>
              <p className="text-xs font-bold">Erwartete Lieferzeit</p>
              <p className="text-[10px] opacity-80">{label}</p>
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="p-4">
        <PhasenTimeline status={data.status} />
      </div>
    </div>
  );
}
