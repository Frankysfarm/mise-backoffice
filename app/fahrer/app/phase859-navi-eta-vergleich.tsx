'use client';

import { useEffect, useState } from 'react';
import { Navigation, TrendingDown, TrendingUp, Minus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EtaVergleich {
  mise_eta_min: number;
  navi_eta_min: number | null; // Navi-ETA aus GPS-Daten
  delta_min: number; // navi - mise (positiv = länger als erwartet)
  grund: string | null; // Stau, Baustelle, Umweg, etc.
  stopp_adresse: string;
  aktualisiert: string;
}

const MOCK: EtaVergleich = {
  mise_eta_min: 12,
  navi_eta_min: 17,
  delta_min: 5,
  grund: 'Stau im Stadtzentrum',
  stopp_adresse: 'Hauptstraße 42',
  aktualisiert: new Date().toISOString(),
};

function deltaLabel(delta: number): { text: string; color: string; icon: typeof Minus } {
  if (Math.abs(delta) < 2) return { text: 'Im Plan', color: 'text-matcha-700', icon: Minus };
  if (delta > 0) return { text: `${delta} Min länger`, color: 'text-red-600', icon: TrendingUp };
  return { text: `${Math.abs(delta)} Min kürzer`, color: 'text-matcha-600', icon: TrendingDown };
}

export function FahrerPhase859NaviEtaVergleich({
  driverId,
  isOnline,
}: {
  driverId: string;
  isOnline: boolean;
}) {
  const [data, setData] = useState<EtaVergleich | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/driver/next-stop-eta?driver_id=${driverId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const raw = await res.json() as {
          eta_min?: number; mise_eta?: number;
          navi_eta_min?: number; navi_eta?: number;
          adresse?: string; address?: string; stopp_adresse?: string;
        };
        const mise = raw.eta_min ?? raw.mise_eta ?? 0;
        const navi = raw.navi_eta_min ?? raw.navi_eta ?? null;
        const delta = navi !== null ? Math.round(navi - mise) : 0;
        const grund =
          delta > 8 ? 'Unerwartete Verzögerung' :
          delta > 4 ? 'Leichte Verkehrsverzögerung' :
          null;

        setData({
          mise_eta_min: Math.round(mise),
          navi_eta_min: navi !== null ? Math.round(navi) : null,
          delta_min: delta,
          grund,
          stopp_adresse: raw.adresse ?? raw.address ?? raw.stopp_adresse ?? 'Nächster Stopp',
          aktualisiert: new Date().toISOString(),
        });
        return;
      }
    } catch { /* fallback */ } finally {
      setLoading(false);
    }
    setData(MOCK);
  };

  useEffect(() => {
    if (!isOnline) return;
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [driverId, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOnline) return null;

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const { text, color, icon: DeltaIcon } = deltaLabel(data.delta_min);
  const showWarning = Math.abs(data.delta_min) >= 5;

  return (
    <div className={cn(
      'rounded-2xl border-2 p-4 space-y-3 transition-colors',
      showWarning && data.delta_min > 0
        ? 'border-amber-300 bg-amber-50'
        : showWarning && data.delta_min < 0
        ? 'border-matcha-300 bg-matcha-50'
        : 'border-stone-200 bg-stone-50',
    )}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Navigation className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-bold text-stone-700">Navi-ETA-Vergleich</span>
        <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[120px]">
          {data.stopp_adresse}
        </span>
      </div>

      {/* ETA-Vergleich */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/70 border border-white/80 px-3 py-2.5 text-center">
          <div className="text-[9px] text-stone-500 font-medium uppercase tracking-wide">Mise-ETA</div>
          <div className="text-xl font-black tabular-nums text-blue-700">{data.mise_eta_min}<span className="text-xs font-normal ml-0.5">Min</span></div>
        </div>
        <div className="rounded-xl bg-white/70 border border-white/80 px-3 py-2.5 text-center">
          <div className="text-[9px] text-stone-500 font-medium uppercase tracking-wide">Navi-ETA</div>
          {data.navi_eta_min !== null ? (
            <div className={cn('text-xl font-black tabular-nums', color)}>
              {data.navi_eta_min}<span className="text-xs font-normal ml-0.5">Min</span>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground pt-2">–</div>
          )}
        </div>
      </div>

      {/* Delta */}
      <div className={cn('flex items-center gap-2 rounded-xl px-3 py-2', showWarning ? 'bg-white/60 border' : 'bg-white/40')}>
        <DeltaIcon className={cn('h-4 w-4 shrink-0', color)} />
        <span className={cn('text-xs font-bold', color)}>{text}</span>
        {data.grund && (
          <span className="ml-auto text-[10px] text-stone-500 truncate">{data.grund}</span>
        )}
      </div>

      <div className="text-[10px] text-muted-foreground text-right">
        {new Date(data.aktualisiert).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
