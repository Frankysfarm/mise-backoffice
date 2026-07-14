'use client';

import React, { useEffect, useState } from 'react';

interface Props {
  isOnline: boolean;
  driverId: string | null;
}

type Ampel = 'gruen' | 'gelb' | 'rot';

interface EnergyState {
  aktive_stunden: number;
  stopp_count: number;
  empfehlung: string;
  ampel: Ampel;
  pause_in_min: number | null;
}

const AMPEL_STYLE: Record<Ampel, { ring: string; badge: string; icon: string; bg: string }> = {
  gruen: { ring: 'border-emerald-400', badge: 'bg-emerald-100 text-emerald-700', icon: '⚡', bg: 'bg-emerald-50' },
  gelb:  { ring: 'border-amber-400',   badge: 'bg-amber-100 text-amber-700',     icon: '⚠️', bg: 'bg-amber-50'  },
  rot:   { ring: 'border-rose-500',    badge: 'bg-rose-100 text-rose-700',       icon: '🛑', bg: 'bg-rose-50'   },
};

const MOCK: EnergyState = {
  aktive_stunden: 3.5,
  stopp_count: 11,
  empfehlung: 'Du machst das super! Nach 5 weiteren Stopps kurze Pause empfohlen.',
  ampel: 'gruen',
  pause_in_min: null,
};

function calcEmpfehlung(stunden: number, stopps: number): EnergyState {
  let ampel: Ampel = 'gruen';
  let empfehlung = '';
  let pause_in_min: number | null = null;

  if (stunden >= 6 || stopps >= 30) {
    ampel = 'rot';
    empfehlung = 'Bitte jetzt eine Pause einlegen — du bist schon lange aktiv!';
    pause_in_min = 0;
  } else if (stunden >= 4 || stopps >= 20) {
    ampel = 'gelb';
    empfehlung = 'Nach 2–3 Stopps eine kurze Pause empfohlen.';
    pause_in_min = Math.round((20 - stopps) * 2);
  } else {
    ampel = 'gruen';
    empfehlung = 'Energie im grünen Bereich. Weiter so!';
    pause_in_min = null;
  }

  return { aktive_stunden: stunden, stopp_count: stopps, empfehlung, ampel, pause_in_min };
}

export function FahrerPhase1600SchichtEnergieCoach({ isOnline, driverId }: Props) {
  const [state, setState] = useState<EnergyState>(MOCK);
  const [open, setOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;

    async function load() {
      if (!isOnline || !driverId) return;
      try {
        const res = await fetch(`/api/delivery/fahrer/schicht-info?driver_id=${driverId}`);
        if (res.ok) {
          const json = await res.json();
          const stunden = json.aktive_stunden ?? json.shift_hours ?? MOCK.aktive_stunden;
          const stopps = json.stopp_count ?? json.stops_today ?? MOCK.stopp_count;
          setState(calcEmpfehlung(stunden, stopps));
        }
      } catch {
        // Mock-Fallback bleibt
      }
    }

    load();
    const iv = setInterval(load, 15 * 60_000);
    return () => clearInterval(iv);
  }, [isOnline, driverId, mounted]);

  if (!open || !mounted) return null;

  const style = AMPEL_STYLE[state.ampel];

  return (
    <div className={`rounded-2xl border-2 ${style.ring} ${style.bg} overflow-hidden mb-4 shadow-sm`}>
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="text-xl">{style.icon}</span>
        <span className="text-sm font-bold text-gray-800 flex-1">Energie-Coach</span>
        <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${style.badge}`}>
          {state.aktive_stunden.toFixed(1)} h · {state.stopp_count} Stopps
        </span>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
      </div>

      <div className="px-4 pb-3">
        <p className="text-sm text-gray-700 leading-snug">{state.empfehlung}</p>
        {state.pause_in_min !== null && state.pause_in_min <= 0 && (
          <div className="mt-2 rounded-xl bg-white/70 border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">
            Jetzt Pause! Mind. 10 Min. empfohlen.
          </div>
        )}
        {state.pause_in_min !== null && state.pause_in_min > 0 && (
          <div className="mt-2 rounded-xl bg-white/70 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            Pause in ca. <span className="font-bold">{state.pause_in_min} Min.</span> empfohlen.
          </div>
        )}
      </div>
    </div>
  );
}
