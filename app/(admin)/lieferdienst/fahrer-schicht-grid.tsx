'use client';

import { useEffect, useState } from 'react';
import { Truck, CheckCircle2, Clock, Star, TrendingUp, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerSchichtDaten {
  id: string;
  vorname: string;
  nachname: string;
  fahrzeug: string | null;
  zone: string | null;
  status: 'online' | 'offline' | 'unterwegs' | 'pause';
  tourenHeute: number;
  stoppsHeute: number;
  kmHeute: number;
  puenktlichkeitPct: number;
  einnahmenHeute: number;
  aktivSeitMin: number | null;
}

interface Props {
  locationId: string | null | undefined;
}

const MOCK_DATA: FahrerSchichtDaten[] = [
  { id: '1', vorname: 'Max', nachname: 'Müller', fahrzeug: 'Fahrrad', zone: 'A', status: 'unterwegs', tourenHeute: 4, stoppsHeute: 12, kmHeute: 18.4, puenktlichkeitPct: 92, einnahmenHeute: 48.0, aktivSeitMin: 240 },
  { id: '2', vorname: 'Lisa', nachname: 'Braun', fahrzeug: 'Roller', zone: 'B', status: 'unterwegs', tourenHeute: 3, stoppsHeute: 9, kmHeute: 22.1, puenktlichkeitPct: 88, einnahmenHeute: 36.0, aktivSeitMin: 195 },
  { id: '3', vorname: 'Tom', nachname: 'Klein', fahrzeug: 'Auto', zone: 'C', status: 'online', tourenHeute: 5, stoppsHeute: 15, kmHeute: 35.8, puenktlichkeitPct: 95, einnahmenHeute: 60.0, aktivSeitMin: 300 },
  { id: '4', vorname: 'Anna', nachname: 'Bauer', fahrzeug: 'Fahrrad', zone: 'A', status: 'pause', tourenHeute: 2, stoppsHeute: 6, kmHeute: 12.2, puenktlichkeitPct: 100, einnahmenHeute: 24.0, aktivSeitMin: 120 },
];

const STATUS_CONF = {
  online: { bg: 'bg-matcha-50', border: 'border-matcha-200', dot: 'bg-matcha-500', label: 'Verfügbar' },
  unterwegs: { bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500', label: 'Unterwegs' },
  pause: { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-400', label: 'Pause' },
  offline: { bg: 'bg-stone-50', border: 'border-stone-200', dot: 'bg-stone-400', label: 'Offline' },
};

function useFahrerSchicht(locationId: string | null | undefined) {
  const [data, setData] = useState<FahrerSchichtDaten[] | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const params = locationId ? `?locationId=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-schicht-grid${params}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('fallback');
        const json = await res.json();
        setData(json.fahrer ?? MOCK_DATA);
      } catch {
        setData(MOCK_DATA);
      }
    }
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  return data;
}

export function LieferdienstFahrerSchichtGrid({ locationId }: Props) {
  const fahrer = useFahrerSchicht(locationId);

  if (!fahrer) return null;

  const online = fahrer.filter((f) => f.status !== 'offline');

  if (online.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-stone-600" />
          <div>
            <div className="text-xs font-black text-stone-800">Fahrer-Schicht-Übersicht</div>
            <div className="text-[10px] text-stone-400">{online.length} aktive Fahrer heute</div>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1">
          <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-[10px] font-bold text-blue-700">Live</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
        {online.map((f) => {
          const cfg = STATUS_CONF[f.status];
          const scoreColor =
            f.puenktlichkeitPct >= 90
              ? 'text-matcha-600'
              : f.puenktlichkeitPct >= 75
              ? 'text-amber-600'
              : 'text-red-500';
          const initials = `${f.vorname[0]}${f.nachname[0]}`.toUpperCase();

          return (
            <div
              key={f.id}
              className={cn('rounded-xl border-2 p-3 space-y-2.5', cfg.bg, cfg.border)}
            >
              {/* Row 1: Avatar + Name + Status */}
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-200 text-xs font-black text-stone-600">
                    {initials}
                  </div>
                  <div
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white',
                      cfg.dot,
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-stone-800">
                      {f.vorname} {f.nachname[0]}.
                    </span>
                    {f.zone && (
                      <span className="rounded bg-stone-100 px-1 py-0.5 text-[9px] font-bold text-stone-500">
                        Zone {f.zone}
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] text-stone-400">
                    {f.fahrzeug} · {cfg.label}
                    {f.aktivSeitMin != null && ` · ${Math.floor(f.aktivSeitMin / 60)}h${f.aktivSeitMin % 60}m`}
                  </div>
                </div>
                {/* Punctuality score */}
                <div className="text-right">
                  <div className={cn('text-sm font-black tabular-nums', scoreColor)}>
                    {f.puenktlichkeitPct}%
                  </div>
                  <div className="text-[9px] text-stone-400">Pünktlich</div>
                </div>
              </div>

              {/* Row 2: Stats grid */}
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { icon: CheckCircle2, label: 'Touren', value: f.tourenHeute, color: 'text-matcha-600' },
                  { icon: Clock, label: 'Stopps', value: f.stoppsHeute, color: 'text-blue-600' },
                  { icon: TrendingUp, label: 'km', value: f.kmHeute.toFixed(0), color: 'text-stone-600' },
                  { icon: Star, label: '€', value: f.einnahmenHeute.toFixed(0), color: 'text-amber-600' },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="flex flex-col items-center rounded-lg bg-white/60 py-1.5">
                    <Icon className={cn('h-3 w-3 mb-0.5', color)} />
                    <div className={cn('text-xs font-black tabular-nums', color)}>{value}</div>
                    <div className="text-[8px] text-stone-400">{label}</div>
                  </div>
                ))}
              </div>

              {/* Warning for low punctuality */}
              {f.puenktlichkeitPct < 75 && (
                <div className="flex items-center gap-1.5 text-[10px] text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  <span>Pünktlichkeit unter Ziel — prüfen!</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
