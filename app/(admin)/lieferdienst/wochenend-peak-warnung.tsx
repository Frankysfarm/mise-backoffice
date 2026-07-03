'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AlertTriangle, Calendar, TrendingUp, Users, ChevronDown, ChevronUp, Loader2, CheckCircle2 } from 'lucide-react';

interface AvailabilitySlot {
  hourLabel: string;
  driversAvailable: number;
  level: 'kritisch' | 'niedrig' | 'ausreichend' | 'gut';
}

interface CapacitySummary {
  currentOnline: number;
  plannedNext4h: number;
  avgAvailable: number;
  minAvailable: number;
  peakHour: string;
  alertLevel: 'kritisch' | 'niedrig' | 'ok';
}

interface FahrerPrognose {
  ok: boolean;
  slots: AvailabilitySlot[];
  summary: CapacitySummary;
  generatedAt: string;
}

interface Props {
  locationId?: string | null;
}

function isWeekend(): boolean {
  const day = new Date().getDay();
  return day === 0 || day === 5 || day === 6; // Fr, Sa, So
}

function peakWarningLevel(summary: CapacitySummary, isWE: boolean): 'none' | 'niedrig' | 'hoch' | 'kritisch' {
  if (!isWE) return 'none';
  if (summary.alertLevel === 'kritisch') return 'kritisch';
  if (summary.alertLevel === 'niedrig') return 'hoch';
  if (summary.minAvailable <= 2) return 'niedrig';
  return 'none';
}

export function LieferdienstWochenenPeakWarnung({ locationId }: Props) {
  const [data, setData] = useState<FahrerPrognose | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const weekend = isWeekend();

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    let cancelled = false;
    const load = () => {
      fetch(`/api/delivery/admin/fahrer-verfuegbarkeits-prognose?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
        .catch(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const iv = setInterval(load, 120_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!locationId) return null;

  const warnLevel = data ? peakWarningLevel(data.summary, weekend) : 'none';

  if (!weekend && warnLevel === 'none') {
    // Nur minimale Kachel an Werktagen ohne Problem
    return null;
  }

  const WARN_STYLE = {
    none:     { bg: 'bg-matcha-50',  border: 'border-matcha-200',  header: 'bg-matcha-600',  text: 'text-matcha-700',  label: 'Kapazität OK'            },
    niedrig:  { bg: 'bg-blue-50',    border: 'border-blue-200',    header: 'bg-blue-600',    text: 'text-blue-700',    label: 'Leicht angespannt'       },
    hoch:     { bg: 'bg-amber-50',   border: 'border-amber-300',   header: 'bg-amber-500',   text: 'text-amber-700',   label: 'Peak-Warnung aktiv'      },
    kritisch: { bg: 'bg-red-50',     border: 'border-red-400',     header: 'bg-red-600',     text: 'text-red-700',     label: 'Kapazitäts-Alarm!'       },
  };

  const ws = WARN_STYLE[warnLevel];

  const SLOT_LEVEL_STYLE: Record<string, string> = {
    kritisch:   'bg-red-500',
    niedrig:    'bg-amber-400',
    ausreichend:'bg-blue-400',
    gut:        'bg-matcha-500',
  };

  return (
    <Card className={cn('overflow-hidden border-2', ws.border)}>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn('w-full flex items-center gap-2 px-4 py-2.5 text-white', ws.header)}
      >
        {warnLevel === 'kritisch' || warnLevel === 'hoch'
          ? <AlertTriangle className="h-4 w-4 shrink-0" />
          : warnLevel === 'none'
          ? <CheckCircle2 className="h-4 w-4 shrink-0" />
          : <Calendar className="h-4 w-4 shrink-0" />
        }
        <span className="text-xs font-black uppercase tracking-wider">
          {weekend ? 'Wochenend-Kapazität' : 'Fahrer-Verfügbarkeit'} · {ws.label}
        </span>
        <div className="ml-auto">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className={cn('p-3 space-y-3', ws.bg)}>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Lade Verfügbarkeits-Prognose…
            </div>
          )}

          {!loading && data && (
            <>
              {/* Summary-Row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Jetzt online', value: data.summary.currentOnline, icon: Users },
                  { label: 'Ø 4h-Prognose', value: `${data.summary.avgAvailable}`, icon: TrendingUp },
                  { label: 'Min. verfügbar', value: data.summary.minAvailable, icon: AlertTriangle },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-lg bg-white/70 border border-white/80 px-3 py-2 text-center">
                    <Icon size={14} className={cn('mx-auto mb-0.5', ws.text)} />
                    <div className={cn('text-lg font-black tabular-nums', ws.text)}>{value}</div>
                    <div className="text-[9px] text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>

              {/* Stundenbalken */}
              {data.slots.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Verfügbarkeit je Stunde
                  </div>
                  <div className="flex items-end gap-1.5 h-12">
                    {data.slots.map((slot) => {
                      const maxH = Math.max(...data.slots.map(s => s.driversAvailable), 1);
                      const heightPct = Math.max(8, Math.round((slot.driversAvailable / maxH) * 100));
                      return (
                        <div key={slot.hourLabel} className="flex-1 flex flex-col items-center gap-0.5">
                          <div
                            className={cn('w-full rounded-t', SLOT_LEVEL_STYLE[slot.level] ?? 'bg-muted')}
                            style={{ height: `${heightPct}%` }}
                          />
                          <span className="text-[8px] text-muted-foreground tabular-nums">{slot.hourLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Peak-Empfehlung */}
              {(warnLevel === 'hoch' || warnLevel === 'kritisch') && (
                <div className={cn('rounded-lg border px-3 py-2 text-xs font-bold', ws.text, ws.border, 'bg-white/50')}>
                  {warnLevel === 'kritisch'
                    ? `Kapazitätslücke am ${weekend ? 'Wochenende' : 'heutigen Tag'}! Zusatz-Fahrer einplanen oder Annahme-Stopp aktivieren.`
                    : `Wochenend-Peak erwartet. Mindestens ${Math.max(0, 3 - data.summary.minAvailable)} zusätzliche Fahrer einplanen.`
                  }
                </div>
              )}
            </>
          )}

          {!loading && !data && (
            <div className="text-sm text-muted-foreground text-center py-2">Daten nicht verfügbar.</div>
          )}
        </div>
      )}
    </Card>
  );
}
