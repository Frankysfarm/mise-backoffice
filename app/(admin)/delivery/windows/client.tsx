'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { RefreshCw, ToggleLeft, ToggleRight, Play } from 'lucide-react';

interface TimeSlot {
  id: string;
  day_of_week: number;
  slot_start_utc: string;
  slot_end_utc: string;
  capacity: number;
  is_active: boolean;
  slot_type: 'standard' | 'express' | 'scheduled';
  extra_fee_eur: number;
  label: string | null;
}

interface WindowStats {
  total_slots: number;
  active_slots: number;
  total_bookings_today: number;
  pending_bookings: number;
  dispatched_bookings: number;
}

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const SLOT_TYPE_CONFIG = {
  standard:  { label: 'Standard',  badge: 'bg-blue-50 border-blue-200 text-blue-700' },
  express:   { label: 'Express',   badge: 'bg-amber-50 border-amber-200 text-amber-700' },
  scheduled: { label: 'Geplant',   badge: 'bg-matcha-50 border-matcha-200 text-matcha-700' },
};

export function WindowsClient({ locationId }: { locationId: string }) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [stats, setStats] = useState<WindowStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`/api/delivery/admin/windows?action=slots`).then(r => r.ok ? r.json() : null),
      fetch(`/api/delivery/admin/windows?action=stats`).then(r => r.ok ? r.json() : null),
    ]).then(([s, st]) => {
      if (s?.slots) setSlots(s.slots as TimeSlot[]);
      if (st) setStats(st as WindowStats);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [locationId]);

  const toggleSlot = async (slotId: string, current: boolean) => {
    setToggling(slotId);
    setError(null);
    const res = await fetch('/api/delivery/admin/windows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_slot', slot_id: slotId, is_active: !current }),
    });
    if (res.ok) {
      setSlots(prev => prev.map(s => s.id === slotId ? { ...s, is_active: !current } : s));
    } else {
      const json = await res.json();
      setError(json.error ?? 'Fehler beim Umschalten');
    }
    setToggling(null);
  };

  const processDispatch = async () => {
    setProcessing(true);
    setProcessResult(null);
    setError(null);
    const res = await fetch('/api/delivery/admin/windows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'process_dispatch' }),
    });
    const json = await res.json();
    if (res.ok) {
      setProcessResult(`${json.released ?? 0} Fenster freigegeben · ${json.bookings_confirmed ?? 0} Buchungen bestätigt`);
    } else {
      setError(json.error ?? 'Fehler beim Dispatch');
    }
    setProcessing(false);
  };

  const slotsByDay = DAY_LABELS.map((_, i) => ({
    day: i,
    slots: slots.filter(s => s.day_of_week === i),
  }));

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Aktualisieren
        </button>
        <button onClick={processDispatch} disabled={processing} className="flex items-center gap-1.5 rounded-lg border border-matcha-700 bg-matcha-700 text-white px-3 py-1.5 text-sm font-semibold hover:bg-matcha-800 transition disabled:opacity-50">
          <Play className="h-3.5 w-3.5" />
          {processing ? 'Läuft…' : 'Dispatch auslösen'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">{error}</div>
      )}
      {processResult && (
        <div className="rounded-xl border border-matcha-200 bg-matcha-50 px-4 py-3 text-matcha-800 text-sm font-medium">{processResult}</div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Slots gesamt</div>
            <div className="font-display text-2xl font-black">{stats.total_slots}</div>
            <div className="text-[11px] text-muted-foreground">{stats.active_slots} aktiv</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Buchungen heute</div>
            <div className="font-display text-2xl font-black">{stats.total_bookings_today}</div>
          </div>
          <div className={cn('rounded-xl border px-4 py-3', stats.pending_bookings > 0 ? 'bg-amber-50 border-amber-200' : 'bg-card')}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Ausstehend</div>
            <div className={cn('font-display text-2xl font-black', stats.pending_bookings > 0 ? 'text-amber-700' : '')}>{stats.pending_bookings}</div>
          </div>
          <div className="rounded-xl border bg-matcha-50 border-matcha-200 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Dispatcht</div>
            <div className="font-display text-2xl font-black text-matcha-700">{stats.dispatched_bookings}</div>
          </div>
        </div>
      )}

      {loading && <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Slots…</div>}

      {/* Slot grid by day */}
      {!loading && (
        <div className="space-y-4">
          {slotsByDay.map(({ day, slots: daySlots }) => {
            if (daySlots.length === 0) return null;
            return (
              <div key={day} className="rounded-xl border bg-card overflow-hidden">
                <div className="px-4 py-2.5 border-b bg-muted/30 font-display font-bold text-sm">{DAY_LABELS[day]}</div>
                <div className="divide-y divide-border">
                  {daySlots.map(slot => {
                    const tc = SLOT_TYPE_CONFIG[slot.slot_type] ?? { label: slot.slot_type, badge: 'bg-muted border-border text-muted-foreground' };
                    return (
                      <div key={slot.id} className={cn('px-4 py-2.5 flex items-center gap-3', !slot.is_active && 'opacity-50')}>
                        <div className="w-28 text-sm font-medium tabular-nums">{slot.slot_start_utc} – {slot.slot_end_utc}</div>
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold border', tc.badge)}>{tc.label}</span>
                        {slot.label && <span className="text-xs text-muted-foreground">{slot.label}</span>}
                        <span className="text-xs text-muted-foreground">Kap. {slot.capacity}</span>
                        {slot.extra_fee_eur > 0 && <span className="text-xs text-muted-foreground">+{euro(slot.extra_fee_eur)}</span>}
                        <button
                          onClick={() => toggleSlot(slot.id, slot.is_active)}
                          disabled={toggling === slot.id}
                          className="ml-auto flex items-center gap-1 text-xs font-bold disabled:opacity-50 transition"
                        >
                          {slot.is_active
                            ? <><ToggleRight className="h-4 w-4 text-matcha-700" /><span className="text-matcha-700">Aktiv</span></>
                            : <><ToggleLeft className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Inaktiv</span></>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {slots.length === 0 && (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Keine Slots konfiguriert.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
