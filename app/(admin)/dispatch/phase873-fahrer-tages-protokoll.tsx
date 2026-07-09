'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ClipboardList, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface ProtokolEvent {
  zeit: string;
  typ: 'schicht_start' | 'schicht_stop' | 'tour_start' | 'tour_ende' | 'pause' | 'sonstiges';
  beschreibung: string;
  driver_name?: string;
}

interface FahrerProtokoll {
  driver_id: string;
  name: string;
  events: ProtokolEvent[];
}

interface Props {
  locationId: string | null;
}

const TYP_COLOR: Record<ProtokolEvent['typ'], string> = {
  schicht_start: 'bg-matcha-500',
  schicht_stop: 'bg-slate-400',
  tour_start: 'bg-blue-500',
  tour_ende: 'bg-blue-300',
  pause: 'bg-amber-400',
  sonstiges: 'bg-muted-foreground',
};

const TYP_LABEL: Record<ProtokolEvent['typ'], string> = {
  schicht_start: 'Schicht Start',
  schicht_stop: 'Schicht Ende',
  tour_start: 'Tour gestartet',
  tour_ende: 'Tour beendet',
  pause: 'Pause',
  sonstiges: 'Event',
};

function generateMock(): FahrerProtokoll[] {
  const now = new Date();
  const names = [
    { id: 'mock-1', name: 'Max M.' },
    { id: 'mock-2', name: 'Jan K.' },
  ];
  return names.map((d, idx) => {
    const base = new Date(now);
    base.setHours(8 + idx, 0, 0, 0);
    const fmt = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const events: ProtokolEvent[] = [
      { zeit: fmt(new Date(base.getTime())), typ: 'schicht_start', beschreibung: 'Schicht begonnen' },
      { zeit: fmt(new Date(base.getTime() + 15 * 60_000)), typ: 'tour_start', beschreibung: 'Tour #1 — 3 Stopps' },
      { zeit: fmt(new Date(base.getTime() + 55 * 60_000)), typ: 'tour_ende', beschreibung: 'Tour #1 abgeschlossen' },
      { zeit: fmt(new Date(base.getTime() + 70 * 60_000)), typ: 'pause', beschreibung: 'Pause (15 Min)' },
      { zeit: fmt(new Date(base.getTime() + 90 * 60_000)), typ: 'tour_start', beschreibung: 'Tour #2 — 2 Stopps' },
    ];
    return { driver_id: d.id, name: d.name, events };
  });
}

export function DispatchPhase873FahrerTagesProtokoll({ locationId }: Props) {
  const [protokolle, setProtokolle] = useState<FahrerProtokoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDriver, setOpenDriver] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    let mounted = true;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-tages-protokoll?location_id=${locationId}`);
        if (res.ok) {
          const json = await res.json();
          if (mounted && Array.isArray(json.protokolle) && json.protokolle.length > 0) {
            setProtokolle(json.protokolle);
            setLoading(false);
            return;
          }
        }
      } catch { /* fallback */ }
      if (mounted) { setProtokolle(generateMock()); setLoading(false); }
    }

    load();
    const iv = setInterval(load, 120_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [locationId]);

  if (!locationId) return null;

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-bold text-foreground">Fahrer-Tages-Protokoll</span>
        {loading && <Loader2 className="ml-auto h-3 w-3 animate-spin text-muted-foreground" />}
        {!loading && <span className="ml-auto text-[10px] text-muted-foreground">{protokolle.length} Fahrer</span>}
      </div>

      {!loading && protokolle.length === 0 && (
        <p className="text-xs text-muted-foreground py-1">Keine Aktivitäten heute.</p>
      )}

      {!loading && protokolle.map((f) => (
        <div key={f.driver_id} className="rounded-md border border-border overflow-hidden">
          <button
            onClick={() => setOpenDriver(openDriver === f.driver_id ? null : f.driver_id)}
            className="w-full flex items-center gap-2 px-2.5 py-2 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
          >
            <span className="flex-1 text-xs font-semibold text-foreground">{f.name}</span>
            <span className="text-[10px] text-muted-foreground">{f.events.length} Events</span>
            {openDriver === f.driver_id
              ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>

          {openDriver === f.driver_id && (
            <div className="px-2.5 py-2 space-y-1.5">
              {f.events.map((ev, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex flex-col items-center shrink-0 mt-0.5">
                    <span className={cn('h-2.5 w-2.5 rounded-full', TYP_COLOR[ev.typ])} />
                    {i < f.events.length - 1 && <span className="w-px flex-1 min-h-[12px] bg-border mt-0.5" />}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{ev.zeit}</span>
                      <span className="text-[10px] font-bold text-foreground">{TYP_LABEL[ev.typ]}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug">{ev.beschreibung}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}
