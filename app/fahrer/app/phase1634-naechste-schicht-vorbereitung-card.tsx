'use client';

import React, { useEffect, useState, useMemo } from 'react';

interface Props {
  driverId: string | null;
  isOnline: boolean;
}

interface SchichtInfo {
  start: string;
  end: string;
  zone?: string | null;
}

interface CheckItem {
  id: string;
  label: string;
  icon: string;
}

const CHECKLIST: CheckItem[] = [
  { id: 'fahrzeug', label: 'Fahrzeug gecheckt',       icon: '🛵' },
  { id: 'handy',    label: 'Handy geladen (>50%)',     icon: '📱' },
  { id: 'app',      label: 'App & Karte aktuell',      icon: '📍' },
  { id: 'tasche',   label: 'Liefertasche dabei',       icon: '🧺' },
];

const MOCK_SCHICHT: SchichtInfo = {
  start: new Date(Date.now() + 90 * 60_000).toISOString(),
  end:   new Date(Date.now() + 90 * 60_000 + 8 * 3_600_000).toISOString(),
  zone:  'A',
};

function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'Jetzt';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}min`;
  if (m > 0) return `${m}:${s.toString().padStart(2, '0')} Min`;
  return `${s}s`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function FahrerPhase1634NaechsteSchichtVorbereitungCard({ driverId, isOnline }: Props) {
  const [schicht, setSchicht] = useState<SchichtInfo | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!driverId) return;
    fetch(`/api/delivery/fahrer/naechste-schicht?driver_id=${driverId}`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.start) setSchicht(d);
        else setSchicht(MOCK_SCHICHT);
      })
      .catch(() => setSchicht(MOCK_SCHICHT));
  }, [driverId]);

  const countdownMs = useMemo(() => {
    if (!schicht) return 0;
    return new Date(schicht.start).getTime() - Date.now();
  }, [schicht]);

  const allChecked = useMemo(() => checked.size === CHECKLIST.length, [checked]);

  // Don't show if driver is already online (guard)
  if (isOnline) return null;
  if (!schicht) return null;

  const msUntil = new Date(schicht.start).getTime() - Date.now();
  // Only show if shift starts within 3h
  if (msUntil < 0 || msUntil > 3 * 3_600_000) return null;

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="rounded-2xl border border-blue-200 bg-white overflow-hidden shadow-sm mb-4">
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-3 ${allChecked ? 'bg-emerald-700' : 'bg-blue-700'} text-white transition-colors`}>
        <span className="text-sm font-bold uppercase tracking-wider flex-1">
          Nächste Schicht · Vorbereitung
        </span>
        <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums">
          {checked.size}/{CHECKLIST.length} ✓
        </span>
      </div>

      {/* Schicht-Info */}
      <div className="px-4 py-3 flex items-center gap-4 bg-blue-50 border-b border-blue-100">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Schichtstart</div>
          <div className="text-xl font-black tabular-nums text-blue-800">{fmtTime(schicht.start)}</div>
          <div className="text-xs text-stone-500">bis {fmtTime(schicht.end)}{schicht.zone ? ` · Zone ${schicht.zone}` : ''}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Startet in</div>
          <div className={`text-2xl font-black tabular-nums ${countdownMs < 30 * 60_000 ? 'text-amber-600' : 'text-blue-700'}`}>
            {fmtCountdown(Math.max(0, countdownMs))}
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="divide-y divide-stone-50">
        {CHECKLIST.map((item) => {
          const done = checked.has(item.id);
          return (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${done ? 'bg-emerald-50' : 'hover:bg-stone-50'}`}
            >
              <span className="text-lg shrink-0">{item.icon}</span>
              <span className={`flex-1 text-sm font-medium ${done ? 'line-through text-stone-400' : 'text-stone-800'}`}>
                {item.label}
              </span>
              <span className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-300'}`}>
                {done && <span className="text-[11px] font-black">✓</span>}
              </span>
            </button>
          );
        })}
      </div>

      {allChecked && (
        <div className="px-4 py-3 bg-emerald-50 border-t border-emerald-100 text-center">
          <span className="text-sm font-bold text-emerald-700">Alles bereit! Viel Erfolg bei der Schicht 🚀</span>
        </div>
      )}
    </div>
  );
}
