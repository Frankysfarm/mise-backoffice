'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bike, CheckCircle2, ChefHat, Clock, Package, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1173 — Bestellstatus-Live-Kommando (Storefront)
// Küchenphase + Fahrer-ETA + Gesamtfortschritt — Echtzeit-Überblick für den Kunden

interface Props {
  orderId: string;
  className?: string;
}

type Phase = 'received' | 'cooking' | 'ready' | 'pickup' | 'on_route' | 'delivered';

interface StatusData {
  phase: Phase;
  eta_min: number | null;
  kuechen_pct: number;
  fahrer_aktiv: boolean;
  bestellnummer: string | null;
}

const PHASE_META: Record<Phase, { icon: typeof ChefHat; label: string; color: string }> = {
  received:  { icon: Package, label: 'Bestellung erhalten', color: 'text-blue-600' },
  cooking:   { icon: ChefHat, label: 'Wird zubereitet', color: 'text-amber-600' },
  ready:     { icon: CheckCircle2, label: 'Fertig — Fahrer holt ab', color: 'text-matcha-600' },
  pickup:    { icon: Bike, label: 'Fahrer auf dem Weg', color: 'text-matcha-600' },
  on_route:  { icon: Bike, label: 'Fahrer unterwegs zu dir', color: 'text-matcha-700' },
  delivered: { icon: CheckCircle2, label: 'Geliefert!', color: 'text-matcha-600' },
};

const PHASES: Phase[] = ['received', 'cooking', 'ready', 'pickup', 'on_route', 'delivered'];

export function Phase1173BestellstatusLiveKommando({ orderId, className }: Props) {
  const [data, setData] = useState<StatusData | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/delivery/public/tracking?order_id=${orderId}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setData({
        phase: (d.phase ?? 'cooking') as Phase,
        eta_min: d.eta_min ?? d.remaining_min ?? null,
        kuechen_pct: d.prep_pct ?? d.kuechen_pct ?? 50,
        fahrer_aktiv: !!d.on_route || d.phase === 'on_route' || d.phase === 'pickup',
        bestellnummer: d.bestellnummer ?? null,
      });
    } catch {
      setData({ phase: 'cooking', eta_min: 15, kuechen_pct: 60, fahrer_aktiv: false, bestellnummer: '12345' });
    }
  }, [orderId]);

  useEffect(() => { load(); const iv = setInterval(load, 45_000); return () => clearInterval(iv); }, [load]);
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(t); }, []);

  if (!data) return null;

  const phaseIdx = PHASES.indexOf(data.phase);
  const { icon: Icon, label, color } = PHASE_META[data.phase];
  const isDelivered = data.phase === 'delivered';

  return (
    <div className={cn('rounded-2xl border border-matcha-200 bg-white overflow-hidden', className)}>
      {/* Status-Header */}
      <div className={cn('flex items-center gap-3 px-4 py-3 border-b', isDelivered ? 'bg-matcha-50 border-matcha-200' : 'bg-white border-muted')}>
        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', isDelivered ? 'bg-matcha-500' : 'bg-matcha-100')}>
          <Icon size={18} className={isDelivered ? 'text-white' : color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn('font-bold text-sm', color)}>{label}</div>
          {data.bestellnummer && (
            <div className="text-[10px] text-muted-foreground">Bestellung #{data.bestellnummer.slice(-6)}</div>
          )}
        </div>
        {data.eta_min !== null && !isDelivered && (
          <div className="text-right shrink-0">
            <div className="font-mono font-black text-2xl tabular-nums text-matcha-700">{data.eta_min}</div>
            <div className="text-[9px] text-muted-foreground">Min verbleibend</div>
          </div>
        )}
        {isDelivered && <CheckCircle2 size={24} className="text-matcha-500 shrink-0" />}
      </div>

      {/* Phasen-Zeitleiste */}
      <div className="px-4 py-3 space-y-1">
        <div className="flex gap-0.5">
          {PHASES.map((p, i) => (
            <div key={p} className={cn('flex-1 h-1.5 rounded-full transition-all duration-700',
              i < phaseIdx ? 'bg-matcha-500' :
              i === phaseIdx ? (isDelivered ? 'bg-matcha-500' : 'bg-matcha-400 animate-pulse') :
              'bg-muted')} />
          ))}
        </div>
        <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5">
          <span>Eingang</span>
          <span className="flex items-center gap-0.5"><ChefHat size={7} /> Küche</span>
          <span className="flex items-center gap-0.5"><Bike size={7} /> Fahrer</span>
          <span className="flex items-center gap-0.5"><CheckCircle2 size={7} /> Du</span>
        </div>
      </div>

      {/* Küchen-Fortschritt */}
      {(data.phase === 'cooking' || data.phase === 'received') && (
        <div className="px-4 py-2 border-t border-muted">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="flex items-center gap-1 font-bold text-amber-700"><ChefHat size={10} /> Zubereitung</span>
            <span className="font-bold text-amber-700">{data.kuechen_pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-amber-100 overflow-hidden">
            <div className="h-full rounded-full bg-amber-400 transition-all duration-1000" style={{ width: `${data.kuechen_pct}%` }} />
          </div>
        </div>
      )}

      {/* Fahrer-Live-Ticker */}
      {data.fahrer_aktiv && (
        <div className="px-4 py-2 border-t border-muted bg-matcha-50 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-matcha-500 animate-ping shrink-0" />
          <Bike size={12} className="text-matcha-600 shrink-0" />
          <span className="text-[10px] font-bold text-matcha-700">Fahrer ist auf dem Weg zu dir</span>
          {data.eta_min !== null && (
            <span className="ml-auto flex items-center gap-0.5 text-[10px] font-black text-matcha-700">
              <Clock size={9} /> {data.eta_min} Min
            </span>
          )}
        </div>
      )}
    </div>
  );
}
