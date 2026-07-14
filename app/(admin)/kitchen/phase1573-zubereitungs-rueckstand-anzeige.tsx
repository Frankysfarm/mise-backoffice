'use client';

import React, { useMemo, useState } from 'react';

interface OrderInput {
  id: string;
  status: string;
  created_at?: string;
  accepted_at?: string | null;
  prep_time_minutes?: number | null;
}

interface Props {
  orders: OrderInput[];
  ziel_prepzeit_min?: number;
}

type Ampel = 'gruen' | 'gelb' | 'rot';

const ACTIVE_STATUSES = ['in_zubereitung', 'preparing', 'in_kitchen', 'angenommen', 'accepted'];

const AMPEL_CONFIG: Record<Ampel, { bg: string; border: string; text: string; dot: string; label: string }> = {
  gruen: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-400', label: 'Alles im Plan' },
  gelb: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400', label: 'Leichter Rückstand' },
  rot: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', dot: 'bg-rose-400', label: 'Kritischer Rückstand' },
};

export function KitchenPhase1573ZubereitungsRueckstandAnzeige({ orders, ziel_prepzeit_min = 15 }: Props) {
  const [open, setOpen] = useState(true);

  const { ampel, rueckstand, aeltesterMin, countdown } = useMemo(() => {
    const now = Date.now();
    const aktive = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));

    const verzoegert = aktive.filter((o) => {
      const start = o.accepted_at ?? o.created_at;
      if (!start) return false;
      const minInZubereitung = (now - new Date(start).getTime()) / 60_000;
      const ziel = o.prep_time_minutes ?? ziel_prepzeit_min;
      return minInZubereitung > ziel;
    });

    if (verzoegert.length === 0) return { ampel: 'gruen' as Ampel, rueckstand: 0, aeltesterMin: 0, countdown: null };

    const oldest = verzoegert.reduce((prev, cur) => {
      const ps = prev.accepted_at ?? prev.created_at ?? '';
      const cs = cur.accepted_at ?? cur.created_at ?? '';
      return new Date(ps) < new Date(cs) ? prev : cur;
    });

    const aeltesterStart = oldest.accepted_at ?? oldest.created_at ?? '';
    const aeltesterMin = Math.floor((now - new Date(aeltesterStart).getTime()) / 60_000);
    const ueberfaelligMin = aeltesterMin - (oldest.prep_time_minutes ?? ziel_prepzeit_min);

    const ampel: Ampel = verzoegert.length >= 5 || ueberfaelligMin > 15 ? 'rot' : verzoegert.length >= 2 || ueberfaelligMin > 5 ? 'gelb' : 'gruen';

    return { ampel, rueckstand: verzoegert.length, aeltesterMin, countdown: ueberfaelligMin };
  }, [orders, ziel_prepzeit_min]);

  if (!open) return null;

  const cfg = AMPEL_CONFIG[ampel];

  return (
    <div className={`rounded-xl border p-3 mb-3 flex items-start gap-3 ${cfg.bg} ${cfg.border}`}>
      <div className="flex-shrink-0 mt-0.5 flex flex-col items-center gap-1">
        <span className={`h-3 w-3 rounded-full ${cfg.dot} animate-pulse`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${cfg.text}`}>
          Zubereitungs-Rückstand
        </div>
        <div className={`text-sm font-bold ${cfg.text}`}>
          {ampel === 'gruen'
            ? 'Alle Bestellungen im Zeitplan'
            : `${rueckstand} Bestellung${rueckstand !== 1 ? 'en' : ''} überfällig`}
        </div>
        {ampel !== 'gruen' && (
          <div className={`text-xs mt-0.5 ${cfg.text} opacity-80`}>
            Ältester Rückstand: {countdown != null && countdown > 0 ? `+${countdown} Min über Ziel` : `${aeltesterMin} Min in Zubereitung`}
          </div>
        )}
        <div className={`text-xs mt-1 font-medium ${cfg.text}`}>{cfg.label}</div>
      </div>
      <button
        onClick={() => setOpen(false)}
        className={`text-lg leading-none opacity-40 hover:opacity-70 ${cfg.text} flex-shrink-0`}
        aria-label="Schließen"
      >
        ×
      </button>
    </div>
  );
}
