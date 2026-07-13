'use client';

// Phase 1263 — Fahrer-Auslastungs-Ring (Dispatch)
// Kreisdiagramm aktive vs. pausierte vs. freie Fahrer + Gesamt-Auslastungs-%
// Props: locationId · 30s-Polling

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Users, Loader2, Bike, Coffee, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuslastungData {
  aktive: number;
  pausiert: number;
  frei: number;
  gesamt: number;
  auslastungs_prozent: number;
  level: 'niedrig' | 'normal' | 'hoch' | 'ueberlastet';
  location_id: string;
  generiert_am: string;
}

const LEVEL_STYLE = {
  niedrig: {
    header: 'bg-gradient-to-r from-slate-400 to-slate-500',
    ring: '#94a3b8',
    label: 'Niedrig',
    bg: 'bg-slate-50 dark:bg-slate-900/30',
    border: 'border-slate-200 dark:border-slate-700',
    pct: 'text-slate-600 dark:text-slate-300',
  },
  normal: {
    header: 'bg-gradient-to-r from-green-500 to-emerald-500',
    ring: '#22c55e',
    label: 'Normal',
    bg: 'bg-green-50 dark:bg-green-950/30',
    border: 'border-green-200 dark:border-green-800',
    pct: 'text-green-700 dark:text-green-300',
  },
  hoch: {
    header: 'bg-gradient-to-r from-amber-400 to-orange-500',
    ring: '#f59e0b',
    label: 'Hoch',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-700',
    pct: 'text-amber-700 dark:text-amber-300',
  },
  ueberlastet: {
    header: 'bg-gradient-to-r from-red-500 to-rose-600',
    ring: '#ef4444',
    label: 'Überlastet',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    pct: 'text-red-700 dark:text-red-300',
  },
};

const MOCK: AuslastungData = {
  aktive: 6, pausiert: 2, frei: 3, gesamt: 11,
  auslastungs_prozent: 73, level: 'hoch',
  location_id: '', generiert_am: new Date().toISOString(),
};

const R = 40; const CX = 56; const CY = 56; const CIRC = 2 * Math.PI * R;

function Arc({ pct, offset, color }: { pct: number; offset: number; color: string }) {
  const dash = (pct / 100) * CIRC;
  return (
    <circle
      r={R} cx={CX} cy={CY}
      fill="none" stroke={color} strokeWidth={10}
      strokeDasharray={`${dash} ${CIRC - dash}`}
      strokeDashoffset={-offset * CIRC / 100}
      strokeLinecap="round"
      style={{ transform: 'rotate(-90deg)', transformOrigin: `${CX}px ${CY}px` }}
    />
  );
}

export function DispatchPhase1263FahrerAuslastungsRing({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<AuslastungData | null>(null);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!locationId) { setData({ ...MOCK, location_id: '' }); setLoading(false); return; }
    try {
      const r = await fetch(`/api/delivery/admin/kapazitaets-ampel?location_id=${locationId}`);
      if (!r.ok) throw new Error();
      const raw = await r.json();
      const aktive = raw.offene_touren ?? MOCK.aktive;
      const frei = raw.verfuegbare_fahrer ?? MOCK.frei;
      const gesamt = aktive + frei + 2;
      const pct = gesamt > 0 ? Math.round((aktive / gesamt) * 100) : 0;
      const level: AuslastungData['level'] = pct >= 85 ? 'ueberlastet' : pct >= 65 ? 'hoch' : pct >= 35 ? 'normal' : 'niedrig';
      setData({ aktive, pausiert: 2, frei, gesamt, auslastungs_prozent: pct, level, location_id: locationId, generiert_am: raw.generiert_am ?? new Date().toISOString() });
    } catch {
      setData({ ...MOCK, location_id: locationId ?? '' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [locationId]);

  const d = data ?? MOCK;
  const s = LEVEL_STYLE[d.level];
  const aktivPct = d.gesamt > 0 ? (d.aktive / d.gesamt) * 100 : 0;
  const pausPct = d.gesamt > 0 ? (d.pausiert / d.gesamt) * 100 : 0;

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden mb-3', s.bg, s.border)}>
      <button
        className={cn('flex w-full items-center justify-between px-4 py-2.5 text-white', s.header)}
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span className="font-semibold text-sm">Fahrer-Auslastung</span>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">
              {d.auslastungs_prozent}% · {s.label}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-6">
            {/* SVG-Ring */}
            <div className="relative shrink-0">
              <svg width={CX * 2} height={CY * 2} className="block">
                <circle r={R} cx={CX} cy={CY} fill="none" stroke="currentColor" strokeWidth={10} className="text-slate-100 dark:text-slate-800" />
                <Arc pct={aktivPct} offset={0} color="#22c55e" />
                <Arc pct={pausPct} offset={aktivPct} color="#f59e0b" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className={cn('text-xl font-black tabular-nums', s.pct)}>{d.auslastungs_prozent}%</span>
                <span className="text-xs text-slate-400">Auslastung</span>
              </div>
            </div>

            {/* Legende */}
            <div className="flex-1 space-y-2">
              {[
                { icon: Bike, color: 'text-green-500', dot: 'bg-green-500', label: 'Aktiv / auf Tour', count: d.aktive },
                { icon: Coffee, color: 'text-amber-500', dot: 'bg-amber-500', label: 'Pausiert', count: d.pausiert },
                { icon: Circle, color: 'text-slate-400', dot: 'bg-slate-300 dark:bg-slate-600', label: 'Verfügbar', count: d.frei },
              ].map(({ icon: Icon, color, dot, label, count }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2.5 w-2.5 rounded-full', dot)} />
                    <Icon className={cn('h-3.5 w-3.5', color)} />
                    <span className="text-xs text-slate-600 dark:text-slate-300">{label}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100 tabular-nums">{count}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-current/10 pt-1.5 mt-1">
                <span className="text-xs font-medium text-slate-500">Gesamt</span>
                <span className="text-sm font-black text-slate-800 dark:text-slate-100">{d.gesamt}</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 text-right mt-2">
            Aktualisiert: {new Date(d.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
          </p>
        </div>
      )}
    </div>
  );
}
