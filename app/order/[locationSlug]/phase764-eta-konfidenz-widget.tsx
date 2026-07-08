'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface KonfidenzDaten {
  konfidenz_pct: number;
  varianz_min: number;
  eta_min: number;
  stufe: 'hoch' | 'mittel' | 'niedrig';
}

const MOCK: KonfidenzDaten = {
  konfidenz_pct: 85,
  varianz_min: 3,
  eta_min: 28,
  stufe: 'hoch',
};

const STUFE_META = {
  hoch: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', ring: 'stroke-emerald-500', label: 'Hohe Genauigkeit' },
  mittel: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', ring: 'stroke-amber-500', label: 'Mittlere Genauigkeit' },
  niedrig: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', ring: 'stroke-red-500', label: 'Geringe Genauigkeit' },
};

export function Phase764EtaKonfidenzWidget({ locationId }: Props) {
  const [data, setData] = useState<KonfidenzDaten | null>(null);
  const [loading, setLoading] = useState(true);

  const laden = useCallback(async () => {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/admin/eta-konfidenz?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (json.konfidenz) { setData(json.konfidenz); return; }
      }
    } catch { /* fallback */ }
    setData(MOCK);
  }, [locationId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 2 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  if (loading || !data) return null;

  const meta = STUFE_META[data.stufe];
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (data.konfidenz_pct / 100) * circ;

  return (
    <div className={`rounded-xl border ${meta.bg} p-3 shadow-sm`}>
      <div className="flex items-center gap-3">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
          <svg className="absolute inset-0 rotate-[-90deg]" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
            <circle
              cx="25" cy="25" r={r} fill="none" strokeWidth="4"
              className={`${meta.ring} transition-all duration-700`}
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
            />
          </svg>
          <ShieldCheck className={`h-5 w-5 ${meta.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-base font-black tabular-nums ${meta.color}`}>{data.konfidenz_pct}%</p>
          <p className="text-[10px] font-semibold text-foreground">{meta.label}</p>
          <p className="text-[9px] text-muted-foreground">
            ETA ~{data.eta_min} Min · ±{data.varianz_min} Min Varianz
          </p>
        </div>
      </div>
    </div>
  );
}
