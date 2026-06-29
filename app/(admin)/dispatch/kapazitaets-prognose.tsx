'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Users, Clock, AlertTriangle, CheckCircle, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CapacitySlot {
  hourUtc: number;
  label: string;
  expectedOrders: number;
  availableDrivers: number;
  ordersPerDriver: number;
  level: 'ok' | 'tight' | 'critical' | 'idle';
}

interface CapacitySummary {
  totalExpected: number;
  peakHour: number | null;
  peakLevel: 'ok' | 'tight' | 'critical' | 'idle';
  avgOrdersPerDriver: number;
  onlineDriversNow: number;
}

interface Props {
  locationId: string | null;
}

const LEVEL_STYLE = {
  ok: { bg: 'bg-matcha-500', text: 'text-matcha-700', badge: 'bg-matcha-100 text-matcha-700', label: 'OK' },
  tight: { bg: 'bg-amber-400', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', label: 'Eng' },
  critical: { bg: 'bg-red-500', text: 'text-red-700', badge: 'bg-red-100 text-red-700', label: 'Kritisch' },
  idle: { bg: 'bg-blue-300', text: 'text-blue-600', badge: 'bg-blue-50 text-blue-600', label: 'Ruhig' },
};

function LevelIcon({ level }: { level: CapacitySlot['level'] }) {
  if (level === 'critical') return <AlertTriangle className="h-3 w-3 text-red-500" />;
  if (level === 'tight') return <TrendingUp className="h-3 w-3 text-amber-500" />;
  if (level === 'ok') return <CheckCircle className="h-3 w-3 text-matcha-600" />;
  return <Minus className="h-3 w-3 text-blue-400" />;
}

export function DispatchKapazitaetsPrognose({ locationId }: Props) {
  const [slots, setSlots] = useState<CapacitySlot[]>([]);
  const [summary, setSummary] = useState<CapacitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState('');

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/schicht-kapazitaets-prognose?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setSlots(d.slots ?? []);
          setSummary(d.summary ?? null);
          setLastRefresh(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-4 space-y-2">
        <div className="h-4 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const maxExpected = Math.max(1, ...slots.map((s) => s.expectedOrders));

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
        <Clock className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
          Kapazitäts-Prognose · 4h
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">{lastRefresh}</span>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-0 border-b divide-x text-center">
        <div className="py-3 px-2">
          <div className="text-lg font-black tabular-nums text-foreground">{summary.onlineDriversNow}</div>
          <div className="text-[9px] text-muted-foreground flex items-center justify-center gap-1">
            <Users className="h-2.5 w-2.5" /> Fahrer online
          </div>
        </div>
        <div className="py-3 px-2">
          <div className="text-lg font-black tabular-nums text-foreground">{summary.totalExpected}</div>
          <div className="text-[9px] text-muted-foreground">Bestellungen erwartet</div>
        </div>
        <div className="py-3 px-2">
          <div className={cn('text-lg font-black tabular-nums', LEVEL_STYLE[summary.peakLevel].text)}>
            {summary.avgOrdersPerDriver.toFixed(1)}
          </div>
          <div className="text-[9px] text-muted-foreground">Bestellungen/Fahrer Ø</div>
        </div>
      </div>

      {/* Slots */}
      <div className="grid grid-cols-4 gap-0 divide-x p-3 gap-x-3">
        {slots.map((slot) => {
          const style = LEVEL_STYLE[slot.level];
          const barPct = maxExpected > 0 ? Math.round((slot.expectedOrders / maxExpected) * 100) : 0;
          return (
            <div key={slot.hourUtc} className="flex flex-col items-center gap-1.5 p-1">
              <div className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5', style.badge)}>
                {style.label}
              </div>
              <div className="text-xs font-black tabular-nums text-foreground">{slot.label}</div>
              {/* Bar */}
              <div className="w-full h-14 flex items-end bg-muted/40 rounded overflow-hidden">
                <div
                  className={cn('w-full rounded-t transition-all duration-500', style.bg)}
                  style={{ height: `${Math.max(4, barPct)}%` }}
                />
              </div>
              <div className="text-[9px] text-muted-foreground text-center">
                <span className="font-bold text-foreground">{slot.expectedOrders}</span> Bestellungen
              </div>
              <div className="text-[9px] text-muted-foreground flex items-center gap-1">
                <LevelIcon level={slot.level} />
                {slot.ordersPerDriver.toFixed(1)} / Fahrer
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
