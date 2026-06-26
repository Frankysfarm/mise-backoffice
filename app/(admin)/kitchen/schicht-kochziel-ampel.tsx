'use client';

import { useEffect, useState } from 'react';
import { Target, Loader2, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface KochzielData {
  ziel: number;
  aktuelleBestellungen: number;
  stundenVerbleibend: number;
  prognosenBestellungen: number;
  erreichbarkeit_pct: number;
  status: 'uebertroffen' | 'auf-kurs' | 'hinter-plan' | 'kritisch';
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const STATUS_CONFIG: Record<
  KochzielData['status'],
  { label: string; barColor: string; badgeBg: string; badgeText: string }
> = {
  uebertroffen: { label: 'Übertroffen', barColor: 'bg-matcha-600', badgeBg: 'bg-matcha-100', badgeText: 'text-matcha-700' },
  'auf-kurs':   { label: 'Auf Kurs',    barColor: 'bg-matcha-500', badgeBg: 'bg-matcha-100', badgeText: 'text-matcha-700' },
  'hinter-plan':{ label: 'Hinter Plan', barColor: 'bg-amber-500',  badgeBg: 'bg-amber-100',  badgeText: 'text-amber-700' },
  kritisch:     { label: 'Kritisch',    barColor: 'bg-red-500',    badgeBg: 'bg-red-100',    badgeText: 'text-red-700' },
};

export function KitchenSchichtKochzielAmpel({ locationId }: Props) {
  const [data, setData] = useState<KochzielData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/kitchen-kochziel-ampel?location_id=${encodeURIComponent(locationId)}&ziel=80`)
      .then((r) => r.json())
      .then((d) => setData(d.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const cfg = data ? STATUS_CONFIG[data.status] : null;
  const barWidth = data
    ? Math.min(100, Math.round((data.aktuelleBestellungen / data.ziel) * 100))
    : 0;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-stone-100">
        <Target className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Schicht-Kochziel-Ampel</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {cfg && !loading && (
          <span className={cn('ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-bold', cfg.badgeBg, cfg.badgeText)}>
            {cfg.label}
          </span>
        )}
      </div>

      {loading && !data ? (
        <div className="px-5 py-6 space-y-3 animate-pulse">
          <div className="h-3 bg-stone-100 rounded-full w-3/4" />
          <div className="h-4 bg-stone-100 rounded-full w-full" />
          <div className="h-3 bg-stone-100 rounded-full w-1/2" />
        </div>
      ) : data ? (
        <div className="px-5 py-4 space-y-4">
          {/* Ziel vs Aktuell */}
          <div className="flex items-end justify-between text-xs">
            <span className="text-muted-foreground">Aktuell</span>
            <span className="text-muted-foreground">
              Ziel: <span className="font-bold text-foreground">{data.ziel}</span>
            </span>
          </div>

          {/* Fortschrittsbalken */}
          <div className="relative h-6 rounded-full bg-stone-100 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', cfg?.barColor ?? 'bg-stone-300')}
              style={{ width: `${barWidth}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white mix-blend-overlay">
              {data.aktuelleBestellungen} / {data.ziel}
            </span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div className="rounded-xl bg-stone-50 px-2 py-2">
              <div className="text-[10px] text-muted-foreground mb-0.5">Aktuell</div>
              <div className="font-bold text-base">{data.aktuelleBestellungen}</div>
            </div>
            <div className="rounded-xl bg-stone-50 px-2 py-2">
              <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-0.5">
                <TrendingUp className="h-3 w-3" /> Prognose
              </div>
              <div className="font-bold text-base">{data.prognosenBestellungen}</div>
            </div>
            <div className="rounded-xl bg-stone-50 px-2 py-2">
              <div className="text-[10px] text-muted-foreground mb-0.5">Verbleibend</div>
              <div className="font-bold text-base">{data.stundenVerbleibend}h</div>
            </div>
          </div>

          {/* Erreichbarkeit */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Zielerreichbarkeit</span>
            <span className={cn('font-bold', cfg?.badgeText ?? 'text-foreground')}>
              {data.erreichbarkeit_pct}%
            </span>
          </div>
        </div>
      ) : (
        <div className="px-5 py-4 text-xs text-muted-foreground">Keine Daten verfügbar</div>
      )}
    </div>
  );
}
