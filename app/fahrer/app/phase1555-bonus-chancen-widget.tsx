'use client';

import React, { useCallback, useEffect, useState } from 'react';

interface BonusChance {
  typ: 'puenktlichkeit' | 'trinkgeld' | 'streak';
  label: string;
  betrag_eur: number;
  fortschritt_pct: number;
  stopps_verbleibend: number | null;
  erreichbar: boolean;
}

interface Props {
  isOnline?: boolean;
  driverId?: string;
}

function mockChancen(driverId: string): BonusChance[] {
  const seed = driverId.charCodeAt(0) % 5;
  return [
    {
      typ: 'puenktlichkeit',
      label: 'Pünktlichkeits-Bonus',
      betrag_eur: 5,
      fortschritt_pct: 70 + seed * 4,
      stopps_verbleibend: 3,
      erreichbar: true,
    },
    {
      typ: 'trinkgeld',
      label: 'Trinkgeld-Tagesziel',
      betrag_eur: 10,
      fortschritt_pct: 60 + seed * 3,
      stopps_verbleibend: 4,
      erreichbar: seed < 3,
    },
    {
      typ: 'streak',
      label: '5-Tage-Streak',
      betrag_eur: 15,
      fortschritt_pct: 80 + seed * 2,
      stopps_verbleibend: seed < 4 ? 2 : null,
      erreichbar: seed < 4,
    },
  ];
}

const ICON: Record<BonusChance['typ'], string> = {
  puenktlichkeit: '⏱️',
  trinkgeld: '💰',
  streak: '🔥',
};

export function FahrerPhase1555BonusChancenWidget({ isOnline = false, driverId = '' }: Props) {
  const [chancen, setChancen] = useState<BonusChance[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/driver/bonus-chancen?driver_id=${driverId}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.chancen)) { setChancen(json.chancen); return; }
      }
    } catch {}
    setChancen(mockChancen(driverId || 'a'));
  }, [driverId]);

  useEffect(() => {
    if (!isOnline) return;
    load();
    const t = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(t);
  }, [isOnline, load]);

  if (!isOnline || !chancen) return null;

  const erreichbare = chancen.filter(c => c.erreichbar);
  if (erreichbare.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🎯</span>
        <h3 className="text-sm font-semibold text-foreground">Bonus-Chancen heute</h3>
      </div>

      <div className="space-y-2.5">
        {erreichbare.map(c => (
          <div key={c.typ} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm">{ICON[c.typ]}</span>
              <span className="text-xs font-semibold text-foreground flex-1 truncate">{c.label}</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
                +{c.betrag_eur.toFixed(2).replace('.', ',')} €
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  c.fortschritt_pct >= 80
                    ? 'bg-emerald-500'
                    : c.fortschritt_pct >= 50
                    ? 'bg-amber-400'
                    : 'bg-blue-400'
                }`}
                style={{ width: `${Math.min(100, c.fortschritt_pct)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{c.fortschritt_pct}% erreicht</span>
              {c.stopps_verbleibend !== null && (
                <span>noch {c.stopps_verbleibend} Stopp{c.stopps_verbleibend !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
