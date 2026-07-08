'use client';

import { useEffect, useState } from 'react';
import { Shield, Star, Clock } from 'lucide-react';

interface Props {
  locationId: string;
}

interface VersprechenDaten {
  puenktlichkeit_pct: number;
  ø_bewertung: number;
  touren_gesamt: number;
  siegel_stufe: 'gold' | 'silber' | 'bronze';
}

const MOCK: VersprechenDaten = {
  puenktlichkeit_pct: 97,
  ø_bewertung: 4.8,
  touren_gesamt: 142,
  siegel_stufe: 'gold',
};

const SIEGEL_FARBEN = {
  gold: {
    badge: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
    icon: 'text-amber-500 dark:text-amber-400',
    text: 'text-amber-700 dark:text-amber-300',
    label: 'Gold-Siegel',
  },
  silber: {
    badge: 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700',
    icon: 'text-slate-500 dark:text-slate-400',
    text: 'text-slate-700 dark:text-slate-300',
    label: 'Silber-Siegel',
  },
  bronze: {
    badge: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800',
    icon: 'text-orange-600 dark:text-orange-400',
    text: 'text-orange-700 dark:text-orange-300',
    label: 'Bronz-Siegel',
  },
};

export function Phase804LieferVersprechenSiegel({ locationId }: Props) {
  const [data, setData] = useState<VersprechenDaten>(MOCK);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch(
        `/api/delivery/admin/liefer-versprechen?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('fetch');
      const json = await res.json();
      if (json.ok) setData(json as VersprechenDaten);
    } catch {
      // keep mock
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5 * 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="h-10 animate-pulse bg-muted rounded" />
      </div>
    );
  }

  const { puenktlichkeit_pct, ø_bewertung, touren_gesamt, siegel_stufe } = data;
  const farben = SIEGEL_FARBEN[siegel_stufe];

  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${farben.badge}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Shield className={`h-5 w-5 shrink-0 ${farben.icon}`} />
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-bold ${farben.text}`}>Liefer-Versprechen</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold border ${farben.badge} ${farben.text}`}
              >
                {farben.label}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Basiert auf {touren_gesamt > 0 ? touren_gesamt : '—'} Lieferungen (7 Tage)
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-lg bg-white/60 dark:bg-black/20 px-2.5 py-2">
          <Clock className={`h-3.5 w-3.5 shrink-0 ${farben.icon}`} />
          <div>
            <p className={`text-sm font-bold tabular-nums ${farben.text}`}>
              {puenktlichkeit_pct}%
            </p>
            <p className="text-[9px] text-muted-foreground">pünktlich</p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-white/60 dark:bg-black/20 px-2.5 py-2">
          <Star className={`h-3.5 w-3.5 shrink-0 ${farben.icon}`} />
          <div>
            <p className={`text-sm font-bold tabular-nums ${farben.text}`}>
              {ø_bewertung.toFixed(1)}/5
            </p>
            <p className="text-[9px] text-muted-foreground">Ø Bewertung</p>
          </div>
        </div>
      </div>

      <p className="mt-2 text-[9px] text-muted-foreground">
        {puenktlichkeit_pct >= 95
          ? `Top-Qualität: ${puenktlichkeit_pct}% aller Bestellungen pünktlich diese Woche`
          : `${puenktlichkeit_pct}% der Lieferungen pünktlich (Ziel: 95%)`}
      </p>
    </div>
  );
}
