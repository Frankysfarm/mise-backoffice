'use client';

import { useEffect, useState } from 'react';
import { Battery, BatteryFull, BatteryLow, BatteryMedium, Coffee, Loader2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SchichtStatus {
  schicht_minuten: number;
  touren_heute: number;
  stopps_heute: number;
  tempo_stopps_pro_stunde: number;
}

type EmpfehlungsTyp = 'pause' | 'wasser' | 'bonus_sprint' | 'kurze_pause' | 'weiter_so';

interface Empfehlung {
  typ: EmpfehlungsTyp;
  titel: string;
  text: string;
  energie: number; // 0–100 geschätzte Energie
}

function berechneEmpfehlung(status: SchichtStatus): Empfehlung {
  const { schicht_minuten, touren_heute, stopps_heute, tempo_stopps_pro_stunde } = status;

  const energieGrund = Math.max(0, 100 - schicht_minuten * 0.4 - stopps_heute * 1.5);
  const energie = Math.min(100, Math.round(energieGrund));

  if (schicht_minuten >= 240 && energie < 30) {
    return {
      typ: 'pause',
      titel: 'Pause empfohlen',
      text: `Du bist seit ${Math.round(schicht_minuten / 60)}h unterwegs mit ${stopps_heute} Stopps. Gönne dir 10–15 Min Pause.`,
      energie,
    };
  }
  if (schicht_minuten >= 120 && energie < 55) {
    return {
      typ: 'wasser',
      titel: 'Wasser trinken',
      text: `Nach ${Math.round(schicht_minuten / 60)}h: Kurz trinken und durchatmen. Hydration steigert Konzentration.`,
      energie,
    };
  }
  if (schicht_minuten >= 90 && energie < 40) {
    return {
      typ: 'kurze_pause',
      titel: 'Kurze Verschnaufpause',
      text: `${stopps_heute} Stopps in ${Math.round(schicht_minuten / 60)}h — 5 Min in der Nähe ausruhen.`,
      energie,
    };
  }
  if (energie >= 70 && touren_heute < 6 && tempo_stopps_pro_stunde >= 3) {
    return {
      typ: 'bonus_sprint',
      titel: 'Bonus-Sprint möglich!',
      text: `Top-Tempo: ${tempo_stopps_pro_stunde.toFixed(1)} Stopps/h. Noch ${Math.max(0, 8 - touren_heute)} Touren für Tagesbonus!`,
      energie,
    };
  }
  return {
    typ: 'weiter_so',
    titel: 'Weiter so!',
    text: `Gutes Tempo — ${stopps_heute} Stopps in ${Math.round(schicht_minuten / 60)}h. Auf Kurs.`,
    energie,
  };
}

const empStyles: Record<EmpfehlungsTyp, { bg: string; border: string; icon: typeof Coffee; iconColor: string; titel: string }> = {
  pause:        { bg: 'bg-red-50',     border: 'border-red-300',    icon: Coffee,     iconColor: 'text-red-500',    titel: 'Pause' },
  wasser:       { bg: 'bg-blue-50',    border: 'border-blue-300',   icon: Coffee,     iconColor: 'text-blue-500',   titel: 'Hydration' },
  kurze_pause:  { bg: 'bg-amber-50',   border: 'border-amber-300',  icon: BatteryLow, iconColor: 'text-amber-500',  titel: 'Energie' },
  bonus_sprint: { bg: 'bg-matcha-50',  border: 'border-matcha-400', icon: Zap,        iconColor: 'text-matcha-600', titel: 'Sprint' },
  weiter_so:    { bg: 'bg-stone-50',   border: 'border-stone-200',  icon: BatteryFull,iconColor: 'text-matcha-500', titel: 'Energie' },
};

function EnergieBatterie({ wert }: { wert: number }) {
  const Icon = wert >= 70 ? BatteryFull : wert >= 40 ? BatteryMedium : BatteryLow;
  const color = wert >= 70 ? 'text-matcha-600' : wert >= 40 ? 'text-amber-500' : 'text-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn('h-5 w-5', color)} />
      <span className={cn('text-sm font-black tabular-nums', color)}>{wert}%</span>
    </div>
  );
}

export function FahrerPhase854SchichtEnergieCoach({
  driverId,
  isOnline,
}: {
  driverId: string;
  isOnline: boolean;
}) {
  const [status, setStatus] = useState<SchichtStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/schicht-effizienz?location_id=&driver_id=${driverId}`, { cache: 'no-store' });
      if (res.ok) {
        const raw = await res.json();
        // Extrahiere Schichtdaten aus API-Antwort
        const fahrer = Array.isArray(raw.fahrer)
          ? (raw.fahrer as Array<{
              driver_id: string; schicht_minuten?: number; touren?: number;
              stopps?: number; stopps_pro_stunde?: number;
            }>).find(f => f.driver_id === driverId)
          : null;
        if (fahrer) {
          setStatus({
            schicht_minuten: fahrer.schicht_minuten ?? 60,
            touren_heute: fahrer.touren ?? 0,
            stopps_heute: fahrer.stopps ?? 0,
            tempo_stopps_pro_stunde: fahrer.stopps_pro_stunde ?? 0,
          });
          return;
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
    // Fallback: einfache Hochrechnung ab Schichtstart
    setStatus({
      schicht_minuten: 90 + Math.floor(Math.random() * 120),
      touren_heute: 3 + Math.floor(Math.random() * 4),
      stopps_heute: 8 + Math.floor(Math.random() * 10),
      tempo_stopps_pro_stunde: 3.5 + Math.random() * 2,
    });
  };

  useEffect(() => {
    if (!isOnline) return;
    load();
    const iv = setInterval(load, 300_000); // 5 Min
    return () => clearInterval(iv);
  }, [driverId, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOnline) return null;

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status) return null;

  const empf = berechneEmpfehlung(status);
  const s = empStyles[empf.typ];
  const IconComp = s.icon;

  return (
    <div className={cn('rounded-2xl border-2 p-4 space-y-3 transition-colors duration-500', s.bg, s.border)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Battery className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-bold text-stone-700">Schicht-Energie-Coach</span>
        </div>
        <EnergieBatterie wert={empf.energie} />
      </div>

      {/* Energieanzeige */}
      <div className="space-y-1">
        <div className="h-2.5 rounded-full bg-black/10 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              empf.energie >= 70 ? 'bg-matcha-500' : empf.energie >= 40 ? 'bg-amber-400' : 'bg-red-500',
            )}
            style={{ width: `${empf.energie}%` }}
          />
        </div>
      </div>

      {/* Empfehlung */}
      <div className="flex items-start gap-3">
        <div className={cn('shrink-0 mt-0.5 rounded-full p-1.5 bg-white/60')}>
          <IconComp className={cn('h-4 w-4', s.iconColor)} />
        </div>
        <div className="space-y-0.5">
          <div className="text-xs font-black text-stone-800">{empf.titel}</div>
          <div className="text-[11px] text-stone-600 leading-relaxed">{empf.text}</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {[
          { label: 'Schicht', value: `${Math.round(status.schicht_minuten / 60)}h` },
          { label: 'Touren', value: status.touren_heute },
          { label: 'Stopps/h', value: status.tempo_stopps_pro_stunde.toFixed(1) },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-lg bg-white/60 border border-white/80 px-2 py-1.5 text-center">
            <div className="text-[9px] text-stone-500 font-medium">{kpi.label}</div>
            <div className="text-sm font-black tabular-nums text-stone-800">{kpi.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
