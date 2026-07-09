'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Target, TrendingUp, CheckCircle2 } from 'lucide-react';

/**
 * Phase 989 — Schicht-Ziel-Fortschritts-Ring (Fahrer-App)
 *
 * SVG-Ring-Visualisierung: Touren/Ziel + Km/Ziel + Einkommen/Ziel heute.
 * Motivations-Nachricht bei Zielerreichung.
 * 5-Min-Polling von /api/delivery/driver/schicht-ziele.
 */

interface SchichtZiele {
  touren_heute: number;
  touren_ziel: number;
  km_heute: number;
  km_ziel: number;
  einkommen_heute_eur: number;
  einkommen_ziel_eur: number;
  alle_ziele_erreicht: boolean;
  generiert_am: string;
}

const MOCK: SchichtZiele = {
  touren_heute: 7,
  touren_ziel: 10,
  km_heute: 42,
  km_ziel: 60,
  einkommen_heute_eur: 54.5,
  einkommen_ziel_eur: 80.0,
  alle_ziele_erreicht: false,
  generiert_am: new Date().toISOString(),
};

interface RingProps {
  pct: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}

function Ring({ pct, color, size = 64, strokeWidth = 6 }: RingProps) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct / 100, 1) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/30" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  );
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

export function FahrerPhase989SchichtZielFortschrittsRing({ driverId, isOnline }: Props) {
  const [data, setData] = useState<SchichtZiele | null>(null);

  useEffect(() => {
    if (!isOnline || !driverId) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/driver/schicht-ziele?driver_id=${driverId}`);
        if (res.ok) {
          const json = await res.json() as SchichtZiele;
          setData(json);
        } else {
          setData(MOCK);
        }
      } catch {
        setData(MOCK);
      }
    };

    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [driverId, isOnline]);

  if (!isOnline || !data) return null;

  const tourPct = Math.round((data.touren_heute / data.touren_ziel) * 100);
  const kmPct = Math.round((data.km_heute / data.km_ziel) * 100);
  const einkommenPct = Math.round((data.einkommen_heute_eur / data.einkommen_ziel_eur) * 100);

  const ringMetrics = [
    { label: 'Touren', value: data.touren_heute, ziel: data.touren_ziel, pct: tourPct, unit: '', color: '#22c55e' },
    { label: 'Kilometer', value: data.km_heute, ziel: data.km_ziel, pct: kmPct, unit: 'km', color: '#3b82f6' },
    { label: 'Einkommen', value: data.einkommen_heute_eur, ziel: data.einkommen_ziel_eur, pct: einkommenPct, unit: '€', color: '#f59e0b' },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-matcha-600" />
        <span className="text-sm font-bold text-foreground">Schicht-Ziel-Fortschritt</span>
        {data.alle_ziele_erreicht && (
          <span className="flex items-center gap-1 rounded-full bg-matcha-100 dark:bg-matcha-900/30 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-300">
            <CheckCircle2 className="h-3 w-3" /> Alle Ziele erreicht!
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {ringMetrics.map(m => (
          <div key={m.label} className="flex flex-col items-center gap-1">
            <div className="relative">
              <Ring pct={m.pct} color={m.color} size={64} strokeWidth={6} />
              <div className="absolute inset-0 flex items-center justify-center rotate-0">
                <span className="text-xs font-black tabular-nums" style={{ color: m.color }}>
                  {m.pct}%
                </span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-[11px] font-bold text-foreground tabular-nums">
                {m.unit === '€' ? `€${Math.round(m.value)}` : `${Math.round(m.value)}${m.unit ? ' ' + m.unit : ''}`}
              </div>
              <div className="text-[9px] text-muted-foreground">
                von {m.unit === '€' ? `€${Math.round(m.ziel)}` : `${m.ziel}${m.unit ? ' ' + m.unit : ''}`}
              </div>
              <div className="text-[9px] font-medium text-muted-foreground">{m.label}</div>
            </div>
          </div>
        ))}
      </div>

      {data.alle_ziele_erreicht && (
        <div className="rounded-lg bg-matcha-50 dark:bg-matcha-950/20 border border-matcha-200 dark:border-matcha-800 px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-matcha-600" />
            <span className="text-xs font-bold text-matcha-700 dark:text-matcha-300">
              Hervorragend! Alle Tagesziele erreicht 🎉
            </span>
          </div>
        </div>
      )}

      {!data.alle_ziele_erreicht && (
        <div className="text-[10px] text-muted-foreground text-center">
          Noch {data.touren_ziel - data.touren_heute} Touren · {Math.max(0, data.km_ziel - data.km_heute)} km · €{Math.max(0, data.einkommen_ziel_eur - data.einkommen_heute_eur).toFixed(0)} bis Tagesziel
        </div>
      )}
    </div>
  );
}
