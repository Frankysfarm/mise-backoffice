'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MapPin, Loader2, TrendingUp, Users, AlertTriangle, ChevronDown, ChevronUp, Crosshair } from 'lucide-react';

interface ZoneEinsatz {
  zone: string;
  openOrders: number;
  availableDrivers: number;
  pressureRatio: number; // Bestellungen / Fahrer
  level: 'ok' | 'elevated' | 'high' | 'critical';
  recommendation: string;
  priority: number; // 1 = höchste Priorität
}

interface ZonenBestelldruckData {
  ok: boolean;
  zones: ZoneEinsatz[];
  generatedAt: string;
}

interface AvailabilitySlot {
  hourLabel: string;
  driversAvailable: number;
  level: string;
}

interface FahrerPrognose {
  ok: boolean;
  slots: AvailabilitySlot[];
  summary: { currentOnline: number; alertLevel: string };
}

interface Props {
  locationId?: string | null;
}

const LEVEL_STYLE = {
  critical: { bg: 'bg-red-50',     border: 'border-red-300',    badge: 'bg-red-500 text-white',     text: 'text-red-700'    },
  high:     { bg: 'bg-amber-50',   border: 'border-amber-300',  badge: 'bg-amber-400 text-white',   text: 'text-amber-700'  },
  elevated: { bg: 'bg-blue-50',    border: 'border-blue-200',   badge: 'bg-blue-400 text-white',    text: 'text-blue-700'   },
  ok:       { bg: 'bg-matcha-50',  border: 'border-matcha-200', badge: 'bg-matcha-500 text-white',  text: 'text-matcha-700' },
};

const LEVEL_LABEL = { critical: 'Kritisch', high: 'Hoch', elevated: 'Erhöht', ok: 'Normal' };

export function DispatchZonenEinsatzEmpfehlung({ locationId }: Props) {
  const [zoneData, setZoneData] = useState<ZonenBestelldruckData | null>(null);
  const [fahrerData, setFahrerData] = useState<FahrerPrognose | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const [zRes, fRes] = await Promise.all([
          fetch(`/api/delivery/admin/zonen-bestelldruck?location_id=${locationId}`).then(r => r.ok ? r.json() : null),
          fetch(`/api/delivery/admin/fahrer-verfuegbarkeits-prognose?location_id=${locationId}`).then(r => r.ok ? r.json() : null),
        ]);
        if (!cancelled) {
          setZoneData(zRes);
          setFahrerData(fRes);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!locationId) return null;

  const urgentZones = (zoneData?.zones ?? [])
    .filter(z => z.level === 'critical' || z.level === 'high')
    .sort((a, b) => b.pressureRatio - a.pressureRatio)
    .slice(0, 4);

  const currentOnline = fahrerData?.summary.currentOnline ?? 0;
  const nextSlotAvailable = fahrerData?.slots?.[1]?.driversAvailable ?? 0;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition"
      >
        <Crosshair className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Zonen-Einsatz-Empfehlung</span>
        {urgentZones.length > 0 && (
          <span className="rounded-full bg-red-500 text-white px-2 py-0.5 text-[9px] font-bold ml-1">
            {urgentZones.length} dringend
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">
            {currentOnline} online
          </span>
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />Lade Empfehlungen…
            </div>
          )}

          {!loading && urgentZones.length === 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-matcha-50 border border-matcha-200 px-3 py-2 text-sm text-matcha-700">
              <TrendingUp className="h-4 w-4 shrink-0" />
              Alle Zonen gut abgedeckt — kein Handlungsbedarf.
            </div>
          )}

          {!loading && urgentZones.map((zone, i) => {
            const s = LEVEL_STYLE[zone.level];
            return (
              <div key={zone.zone} className={cn('rounded-lg border px-3 py-2 flex items-center gap-3', s.bg, s.border)}>
                <div className="shrink-0 flex flex-col items-center">
                  <span className="text-[10px] font-bold text-muted-foreground">#{i + 1}</span>
                  <MapPin size={16} className={s.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-black">Zone {zone.zone}</span>
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', s.badge)}>
                      {LEVEL_LABEL[zone.level]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {zone.openOrders} Best. / {zone.availableDrivers} Fahrer
                    </span>
                  </div>
                  <div className={cn('text-[11px] mt-0.5 truncate', s.text)}>{zone.recommendation}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={cn('font-mono text-base font-black tabular-nums', s.text)}>
                    {zone.pressureRatio.toFixed(1)}x
                  </div>
                  <div className="text-[8px] text-muted-foreground">Druck</div>
                </div>
              </div>
            );
          })}

          {/* Fahrer-Verfügbarkeit nächste Stunde */}
          {!loading && fahrerData && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 border border-border px-3 py-2">
              <Users size={14} className="shrink-0 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground flex-1">
                Jetzt <span className="font-bold text-foreground">{currentOnline}</span> Fahrer online ·
                nächste Stunde <span className="font-bold text-foreground">{nextSlotAvailable}</span> verfügbar
              </span>
              {fahrerData.summary.alertLevel !== 'ok' && (
                <AlertTriangle size={12} className="text-amber-500 shrink-0" />
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
