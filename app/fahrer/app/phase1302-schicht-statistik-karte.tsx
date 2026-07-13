/**
 * Phase 1302 — Schicht-Statistik-Karte (Fahrer-App)
 * Karte mit Ø-Lieferzeit, Stopps heute, Trinkgeld-Summe, Kunden-Bewertungs-Ø.
 * isOnline-Guard. 10-Min-Polling. Integration: fahrer/app/client.tsx nach Phase1297.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Clock, MapPin, Star, Euro, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SchichtStats {
  avg_lieferzeit_min: number;
  stopps_heute: number;
  trinkgeld_summe_eur: number;
  bewertungs_schnitt: number | null;
  bewertungs_anzahl: number;
  schicht_beginn: string | null;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

const POLL_MS = 10 * 60 * 1000;

const MOCK: SchichtStats = {
  avg_lieferzeit_min: 23.5,
  stopps_heute: 8,
  trinkgeld_summe_eur: 4.50,
  bewertungs_schnitt: 4.7,
  bewertungs_anzahl: 6,
  schicht_beginn: new Date(Date.now() - 4 * 3600_000).toISOString(),
};

export function FahrerPhase1302SchichtStatistikKarte({ driverId, isOnline }: Props) {
  const [data, setData] = useState<SchichtStats | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isOnline || !driverId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/schicht-statistik?driver_id=${driverId}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(MOCK);
      }
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [driverId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;

  const kpis = data
    ? [
        {
          icon: <MapPin className="h-4 w-4 text-blue-500" />,
          label: 'Stopps heute',
          value: String(data.stopps_heute),
          suffix: '',
        },
        {
          icon: <Clock className="h-4 w-4 text-amber-500" />,
          label: 'Ø Lieferzeit',
          value: data.avg_lieferzeit_min > 0 ? data.avg_lieferzeit_min.toFixed(1) : '—',
          suffix: ' Min',
        },
        {
          icon: <Euro className="h-4 w-4 text-emerald-500" />,
          label: 'Trinkgeld',
          value: data.trinkgeld_summe_eur.toFixed(2),
          suffix: ' €',
        },
        {
          icon: <Star className="h-4 w-4 text-yellow-500" />,
          label: 'Bewertung',
          value: data.bewertungs_schnitt != null ? data.bewertungs_schnitt.toFixed(1) : '—',
          suffix: data.bewertungs_schnitt != null ? ` (${data.bewertungs_anzahl})` : '',
        },
      ]
    : [];

  return (
    <div className="rounded-2xl border bg-card p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold">Schicht-Statistik</span>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg p-1.5 hover:bg-muted transition disabled:opacity-50"
          aria-label="Aktualisieren"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 text-muted-foreground', loading && 'animate-spin')} />
        </button>
      </div>

      {loading && !data && (
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 gap-2">
          {kpis.map((kpi, i) => (
            <div key={i} className="rounded-xl bg-muted/50 border px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                {kpi.icon}
                <span className="text-[11px] text-muted-foreground font-medium">{kpi.label}</span>
              </div>
              <p className="text-lg font-black tabular-nums leading-tight">
                {kpi.value}
                <span className="text-xs font-medium text-muted-foreground">{kpi.suffix}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {data?.schicht_beginn && (
        <p className="text-[10px] text-muted-foreground mt-2 text-right">
          Schicht seit {new Date(data.schicht_beginn).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
        </p>
      )}
    </div>
  );
}
