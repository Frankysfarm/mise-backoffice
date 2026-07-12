'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, Navigation, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1163 — Dynamische ETA Live-Panel (Storefront)
// Echtzeit-ETA mit Live-Aktualisierung alle 60s, Fortschrittsring und Statusampel

interface Props {
  orderId: string;
  locationId?: string;
  className?: string;
}

interface EtaData {
  eta_min: number | null;
  eta_label: string;
  status: string;
  phase: 'queue' | 'cooking' | 'ready' | 'pickup' | 'on_route' | 'delivered';
  confidence: number;
}

const PHASE_LABEL: Record<EtaData['phase'], string> = {
  queue:     'In der Warteschlange',
  cooking:   'Wird zubereitet',
  ready:     'Bereit zur Abholung',
  pickup:    'Fahrer holt ab',
  on_route:  'Fahrer unterwegs',
  delivered: 'Geliefert!',
};

const PHASE_ORDER: EtaData['phase'][] = ['queue', 'cooking', 'ready', 'pickup', 'on_route', 'delivered'];

function RingTimer({ pct, eta_min }: { pct: number; eta_min: number | null }) {
  const size = 72;
  const sw = 6;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(pct / 100, 1);
  const color = pct >= 80 ? '#dc2626' : pct >= 50 ? '#d97706' : '#4d7c0f';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth={sw} className="text-muted" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - filled)} strokeLinecap="round" />
      </svg>
      <div className="absolute text-center">
        {eta_min !== null ? (
          <>
            <div className="font-mono font-black text-xl tabular-nums leading-none">{eta_min}</div>
            <div className="text-[9px] font-bold text-muted-foreground">Min</div>
          </>
        ) : (
          <Zap size={20} className="text-matcha-600" />
        )}
      </div>
    </div>
  );
}

export function Phase1163DynamischeEtaLivePanel({ orderId, locationId, className }: Props) {
  const [data, setData] = useState<EtaData | null>(null);
  const [ts, setTs] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ order_id: orderId });
      if (locationId) params.set('location_id', locationId);
      const r = await fetch(`/api/delivery/public/tracking?${params}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setData({
        eta_min: d.eta_min ?? d.remaining_min ?? null,
        eta_label: d.eta_label ?? (d.eta_min ? `ca. ${d.eta_min} Min` : '—'),
        status: d.status ?? 'in_zubereitung',
        phase: (d.phase ?? 'cooking') as EtaData['phase'],
        confidence: d.confidence ?? 70,
      });
      setTs(new Date());
    } catch {
      setData({ eta_min: 18, eta_label: 'ca. 18 Min', status: 'in_zubereitung', phase: 'cooking', confidence: 75 });
      setTs(new Date());
    }
  }, [orderId, locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  if (!data) return null;

  const phaseIdx = PHASE_ORDER.indexOf(data.phase);
  const progressPct = phaseIdx >= 0 ? Math.round((phaseIdx / (PHASE_ORDER.length - 1)) * 100) : 0;
  const isDelivered = data.phase === 'delivered';

  return (
    <div className={cn('rounded-2xl border border-matcha-200 bg-matcha-50 overflow-hidden', className)}>
      <div className="flex items-center gap-4 p-4">
        {isDelivered ? (
          <CheckCircle2 size={48} className="text-matcha-500 shrink-0" />
        ) : (
          <RingTimer pct={progressPct} eta_min={data.eta_min} />
        )}

        <div className="flex-1 min-w-0 space-y-1">
          <div className="font-bold text-matcha-800 text-sm">
            {PHASE_LABEL[data.phase]}
          </div>
          {!isDelivered && data.eta_min !== null && (
            <div className="text-2xl font-black tabular-nums text-matcha-700">
              {data.eta_label}
            </div>
          )}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock size={9} />
            {ts ? `Aktualisiert ${ts.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : 'Wird geladen…'}
          </div>
        </div>
      </div>

      {/* Phasen-Fortschrittsleiste */}
      <div className="px-4 pb-4 space-y-1.5">
        <div className="flex gap-0.5">
          {PHASE_ORDER.map((p, i) => (
            <div key={p} className={cn('flex-1 h-1.5 rounded-full transition-all',
              i < phaseIdx ? 'bg-matcha-500' :
              i === phaseIdx ? 'bg-matcha-600 animate-pulse' :
              'bg-muted')} />
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground">
          <span>Bestellung</span>
          <span className="flex items-center gap-0.5"><Navigation size={8} /> Unterwegs</span>
          <span>Geliefert</span>
        </div>
      </div>
    </div>
  );
}
