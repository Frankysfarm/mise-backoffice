'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Battery, BatteryLow, ChevronDown, ChevronUp, Loader2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1152 — Schicht-Energie-Cockpit (Fahrer-App)
// Energie-Score basierend auf Schichtdauer + Pausen + Stopps, mit personalisierten Tipps.

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface SchichtBilanz {
  schicht_dauer_min?: number;
  stopps_heute?: number;
  pausen_min?: number;
  touren_heute?: number;
}

interface EnergieDaten {
  score: number;
  level: 'hoch' | 'mittel' | 'niedrig' | 'kritisch';
  schicht_dauer_min: number;
  stopps: number;
  pausen_min: number;
  empfehlung: string;
  tipp: string;
}

function berechneEnergie(bilanz: SchichtBilanz): EnergieDaten {
  const schichtMin = bilanz.schicht_dauer_min ?? 0;
  const stopps = bilanz.stopps_heute ?? 0;
  const pausenMin = bilanz.pausen_min ?? 0;

  const schichtFaktor = Math.min(60, (schichtMin / 480) * 60);
  const stoppFaktor = Math.min(30, stopps * 2.5);
  const pausenBonus = Math.min(10, (pausenMin / 60) * 10);
  const score = Math.max(0, Math.round(100 - schichtFaktor - stoppFaktor + pausenBonus));

  let level: EnergieDaten['level'];
  let empfehlung: string;
  let tipp: string;

  if (score >= 70) {
    level = 'hoch';
    empfehlung = 'Voll einsatzbereit';
    tipp = 'Weiter so! Du bist auf Kurs für eine starke Schicht.';
  } else if (score >= 45) {
    level = 'mittel';
    empfehlung = 'Leichte Ermüdung';
    tipp = 'Wenn möglich, plane eine kurze Pause zwischen den Touren ein.';
  } else if (score >= 25) {
    level = 'niedrig';
    empfehlung = 'Pause empfohlen';
    tipp = 'Gönn dir eine 10-Min-Pause — das verbessert deine Reaktionszeit deutlich.';
  } else {
    level = 'kritisch';
    empfehlung = 'Dringende Pause!';
    tipp = 'Bitte informiere Dispatch über deinen Zustand. Sicherheit geht vor.';
  }

  return { score, level, schicht_dauer_min: schichtMin, stopps, pausen_min: pausenMin, empfehlung, tipp };
}

function mockBilanz(): SchichtBilanz {
  return { schicht_dauer_min: 210, stopps_heute: 8, pausen_min: 15, touren_heute: 3 };
}

const LEVEL_STYLE = {
  hoch:     { bar: 'bg-emerald-500', icon: Battery,    iconColor: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-200', label: 'Hoch' },
  mittel:   { bar: 'bg-amber-400',   icon: Battery,    iconColor: 'text-amber-500',   bg: 'bg-amber-50 border-amber-200',     label: 'Mittel' },
  niedrig:  { bar: 'bg-orange-400',  icon: BatteryLow, iconColor: 'text-orange-500',  bg: 'bg-orange-50 border-orange-200',   label: 'Niedrig' },
  kritisch: { bar: 'bg-red-500',     icon: BatteryLow, iconColor: 'text-red-500',     bg: 'bg-red-50 border-red-300',         label: 'Kritisch' },
};

export function FahrerPhase1152SchichtEnergieCockpit({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(false);
  const [bilanz, setBilanz] = useState<SchichtBilanz | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/schicht-bilanz?driver_id=${driverId}`);
      if (res.ok) {
        const data: SchichtBilanz = await res.json();
        setBilanz(data);
      } else {
        setBilanz(mockBilanz());
      }
    } catch {
      setBilanz(mockBilanz());
    } finally {
      setLoading(false);
    }
  }, [driverId, isOnline]);

  useEffect(() => {
    if (!isOnline) return;
    load();
    const interval = setInterval(load, 5 * 60_000);
    return () => clearInterval(interval);
  }, [load, isOnline]);

  const energie = useMemo<EnergieDaten | null>(() => {
    if (!bilanz) return null;
    return berechneEnergie(bilanz);
  }, [bilanz]);

  if (!isOnline || !energie) return null;

  const style = LEVEL_STYLE[energie.level];
  const BattIcon = style.icon;

  return (
    <div className={cn('rounded-xl border overflow-hidden', style.bg)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:opacity-80 transition"
      >
        <div className="flex items-center gap-2">
          <BattIcon className={cn('h-4 w-4 shrink-0', style.iconColor)} />
          <span className="text-sm font-bold uppercase tracking-wider">Energie-Cockpit</span>
          <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full',
            energie.level === 'kritisch' ? 'bg-red-500 text-white animate-pulse' :
            energie.level === 'niedrig' ? 'bg-orange-400 text-white' :
            energie.level === 'mittel' ? 'bg-amber-400 text-white' :
            'bg-emerald-500 text-white'
          )}>
            {energie.score}% · {style.label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t px-4 py-4 space-y-4">
          {/* Score-Balken */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span>Energie-Level</span>
              <span>{energie.score}%</span>
            </div>
            <div className="h-3 rounded-full bg-black/10 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', style.bar)}
                style={{ width: `${energie.score}%` }}
              />
            </div>
            <div className="text-[11px] font-bold">{energie.empfehlung}</div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Schichtdauer', value: `${Math.round(energie.schicht_dauer_min / 60 * 10) / 10}h` },
              { label: 'Stopps heute', value: String(energie.stopps) },
              { label: 'Pausen', value: `${energie.pausen_min}m` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-white/60 border border-white/80 px-3 py-2 text-center">
                <div className="text-[10px] text-muted-foreground">{label}</div>
                <div className="text-base font-black tabular-nums">{value}</div>
              </div>
            ))}
          </div>

          {/* Tipp */}
          <div className="flex items-start gap-2 rounded-lg bg-white/60 border border-white/80 px-3 py-2.5">
            <Zap className={cn('h-4 w-4 shrink-0 mt-0.5', style.iconColor)} />
            <p className="text-xs text-foreground/80">{energie.tipp}</p>
          </div>
        </div>
      )}
    </div>
  );
}
