'use client';

/**
 * KitchenSchichtTempoAmpel — Phase 427
 * Zeigt ob die Küche mit der Nachfrage mithalten kann:
 * Fertigstellungsrate (letzte 30 Min) vs. Eingangsrate (letzte 30 Min).
 */

import { useEffect, useState } from 'react';
import { Gauge, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  status: string;
  bestellt_am: string | null;
  fertig_am: string | null;
}

interface Props {
  orders: Order[];
}

type Tempo = 'schnell' | 'stabil' | 'langsam' | 'kritisch';

function calcTempo(orders: Order[], now: number): {
  tempo: Tempo;
  eingang: number;
  fertig: number;
  ratio: number;
} {
  const window30 = now - 30 * 60_000;

  const eingang = orders.filter((o) => {
    if (!o.bestellt_am) return false;
    const t = new Date(o.bestellt_am).getTime();
    return t >= window30 && t <= now;
  }).length;

  const fertig = orders.filter((o) => {
    if (!o.fertig_am) return false;
    const t = new Date(o.fertig_am).getTime();
    return t >= window30 && t <= now;
  }).length;

  if (eingang === 0) return { tempo: 'stabil', eingang: 0, fertig: fertig, ratio: 1 };

  const ratio = fertig / eingang;

  let tempo: Tempo;
  if (ratio >= 1) tempo = 'schnell';
  else if (ratio >= 0.7) tempo = 'stabil';
  else if (ratio >= 0.5) tempo = 'langsam';
  else tempo = 'kritisch';

  return { tempo, eingang, fertig, ratio };
}

const TEMPO_CFG: Record<Tempo, {
  label: string;
  sub: string;
  container: string;
  badge: string;
  icon: typeof TrendingUp;
}> = {
  schnell: {
    label: 'Im Takt',
    sub: 'Küche hält mit Nachfrage mit',
    container: 'border-matcha-200 bg-matcha-50',
    badge: 'bg-matcha-500 text-white',
    icon: TrendingUp,
  },
  stabil: {
    label: 'Stabil',
    sub: 'Leicht hinter Nachfrage',
    container: 'border-amber-200 bg-amber-50',
    badge: 'bg-amber-400 text-white',
    icon: Minus,
  },
  langsam: {
    label: 'Langsam',
    sub: 'Küche verliert Boden',
    container: 'border-orange-300 bg-orange-50',
    badge: 'bg-orange-500 text-white',
    icon: TrendingDown,
  },
  kritisch: {
    label: 'Kritisch',
    sub: 'Warteschlange wächst — jetzt handeln!',
    container: 'border-red-300 bg-red-50 animate-pulse',
    badge: 'bg-red-600 text-white',
    icon: TrendingDown,
  },
};

export function KitchenSchichtTempoAmpel({ orders }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const { tempo, eingang, fertig, ratio } = calcTempo(orders, now);
  const cfg = TEMPO_CFG[tempo];
  const Icon = cfg.icon;

  if (eingang === 0 && fertig === 0) return null;

  return (
    <div className={cn('rounded-xl border px-4 py-3 flex items-center gap-3', cfg.container)}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70">
        <Gauge className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full', cfg.badge)}>
            {cfg.label}
          </span>
          <span className="text-xs text-muted-foreground">{cfg.sub}</span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
          <span><span className="font-bold text-foreground">{eingang}</span> eingegangen</span>
          <span>·</span>
          <span><span className="font-bold text-foreground">{fertig}</span> fertig</span>
          <span>·</span>
          <span className="font-bold text-foreground">{Math.round(ratio * 100)}%</span>
          <span>Quote (30 Min)</span>
        </div>
      </div>
      <Icon className={cn('h-4 w-4 shrink-0',
        tempo === 'schnell' ? 'text-matcha-600' :
        tempo === 'stabil' ? 'text-amber-500' : 'text-red-500'
      )} />
    </div>
  );
}
