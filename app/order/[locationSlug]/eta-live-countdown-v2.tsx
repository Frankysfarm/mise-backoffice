'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Bike, ChefHat, CheckCircle2, Clock, Package, Truck } from 'lucide-react';

interface Props {
  orderId: string;
  initialStatus?: string | null;
  initialEtaEarliest?: string | null;
  initialEtaLatest?: string | null;
  initialPrepMin?: number | null;
}

type StatusKey = 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

const STATUS_FLOW: StatusKey[] = ['bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];
const STATUS_META: Record<StatusKey, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  bestätigt:     { label: 'Bestätigt',    icon: CheckCircle2, color: 'text-blue-400',   bg: 'bg-blue-500' },
  in_zubereitung:{ label: 'Zubereitung',  icon: ChefHat,      color: 'text-amber-400',  bg: 'bg-amber-500' },
  fertig:        { label: 'Bereit',        icon: Package,      color: 'text-matcha-400', bg: 'bg-matcha-500' },
  unterwegs:     { label: 'Unterwegs',    icon: Bike,         color: 'text-purple-400', bg: 'bg-purple-500' },
  geliefert:     { label: 'Geliefert! 🎉', icon: Truck,        color: 'text-emerald-400', bg: 'bg-emerald-500' },
};

const STATUS_ALIASES: Record<string, StatusKey> = {
  angenommen: 'bestätigt', accepted: 'bestätigt',
  preparing: 'in_zubereitung',
  ready: 'fertig',
  out_for_delivery: 'unterwegs', picked_up: 'unterwegs',
  delivered: 'geliefert', completed: 'geliefert', abgeholt: 'geliefert',
};

function normalize(status: string | null): StatusKey {
  if (!status) return 'bestätigt';
  if (STATUS_META[status as StatusKey]) return status as StatusKey;
  return STATUS_ALIASES[status] ?? 'bestätigt';
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function CircleProgress({ pct, size = 88, color }: { pct: number; size?: number; color: string }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, pct));
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </svg>
  );
}

export function EtaLiveCountdownV2({ orderId, initialStatus, initialEtaEarliest, initialEtaLatest, initialPrepMin }: Props) {
  const [status, setStatus] = useState<string | null>(initialStatus ?? null);
  const [etaEarliest, setEtaEarliest] = useState<string | null>(initialEtaEarliest ?? null);
  const [etaLatest, setEtaLatest] = useState<string | null>(initialEtaLatest ?? null);
  const [now, setNow] = useState(Date.now());
  const mountedAt = useRef(Date.now());

  // Realtime tick
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Supabase realtime subscription
  useEffect(() => {
    if (!orderId) return;
    const sb = createClient();
    const ch = sb.channel(`eta-v2-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'customer_orders',
        filter: `id=eq.${orderId}`,
      }, (payload) => {
        const r = payload.new as any;
        if (r.status) setStatus(r.status);
        if (r.eta_earliest) setEtaEarliest(r.eta_earliest);
        if (r.eta_latest) setEtaLatest(r.eta_latest);
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [orderId]);

  const normalStatus = normalize(status);
  const stepIdx = STATUS_FLOW.indexOf(normalStatus);
  const isDelivered = normalStatus === 'geliefert';

  // ETA countdown
  const etaMs = etaEarliest ? new Date(etaEarliest).getTime() - now : null;
  const etaLatestMs = etaLatest ? new Date(etaLatest).getTime() - now : null;
  const elapsedMs = now - mountedAt.current;
  const totalWindowMs = etaLatest && etaEarliest
    ? new Date(etaLatest).getTime() - mountedAt.current
    : (initialPrepMin ?? 30) * 60 * 1000;
  const progressPct = Math.min(1, elapsedMs / totalWindowMs);

  const etaDisplay = etaMs != null && etaMs > 0
    ? fmtCountdown(etaMs)
    : etaMs != null && etaMs <= 0 && !isDelivered
    ? 'Jeden Moment'
    : null;

  const etaLabel = etaEarliest
    ? new Date(etaEarliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;

  const meta = STATUS_META[normalStatus];

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-5 space-y-5">
      {/* Header with animated status */}
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', meta.bg + '/20 border border-current/20')}>
          <meta.icon className={cn('h-5 w-5', meta.color)} />
        </div>
        <div>
          <div className={cn('text-sm font-black', meta.color)}>{meta.label}</div>
          {etaLabel && !isDelivered && (
            <div className="text-[10px] text-white/40">Ankunft ca. {etaLabel} Uhr</div>
          )}
        </div>
      </div>

      {/* ETA Ring + Countdown */}
      {!isDelivered && (
        <div className="flex items-center justify-center gap-6">
          <div className="relative">
            <CircleProgress
              pct={progressPct}
              size={88}
              color={normalStatus === 'unterwegs' ? '#a855f7' : normalStatus === 'fertig' ? '#4a7c59' : '#f59e0b'}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-lg font-black text-white leading-none tabular-nums">
                {etaDisplay ?? (etaMs != null && etaMs <= 0 ? '~0' : '–')}
              </span>
              {etaDisplay && etaDisplay !== 'Jeden Moment' && (
                <span className="text-[8px] text-white/40 font-bold uppercase">verbleibend</span>
              )}
            </div>
          </div>

          {etaLatest && !isDelivered && (
            <div className="space-y-1">
              <div className="text-[9px] font-bold uppercase tracking-wider text-white/30">Lieferfenster</div>
              <div className="text-xs text-white/70 font-bold">
                {etaEarliest ? new Date(etaEarliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '–'}
                {' – '}
                {new Date(etaLatest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {etaLatestMs != null && etaLatestMs < 0 && (
                <div className="text-[10px] text-amber-400 font-bold">Sollte ankommen!</div>
              )}
            </div>
          )}
        </div>
      )}

      {isDelivered && (
        <div className="flex items-center justify-center py-2">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 border-2 border-emerald-500">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <span className="text-sm font-bold text-emerald-300">Zugestellt — Guten Appetit!</span>
          </div>
        </div>
      )}

      {/* Step progress */}
      <div className="flex items-center gap-0">
        {STATUS_FLOW.map((step, i) => {
          const done = i < stepIdx;
          const active = i === stepIdx;
          const StepIcon = STATUS_META[step].icon;
          return (
            <div key={step} className="flex items-center flex-1">
              <div className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] transition-all',
                done ? 'border-matcha-500 bg-matcha-600 text-white' :
                active ? cn('border-current text-white', STATUS_META[step].color, 'ring-2 ring-current ring-offset-1 ring-offset-slate-950') :
                'border-white/15 bg-white/5 text-white/30',
              )}>
                {done ? '✓' : <StepIcon className="h-3.5 w-3.5" />}
              </div>
              {i < STATUS_FLOW.length - 1 && (
                <div className={cn('flex-1 h-0.5 mx-0.5 rounded-full', done ? 'bg-matcha-500' : 'bg-white/10')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step labels */}
      <div className="flex items-start -mt-1">
        {STATUS_FLOW.map((step, i) => (
          <div key={step} className={cn('flex-1 text-center text-[8px] font-bold truncate px-0.5', i === stepIdx ? STATUS_META[step].color : 'text-white/25')}>
            {STATUS_META[step].label.replace(' 🎉', '')}
          </div>
        ))}
      </div>
    </div>
  );
}
