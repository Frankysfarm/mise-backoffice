'use client';

import React, { useEffect, useState } from 'react';

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface EffizienzData {
  stopps_pro_h: number;
  team_durchschnitt_ph: number;
  effizienz_rang: number;
  gesamt_fahrer: number;
  coach_tipp: string;
  gesamt_score: number;
}

const RING_SIZE = 80;
const STROKE = 8;
const R = (RING_SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

function buildMock(driverId: string): EffizienzData {
  const seed = driverId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const stopps_pro_h = 2.5 + (seed % 30) / 10;
  const team_durchschnitt_ph = 3.8;
  const gesamt_score = Math.round(Math.min(100, (stopps_pro_h / 5) * 100));
  const rang = seed % 2 === 0 ? 2 : 4;
  const tipps = [
    'Kürzere Routen durch Zonen-Priorisierung möglich.',
    'Gut! Weiter so – du bist im oberen Bereich.',
    'Pausen optimieren: 2 kurze Pausen statt einer langen.',
    'Tipp: Zuerst nächstgelegene Stopps anfahren.',
  ];
  return {
    stopps_pro_h: Math.round(stopps_pro_h * 10) / 10,
    team_durchschnitt_ph,
    effizienz_rang: rang,
    gesamt_fahrer: 6,
    coach_tipp: tipps[seed % tipps.length],
    gesamt_score,
  };
}

export function FahrerPhase1560SchichtEffizienzRing({ driverId, isOnline }: Props) {
  const [data, setData] = useState<EffizienzData | null>(null);

  useEffect(() => {
    if (!isOnline || !driverId) return;
    const load = () => {
      try {
        setData(buildMock(driverId));
      } catch {}
    };
    load();
    const iv = setInterval(load, 20 * 60_000);
    return () => clearInterval(iv);
  }, [driverId, isOnline]);

  if (!isOnline || !data) return null;

  const pct = Math.min(100, data.gesamt_score);
  const dash = (pct / 100) * CIRC;
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;
  const ringColor = pct >= 70 ? '#4ade80' : pct >= 45 ? '#fbbf24' : '#f87171';
  const vsTeam = data.stopps_pro_h - data.team_durchschnitt_ph;
  const vsLabel = vsTeam >= 0 ? `+${vsTeam.toFixed(1)} vs. Team` : `${vsTeam.toFixed(1)} vs. Team`;
  const vsColor = vsTeam >= 0 ? 'text-emerald-600' : 'text-rose-600';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-3">Schicht-Effizienz</div>
      <div className="flex items-center gap-4">
        <svg width={RING_SIZE} height={RING_SIZE} className="shrink-0">
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="#e5e7eb" strokeWidth={STROKE} />
          <circle
            cx={cx} cy={cy} r={R} fill="none"
            stroke={ringColor} strokeWidth={STROKE}
            strokeDasharray={`${dash} ${CIRC - dash}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
          <text x={cx} y={cy - 3} textAnchor="middle" fill={ringColor} fontSize={16} fontWeight={900}>{pct}</text>
          <text x={cx} y={cy + 11} textAnchor="middle" fill="#9ca3af" fontSize={9}>Pkt.</text>
        </svg>
        <div className="flex-1 space-y-2">
          <div>
            <div className="text-xl font-black text-stone-800 tabular-nums">{data.stopps_pro_h} <span className="text-sm font-normal text-stone-500">Stopps/h</span></div>
            <div className={`text-xs font-semibold ${vsColor}`}>{vsLabel}</div>
          </div>
          <div className="text-xs text-stone-500">
            Rang <span className="font-bold text-stone-700">{data.effizienz_rang}</span> von {data.gesamt_fahrer}
          </div>
          <div className="rounded-xl bg-stone-50 px-3 py-1.5 text-[11px] text-stone-600 italic">
            💡 {data.coach_tipp}
          </div>
        </div>
      </div>
    </div>
  );
}
