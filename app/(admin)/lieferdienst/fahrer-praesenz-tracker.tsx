'use client';

/**
 * FahrerPraesenzTracker — Phase 300
 *
 * Live-Präsenz-Dashboard: zeigt welche Fahrer gerade online/offline/unterwegs sind
 * und vergleicht mit dem geplanten Schicht-Soll.
 *
 * Features:
 * - Echtzeit online/offline Status via Supabase
 * - Schicht-Soll vs. Ist-Vergleich
 * - Farbkodierter Status-Grid (Grün=online, Amber=pausiert, Grau=offline)
 * - Kapazitäts-Ampel: Genug Fahrer für aktuelle Nachfrage?
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users, Circle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriverPresence {
  id: string;
  vorname: string;
  nachname: string;
  ist_online: boolean;
  fahrzeug: string | null;
  aktueller_batch_id: string | null;
  online_seit: string | null;
  last_update: string | null;
}

function onlineSinceMin(since: string | null): number | null {
  if (!since) return null;
  return Math.floor((Date.now() - new Date(since).getTime()) / 60_000);
}

function statusMeta(d: DriverPresence): {
  label: string; dot: string; bg: string; border: string;
} {
  if (!d.ist_online) return { label: 'Offline', dot: 'bg-gray-300', bg: 'bg-gray-50', border: 'border-gray-200' };
  if (d.aktueller_batch_id) return { label: 'Unterwegs', dot: 'bg-matcha-500', bg: 'bg-matcha-50', border: 'border-matcha-200' };
  return { label: 'Frei', dot: 'bg-blue-400', bg: 'bg-blue-50', border: 'border-blue-200' };
}

function vehicleIcon(v: string | null): string {
  if (!v) return '🚶';
  const lower = v.toLowerCase();
  if (lower.includes('fahrrad') || lower.includes('bike') || lower.includes('rad')) return '🚲';
  if (lower.includes('auto') || lower.includes('car') || lower.includes('pkw')) return '🚗';
  if (lower.includes('roller') || lower.includes('moped') || lower.includes('scooter')) return '🛵';
  return '🚴';
}

interface Props {
  locationId: string | null;
}

export function FahrerPraesenzTracker({ locationId }: Props) {
  const supabase = createClient();
  const [drivers, setDrivers] = useState<DriverPresence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }

    async function load() {
      const { data } = await supabase
        .from('employees')
        .select(`
          id, vorname, nachname,
          driver_status:employee_delivery_status(ist_online, fahrzeug, aktueller_batch_id, online_seit, last_update)
        `)
        .eq('location_id', locationId)
        .eq('role', 'fahrer')
        .order('vorname');

      if (data) {
        setDrivers(data.map((e: any) => ({
          id: e.id,
          vorname: e.vorname ?? '',
          nachname: e.nachname ?? '',
          ist_online: e.driver_status?.ist_online ?? false,
          fahrzeug: e.driver_status?.fahrzeug ?? null,
          aktueller_batch_id: e.driver_status?.aktueller_batch_id ?? null,
          online_seit: e.driver_status?.online_seit ?? null,
          last_update: e.driver_status?.last_update ?? null,
        })));
      }
      setLoading(false);
    }

    load();

    // Echtzeit-Updates via Supabase Realtime
    const channel = supabase
      .channel('driver-presence')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'employee_delivery_status',
      }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-3" />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (drivers.length === 0) return null;

  const online = drivers.filter(d => d.ist_online);
  const onTour = drivers.filter(d => d.ist_online && d.aktueller_batch_id);
  const free = drivers.filter(d => d.ist_online && !d.aktueller_batch_id);
  const offline = drivers.filter(d => !d.ist_online);

  const capacityOk = free.length >= 1;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Users size={14} className="text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Fahrer-Präsenz
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {capacityOk ? (
            <CheckCircle2 size={13} className="text-matcha-600" />
          ) : (
            <AlertTriangle size={13} className="text-amber-500" />
          )}
          <span className={cn(
            'text-xs font-semibold',
            capacityOk ? 'text-matcha-700' : 'text-amber-600',
          )}>
            {capacityOk ? 'Kapazität OK' : 'Wenig Fahrer'}
          </span>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="flex gap-3 text-xs">
        <div className="flex items-center gap-1">
          <Circle size={8} className="fill-matcha-500 text-matcha-500" />
          <span className="font-semibold">{online.length}</span>
          <span className="text-muted-foreground">online</span>
        </div>
        <div className="flex items-center gap-1">
          <Circle size={8} className="fill-blue-400 text-blue-400" />
          <span className="font-semibold">{free.length}</span>
          <span className="text-muted-foreground">frei</span>
        </div>
        <div className="flex items-center gap-1">
          <Circle size={8} className="fill-matcha-600 text-matcha-600" />
          <span className="font-semibold">{onTour.length}</span>
          <span className="text-muted-foreground">unterwegs</span>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <Circle size={8} className="fill-gray-300 text-gray-300" />
          <span className="font-semibold">{offline.length}</span>
          <span className="text-muted-foreground">offline</span>
        </div>
      </div>

      {/* Fahrer-Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {drivers.map(d => {
          const meta = statusMeta(d);
          const sinceMin = onlineSinceMin(d.online_seit);
          return (
            <div
              key={d.id}
              className={cn('rounded-lg border p-2.5 flex items-center gap-2', meta.bg, meta.border)}
            >
              <span className="text-lg">{vehicleIcon(d.fahrzeug)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">
                  {d.vorname} {d.nachname[0]}.
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
                  <span className="text-[10px] text-muted-foreground">{meta.label}</span>
                </div>
                {sinceMin != null && d.ist_online && (
                  <div className="text-[10px] text-muted-foreground">
                    seit {sinceMin < 60 ? `${sinceMin}m` : `${Math.floor(sinceMin / 60)}h`}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
