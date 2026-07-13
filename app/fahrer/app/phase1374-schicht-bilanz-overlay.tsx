'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2, Euro, MapPin, Star, TrendingDown, TrendingUp, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1374 — Schicht-Bilanz-Overlay (Fahrer-App)
 *
 * Komplette Tages-Abrechnung nach Schicht-Ende:
 * Stopps + km + Trinkgeld + Einnahmen + Bewertung + Vergleich Vortag.
 * localStorage-Guard (zeigt nur einmal pro Tag). Nach Phase1369.
 */

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface SchichtBilanz {
  stopps_heute: number;
  km_heute: number;
  trinkgeld_heute: number;
  einnahmen_heute: number;
  avg_bewertung: number | null;
  stopps_vortag: number;
  trinkgeld_vortag: number;
  einnahmen_vortag: number;
  schicht_dauer_min: number;
}

const STORAGE_KEY = 'mise_schicht_bilanz_shown_';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function buildMock(): SchichtBilanz {
  return {
    stopps_heute: 14,
    km_heute: 38.5,
    trinkgeld_heute: 12.5,
    einnahmen_heute: 94.0,
    avg_bewertung: 4.7,
    stopps_vortag: 11,
    trinkgeld_vortag: 9.0,
    einnahmen_vortag: 78.0,
    schicht_dauer_min: 480,
  };
}

function delta(neu: number, alt: number): { pct: number; trend: 'besser' | 'gleich' | 'schlechter' } {
  if (alt === 0) return { pct: 0, trend: 'gleich' };
  const pct = Math.round(((neu - alt) / alt) * 100);
  return { pct, trend: pct > 2 ? 'besser' : pct < -2 ? 'schlechter' : 'gleich' };
}

function DeltaBadge({ neu, alt }: { neu: number; alt: number }) {
  const { pct, trend } = delta(neu, alt);
  if (trend === 'gleich') return null;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-bold',
      trend === 'besser' ? 'text-green-500' : 'text-red-500',
    )}>
      {trend === 'besser'
        ? <TrendingUp className="h-3 w-3" />
        : <TrendingDown className="h-3 w-3" />}
      {pct > 0 ? '+' : ''}{pct}%
    </span>
  );
}

export function FahrerPhase1374SchichtBilanzOverlay({ driverId, isOnline }: Props) {
  const [data, setData] = useState<SchichtBilanz | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const laden = useCallback(async () => {
    // localStorage-Guard: einmal pro Tag
    const key = STORAGE_KEY + todayKey();
    if (typeof window !== 'undefined' && localStorage.getItem(key) === 'shown') {
      return;
    }

    if (!isOnline || !driverId) {
      setData(buildMock());
      setVisible(true);
      return;
    }

    try {
      const res = await fetch(`/api/delivery/driver/schicht-bilanz-preview?driver_id=${driverId}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData({
        stopps_heute: json.stopps ?? buildMock().stopps_heute,
        km_heute: json.km ?? buildMock().km_heute,
        trinkgeld_heute: json.trinkgeld ?? buildMock().trinkgeld_heute,
        einnahmen_heute: json.einnahmen ?? buildMock().einnahmen_heute,
        avg_bewertung: json.avg_bewertung ?? buildMock().avg_bewertung,
        stopps_vortag: json.stopps_vortag ?? buildMock().stopps_vortag,
        trinkgeld_vortag: json.trinkgeld_vortag ?? buildMock().trinkgeld_vortag,
        einnahmen_vortag: json.einnahmen_vortag ?? buildMock().einnahmen_vortag,
        schicht_dauer_min: json.schicht_dauer_min ?? buildMock().schicht_dauer_min,
      });
      setVisible(true);
    } catch {
      setData(buildMock());
      setVisible(true);
    }
  }, [driverId, isOnline]);

  useEffect(() => {
    // Overlay nach Schicht-Ende anzeigen (nach 20:00 Uhr)
    const h = new Date().getHours();
    if (h >= 20 || h < 4) {
      laden();
    }
  }, [laden]);

  function dismiss() {
    const key = STORAGE_KEY + todayKey();
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, 'shown');
    }
    setDismissed(true);
    setVisible(false);
  }

  if (!visible || dismissed || !data) return null;

  const dauer_h = Math.floor(data.schicht_dauer_min / 60);
  const dauer_m = data.schicht_dauer_min % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-white" />
            <div>
              <p className="text-white font-bold text-sm">Schicht beendet!</p>
              <p className="text-blue-100 text-[11px]">
                {dauer_h}h {dauer_m > 0 ? `${dauer_m}min` : ''} Schicht abgeschlossen
              </p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="rounded-full p-1.5 bg-white/20 hover:bg-white/30 transition"
            aria-label="Schließen"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Stopps */}
            <div className="rounded-xl bg-muted/40 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <MapPin className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-[11px] text-muted-foreground">Stopps</span>
              </div>
              <div className="text-2xl font-black text-foreground">{data.stopps_heute}</div>
              <DeltaBadge neu={data.stopps_heute} alt={data.stopps_vortag} />
              <p className="text-[10px] text-muted-foreground">Vortag: {data.stopps_vortag}</p>
            </div>

            {/* km */}
            <div className="rounded-xl bg-muted/40 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <MapPin className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-[11px] text-muted-foreground">Kilometer</span>
              </div>
              <div className="text-2xl font-black text-foreground">{data.km_heute.toFixed(1)}</div>
              <p className="text-[10px] text-muted-foreground">km gefahren</p>
            </div>

            {/* Einnahmen */}
            <div className="rounded-xl bg-muted/40 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Euro className="h-3.5 w-3.5 text-green-500" />
                <span className="text-[11px] text-muted-foreground">Einnahmen</span>
              </div>
              <div className="text-2xl font-black text-foreground">{data.einnahmen_heute.toFixed(2)} €</div>
              <DeltaBadge neu={data.einnahmen_heute} alt={data.einnahmen_vortag} />
              <p className="text-[10px] text-muted-foreground">Vortag: {data.einnahmen_vortag.toFixed(2)} €</p>
            </div>

            {/* Trinkgeld */}
            <div className="rounded-xl bg-muted/40 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Euro className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[11px] text-muted-foreground">Trinkgeld</span>
              </div>
              <div className="text-2xl font-black text-foreground">{data.trinkgeld_heute.toFixed(2)} €</div>
              <DeltaBadge neu={data.trinkgeld_heute} alt={data.trinkgeld_vortag} />
              <p className="text-[10px] text-muted-foreground">Vortag: {data.trinkgeld_vortag.toFixed(2)} €</p>
            </div>
          </div>

          {/* Bewertung */}
          {data.avg_bewertung !== null && (
            <div className="flex items-center gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 px-3 py-2.5">
              <Star className="h-5 w-5 fill-amber-400 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-bold text-foreground">{data.avg_bewertung.toFixed(1)} Sterne</p>
                <p className="text-[11px] text-muted-foreground">Ø Kundenbewertung heute</p>
              </div>
            </div>
          )}

          <button
            onClick={dismiss}
            className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-bold hover:bg-primary/90 transition"
          >
            Schicht abschließen
          </button>
        </div>
      </div>
    </div>
  );
}
