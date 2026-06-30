'use client';

import { useEffect, useState } from 'react';
import { Activity, Bike, CheckCircle2, Clock, Loader2, Navigation, Package, Power, PowerOff } from 'lucide-react';
import { cn } from '@/lib/utils';

type EventType = 'tour_started' | 'stop_arrived' | 'stop_delivered' | 'tour_completed' | 'pause' | 'online' | 'offline';

interface ActivityEvent {
  id: string;
  eventType: EventType;
  driverId: string;
  driverName: string;
  occurredAt: string;
  minutesAgo: number;
  detail: string | null;
  zone: string | null;
  batchId: string | null;
}

interface DriverSummary {
  driverId: string;
  driverName: string;
  eventCount: number;
  deliveries: number;
  toursStarted: number;
  lastSeen: string | null;
}

interface ApiResponse {
  ok: boolean;
  events: ActivityEvent[];
  drivers: DriverSummary[];
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const eventMeta: Record<EventType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  tour_started:   { label: 'Tour gestartet',  icon: Bike,          color: 'text-blue-600',   bg: 'bg-blue-50' },
  stop_arrived:   { label: 'Stopp erreicht',  icon: Navigation,    color: 'text-indigo-600', bg: 'bg-indigo-50' },
  stop_delivered: { label: 'Geliefert',       icon: CheckCircle2,  color: 'text-green-600',  bg: 'bg-green-50' },
  tour_completed: { label: 'Tour beendet',    icon: Package,       color: 'text-violet-600', bg: 'bg-violet-50' },
  pause:          { label: 'Pause',           icon: Clock,         color: 'text-amber-600',  bg: 'bg-amber-50' },
  online:         { label: 'Online',          icon: Power,         color: 'text-emerald-600',bg: 'bg-emerald-50' },
  offline:        { label: 'Offline',         icon: PowerOff,      color: 'text-stone-500',  bg: 'bg-stone-100' },
};

function fmtAgo(min: number): string {
  if (min < 1) return 'gerade';
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `vor ${h}h ${m}m` : `vor ${h}h`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function DispatchFahrerAktivitaetsLog({ locationId }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false); // Standardmäßig zugeklappt
  const [view, setView] = useState<'log' | 'summary'>('log');

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/fahrer-aktivitaets-log?location_id=${encodeURIComponent(locationId)}&limit=60`)
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        setEvents(d.events ?? []);
        setDrivers(d.drivers ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;
  if (!loading && events.length === 0) return null;

  const deliveries = events.filter((e) => e.eventType === 'stop_delivered').length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-3 border-b border-stone-100 hover:bg-stone-50 transition text-left"
      >
        <Activity className="h-4 w-4 text-rose-500 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Fahrer-Aktivitäts-Protokoll</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {!loading && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            {deliveries} Lieferungen · {drivers.length} Fahrer
          </span>
        )}
        <span className="ml-1 text-stone-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div>
          {/* Tab Switcher */}
          <div className="flex border-b border-stone-100">
            {(['log', 'summary'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'flex-1 py-2 text-xs font-semibold transition',
                  view === v
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-500 hover:bg-stone-50',
                )}
              >
                {v === 'log' ? 'Ereignis-Log' : 'Fahrer-Übersicht'}
              </button>
            ))}
          </div>

          {view === 'log' && (
            <div className="divide-y divide-stone-100 max-h-[400px] overflow-y-auto">
              {events.map((ev) => {
                const meta = eventMeta[ev.eventType] ?? eventMeta.tour_started;
                const Icon = meta.icon;
                return (
                  <div key={ev.id} className={cn('px-4 py-2.5 flex items-center gap-3', meta.bg)}>
                    <div className={cn('shrink-0 rounded-full p-1.5', 'bg-white/70')}>
                      <Icon className={cn('h-3.5 w-3.5', meta.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs truncate">{ev.driverName}</span>
                        <span className={cn('text-[10px] font-bold', meta.color)}>{meta.label}</span>
                        {ev.zone && (
                          <span className="text-[9px] rounded-full bg-white/60 border px-1.5 py-0.5 font-bold">
                            Zone {ev.zone}
                          </span>
                        )}
                      </div>
                      {ev.detail && (
                        <div className="text-[10px] text-stone-500 mt-0.5 truncate">{ev.detail}</div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-[11px] font-bold">{fmtTime(ev.occurredAt)}</div>
                      <div className="text-[9px] text-stone-400">{fmtAgo(ev.minutesAgo)}</div>
                    </div>
                  </div>
                );
              })}
              {events.length === 0 && (
                <div className="px-5 py-6 text-center text-stone-400 text-sm">Keine Ereignisse heute.</div>
              )}
            </div>
          )}

          {view === 'summary' && (
            <div className="divide-y divide-stone-100">
              {drivers.map((d) => (
                <div key={d.driverId} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{d.driverName}</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">
                      {d.toursStarted} Tour{d.toursStarted !== 1 ? 'en' : ''} · {d.eventCount} Ereignisse
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-lg font-black text-green-700 tabular-nums">{d.deliveries}</div>
                    <div className="text-[9px] text-stone-400">Lieferungen</div>
                  </div>
                  {d.lastSeen && (
                    <div className="text-right shrink-0 ml-2">
                      <div className="font-mono text-xs text-stone-600">{fmtTime(d.lastSeen)}</div>
                      <div className="text-[9px] text-stone-400">zuletzt</div>
                    </div>
                  )}
                </div>
              ))}
              {drivers.length === 0 && (
                <div className="px-5 py-6 text-center text-stone-400 text-sm">Keine Fahrer-Daten heute.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
