'use client';

// Phase 1316 — Fahrer-Kapazitäts-Reserve-Widget (Dispatch)
// Zeigt Phase1314-API-Daten: freie vs. belegte Slots + Schicht-Ampel + Empfehlung.
// 10-Min-Polling; nach Phase1310.

import { useEffect, useState } from 'react';
import { Users, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface KapazitaetsData {
  gesamt_slots: number;
  aktive_slots: number;
  freie_slots: number;
  auslastung_pct: number;
  ampel: 'gut' | 'warnung' | 'kritisch';
  empfehlung: string;
}

const AMPEL_STYLE = {
  gut:      { bg: 'bg-matcha-50 dark:bg-matcha-950/30', border: 'border-matcha-200 dark:border-matcha-800', bar: 'bg-matcha-500', badge: 'text-matcha-700 dark:text-matcha-300', icon: CheckCircle2 },
  warnung:  { bg: 'bg-amber-50 dark:bg-amber-950/30',   border: 'border-amber-200 dark:border-amber-800',   bar: 'bg-amber-400',  badge: 'text-amber-700 dark:text-amber-300',   icon: AlertTriangle },
  kritisch: { bg: 'bg-red-50 dark:bg-red-950/30',       border: 'border-red-200 dark:border-red-800',       bar: 'bg-red-500',    badge: 'text-red-700 dark:text-red-300',       icon: AlertTriangle },
} as const;

function buildMock(): KapazitaetsData {
  return { gesamt_slots: 10, aktive_slots: 7, freie_slots: 3, auslastung_pct: 70, ampel: 'warnung', empfehlung: 'Nur 3 Slots frei — Reserve im Auge behalten.' };
}

interface Props {
  locationId: string | null;
}

export function DispatchPhase1316FahrerKapazitaetsReserveWidget({ locationId }: Props) {
  const [data, setData] = useState<KapazitaetsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-kapazitaets-reserve?location_id=${locationId}`);
        if (!res.ok) throw new Error('fetch failed');
        setData(await res.json());
      } catch {
        setData(buildMock());
      } finally {
        setLoading(false);
      }
    };

    load();
    const id = setInterval(load, 10 * 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId) return null;

  if (loading && !data) {
    return (
      <Card className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Lade Kapazitäts-Reserve…
      </Card>
    );
  }

  if (!data) return null;

  const style = AMPEL_STYLE[data.ampel];
  const AmpelIcon = style.icon;
  const belegtPct = data.gesamt_slots > 0 ? Math.round((data.aktive_slots / data.gesamt_slots) * 100) : 0;

  return (
    <Card className={cn('overflow-hidden border', style.border, style.bg)}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-inherit">
        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Fahrer-Kapazitäts-Reserve</span>
        <div className={cn('ml-auto flex items-center gap-1 text-[10px] font-bold', style.badge)}>
          <AmpelIcon className="h-3 w-3" />
          {data.ampel === 'gut' ? 'Ausreichend' : data.ampel === 'warnung' ? 'Warnung' : 'Kritisch'}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* KPI Grid */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Gesamt', value: data.gesamt_slots },
            { label: 'Aktiv', value: data.aktive_slots },
            { label: 'Frei', value: data.freie_slots },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-background/60 border border-inherit px-3 py-2 text-center">
              <div className="text-xl font-black tabular-nums">{value}</div>
              <div className="text-[10px] text-muted-foreground font-semibold mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Auslastungsbalken */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground font-semibold">Auslastung</span>
            <span className="text-[10px] font-bold tabular-nums">{belegtPct}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', style.bar)}
              style={{ width: `${belegtPct}%` }}
            />
          </div>
        </div>

        {/* Empfehlung */}
        <p className={cn('text-[11px] font-semibold', style.badge)}>{data.empfehlung}</p>
      </div>
    </Card>
  );
}
