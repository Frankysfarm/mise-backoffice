'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  status: string;
  estimated_prep_min?: number | null;
  in_zubereitung_seit?: string | null;
  bestellt_am?: string | null;
};

type AuslastungsStufe = 'normal' | 'erhoeht' | 'ueberlast';

const STUFEN_CFG: Record<AuslastungsStufe, {
  label: string; farbe: string; ring: string; bg: string; Icon: React.ElementType; pulse: boolean;
}> = {
  normal:    { label: 'Normal',    farbe: 'text-matcha-700',  ring: 'stroke-matcha-500',  bg: 'bg-matcha-50 border-matcha-200',  Icon: CheckCircle2,   pulse: false },
  erhoeht:   { label: 'Erhöht',    farbe: 'text-amber-700',   ring: 'stroke-amber-500',   bg: 'bg-amber-50 border-amber-200',   Icon: AlertTriangle,  pulse: false },
  ueberlast: { label: 'Überlast',  farbe: 'text-red-700',     ring: 'stroke-red-500',     bg: 'bg-red-50 border-red-300',       Icon: Flame,          pulse: true  },
};

const ACTIVE_STATUSES = ['bestätigt', 'in_zubereitung', 'accepted', 'preparing'];

function SvgRing({ pct, color, size = 60 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(1, pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={5} className="stroke-stone-100" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        className={cn('transition-all duration-700', color)}
      />
    </svg>
  );
}

export function KitchenPhase1668KuechenAuslastungsWarnBadge({
  orders,
  schwelleErhoeht = 6,
  schwelleUeberlast = 10,
}: {
  orders: Order[];
  schwelleErhoeht?: number;
  schwelleUeberlast?: number;
}) {
  const { aktiv, stufe, ringPct } = useMemo(() => {
    const aktiv = orders.filter(o => ACTIVE_STATUSES.includes(o.status)).length;
    const stufe: AuslastungsStufe =
      aktiv >= schwelleUeberlast ? 'ueberlast' :
      aktiv >= schwelleErhoeht   ? 'erhoeht' : 'normal';
    const ringPct = Math.min(100, (aktiv / schwelleUeberlast) * 100);
    return { aktiv, stufe, ringPct };
  }, [orders, schwelleErhoeht, schwelleUeberlast]);

  if (orders.length === 0) return null;

  const cfg = STUFEN_CFG[stufe];
  const Icon = cfg.Icon;

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden shadow-sm transition-all',
      cfg.bg,
      cfg.pulse && 'animate-pulse',
    )}>
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Ring */}
        <div className="relative shrink-0">
          <SvgRing pct={ringPct} color={cfg.ring} size={60} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn('text-base font-black tabular-nums leading-none', cfg.farbe)}>{aktiv}</span>
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Icon className={cn('h-4 w-4 shrink-0', cfg.farbe)} />
            <span className={cn('text-sm font-black uppercase tracking-wide', cfg.farbe)}>
              Küchen-Auslastung: {cfg.label}
            </span>
          </div>
          <div className="text-xs text-stone-600">
            {aktiv} aktive Bestellung{aktiv !== 1 ? 'en' : ''} · Schwelle Erhöht&nbsp;≥{schwelleErhoeht} / Überlast&nbsp;≥{schwelleUeberlast}
          </div>
          {stufe === 'ueberlast' && (
            <div className="mt-1 text-[11px] font-bold text-red-700">
              ⚠ Kapazitätsgrenze erreicht — Neue Bestellungen verzögern sich!
            </div>
          )}
          {stufe === 'erhoeht' && (
            <div className="mt-1 text-[11px] font-bold text-amber-700">
              Hohe Last — Bestellreihenfolge priorisieren
            </div>
          )}
        </div>

        {/* Pct badge */}
        <div className={cn('shrink-0 text-right')}>
          <div className={cn('text-xl font-black tabular-nums', cfg.farbe)}>
            {Math.round(ringPct)}%
          </div>
          <div className="text-[9px] text-stone-400 uppercase tracking-wide">Kapazität</div>
        </div>
      </div>
    </div>
  );
}
