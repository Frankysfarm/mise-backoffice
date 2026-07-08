'use client';

import { useMemo } from 'react';
import { Flag } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  customerName?: string;
  priority?: 'vip' | 'normal' | 'high';
  createdAt?: string;
  wartezeit_min?: number;
}

interface Props {
  orders: Order[];
  schwelleMinuten?: number;
}

interface PrioritaetsEintrag {
  id: string;
  label: string;
  farbe: 'rot' | 'amber' | 'gruen';
  grund: string;
}

function minutenSeit(iso: string | undefined): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

export function KitchenPhase742BestellungsPrioritaetsAmpel({ orders, schwelleMinuten = 25 }: Props) {
  const eintraege = useMemo<PrioritaetsEintrag[]>(() => {
    const aktiv = orders.filter((o) =>
      ['neu', 'new', 'pending', 'in_zubereitung', 'cooking', 'bestätigt', 'confirmed'].includes(o.status)
    );
    return aktiv.map((o): PrioritaetsEintrag => {
      const min = o.wartezeit_min ?? minutenSeit(o.createdAt);
      const isVip = o.priority === 'vip' || o.priority === 'high';
      let farbe: PrioritaetsEintrag['farbe'];
      let grund: string;

      if (isVip && min > 15) { farbe = 'rot'; grund = `VIP · ${min} Min warte`; }
      else if (min > schwelleMinuten) { farbe = 'rot'; grund = `${min} Min — kritisch`; }
      else if (min > schwelleMinuten * 0.7) { farbe = 'amber'; grund = `${min} Min — bald`; }
      else if (isVip) { farbe = 'amber'; grund = `VIP · ${min} Min`; }
      else { farbe = 'gruen'; grund = `${min} Min · ok`; }

      return {
        id: o.id,
        label: o.customerName ? o.customerName.split(' ')[0] : `#${o.id.slice(-4)}`,
        farbe,
        grund,
      };
    }).filter((e) => e.farbe !== 'gruen').slice(0, 8);
  }, [orders, schwelleMinuten]);

  if (eintraege.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Flag className="h-4 w-4 text-red-500" />
        <span className="text-sm font-semibold">Prioritäts-Ampel</span>
        <span className="text-xs bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-full px-2 py-0.5 font-semibold">
          {eintraege.length} dringlich
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {eintraege.map((e) => (
          <div
            key={e.id}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border text-xs font-semibold ${
              e.farbe === 'rot'
                ? 'bg-red-100 dark:bg-red-950/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300'
                : 'bg-amber-100 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
            }`}
          >
            <span className={`h-2 w-2 rounded-full shrink-0 ${e.farbe === 'rot' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>{e.label}</span>
            <span className="font-normal opacity-70 text-[10px]">{e.grund}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
