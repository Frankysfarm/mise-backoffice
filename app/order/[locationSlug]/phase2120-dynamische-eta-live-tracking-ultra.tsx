'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, ChefHat, Clock, Package, Star, Zap } from 'lucide-react';

type OrderStatus = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

const PHASE_CONFIG: Array<{ key: OrderStatus; label: string; icon: React.ReactNode; desc: string }> = [
  { key: 'neu',            label: 'Eingegangen',     icon: <Package className="h-4 w-4" />,    desc: 'Bestellung wird geprüft' },
  { key: 'in_zubereitung', label: 'In Zubereitung',  icon: <ChefHat className="h-4 w-4" />,    desc: 'Wird frisch zubereitet' },
  { key: 'fertig',         label: 'Bereit',          icon: <CheckCircle2 className="h-4 w-4" />, desc: 'Wartet auf Fahrer' },
  { key: 'unterwegs',      label: 'Unterwegs',       icon: <Bike className="h-4 w-4" />,        desc: 'Fahrer ist auf dem Weg' },
  { key: 'geliefert',      label: 'Geliefert! 🎉',  icon: <Star className="h-4 w-4" />,        desc: 'Guten Appetit!' },
];

const STATUS_IDX: Record<string, number> = {
  neu: 0, bestätigt: 0, in_zubereitung: 1, fertig: 2, unterwegs: 3, geliefert: 4,
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function EtaDisplay({ etaEarliest, etaLatest }: { etaEarliest: string | null; etaLatest: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  if (!etaEarliest && !etaLatest) return null;

  const etaMs = etaLatest ? new Date(etaLatest).getTime() : etaEarliest ? new Date(etaEarliest).getTime() : null;
  const remainMin = etaMs ? Math.max(0, Math.round((etaMs - now) / 60_000)) : null;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-matcha-50 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-4 w-4 text-matcha-600" />
        <span className="text-xs font-black text-matcha-700">Lieferzeit-Prognose</span>
      </div>

      <div className="flex items-end gap-2">
        {remainMin !== null && (
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-matcha-700 tabular-nums leading-none">{remainMin}</span>
            <span className="text-sm font-bold text-matcha-600">Min</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          {etaEarliest && (
            <div className="text-[10px] text-matcha-600">
              Frühestens {fmtTime(etaEarliest)}
            </div>
          )}
          {etaLatest && (
            <div className="text-[10px] text-matcha-600">
              Spätestens {fmtTime(etaLatest)}
            </div>
          )}
        </div>
      </div>

      {/* Dynamischer Fortschrittsbalken */}
      {etaMs && (
        <div className="mt-2">
          <div className="h-1.5 w-full rounded-full bg-matcha-100 overflow-hidden">
            <div
              className="h-full bg-matcha-500 rounded-full transition-all duration-1000"
              style={{
                width: `${Math.max(5, Math.min(95, 100 - Math.max(0, (etaMs - now) / 36_000)))}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function StorefrontPhase2120DynamischeEtaLiveTrackingUltra({
  orderId,
  locationId,
}: {
  orderId?: string;
  locationId?: string;
}) {
  const supabase = createClient();
  const [status, setStatus] = useState<OrderStatus>('neu');
  const [etaEarliest, setEtaEarliest] = useState<string | null>(null);
  const [etaLatest, setEtaLatest] = useState<string | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }

    async function load() {
      const { data } = await supabase
        .from('orders')
        .select('status, eta_earliest, eta_latest, driver_name')
        .eq('id', orderId)
        .single();

      if (data) {
        setStatus((data.status as OrderStatus) ?? 'neu');
        setEtaEarliest(data.eta_earliest);
        setEtaLatest(data.eta_latest);
        setDriverName(data.driver_name);
      }
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel(`order-tracking-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}`,
      }, payload => {
        const d = payload.new as any;
        if (d.status) setStatus(d.status);
        if (d.eta_earliest !== undefined) setEtaEarliest(d.eta_earliest);
        if (d.eta_latest !== undefined) setEtaLatest(d.eta_latest);
        if (d.driver_name !== undefined) setDriverName(d.driver_name);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white px-4 py-6 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-matcha-600 mb-2" />
        <div className="text-xs text-stone-500">Lade Tracking...</div>
      </div>
    );
  }

  const currentIdx = STATUS_IDX[status] ?? 0;

  return (
    <div className="space-y-3">
      {/* ETA */}
      {status !== 'geliefert' && (
        <EtaDisplay etaEarliest={etaEarliest} etaLatest={etaLatest} />
      )}

      {/* Statustracking */}
      <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-matcha-600" />
            <span className="text-xs font-black text-char uppercase tracking-wide">Live-Tracking</span>
            <div className="ml-auto flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-matcha-500 animate-pulse" />
              <span className="text-[9px] text-stone-400">Live</span>
            </div>
          </div>
        </div>

        <div className="px-4 py-4 space-y-0">
          {PHASE_CONFIG.map((phase, idx) => {
            const done = idx < currentIdx;
            const active = idx === currentIdx;
            const pending = idx > currentIdx;

            return (
              <div key={phase.key} className="flex items-start gap-3">
                {/* Icon + Connector */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full transition-all',
                      done    && 'bg-matcha-500 text-white',
                      active  && 'bg-matcha-600 text-white ring-4 ring-matcha-100',
                      pending && 'bg-stone-100 text-stone-400',
                    )}
                  >
                    {done
                      ? <CheckCircle2 className="h-4 w-4" />
                      : phase.icon}
                  </div>
                  {idx < PHASE_CONFIG.length - 1 && (
                    <div className={cn('w-0.5 flex-1 my-1 min-h-[20px]', done ? 'bg-matcha-400' : 'bg-stone-200')} />
                  )}
                </div>

                {/* Label */}
                <div className="pb-4 min-w-0 flex-1">
                  <div className={cn(
                    'text-sm font-bold leading-none mt-1.5',
                    active ? 'text-matcha-700' : done ? 'text-stone-500 line-through' : 'text-stone-400',
                  )}>
                    {phase.label}
                  </div>
                  {active && (
                    <div className="text-[10px] text-matcha-600 mt-0.5 flex items-center gap-1">
                      <div className="h-1 w-1 rounded-full bg-matcha-500 animate-pulse" />
                      {phase.desc}
                      {phase.key === 'unterwegs' && driverName && ` · ${driverName}`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Geliefert Banner */}
      {status === 'geliefert' && (
        <div className="rounded-2xl border border-matcha-300 bg-matcha-50 px-4 py-5 text-center">
          <div className="text-3xl mb-1">🎉</div>
          <div className="text-sm font-black text-matcha-700">Dein Essen ist angekommen!</div>
          <div className="text-[11px] text-matcha-600 mt-0.5">Guten Appetit! Bewerte deine Bestellung.</div>
          <div className="mt-3 flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-matcha-100 transition-colors">
                <Star className="h-5 w-5 text-amber-400" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
