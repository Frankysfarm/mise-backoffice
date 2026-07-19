'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerUE {
  fahrer_id: string;
  fahrer_name: string;
  schicht_stunden: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  vw_stunden: number;
}

interface ApiData {
  fahrer: FahrerUE[];
  team_durchschnitt: number;
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-50 border-green-200 text-green-800';
  if (a === 'gelb') return 'bg-amber-50 border-amber-200 text-amber-800';
  return 'bg-red-50 border-red-200 text-red-800';
}

function ampelTextColor(a: string) {
  if (a === 'gruen') return 'text-green-600';
  if (a === 'gelb') return 'text-amber-500';
  return 'text-red-600';
}

function barColor(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-red-500';
}

function coachingTipp(f: FahrerUE): string {
  if (f.schicht_stunden > 10)
    return `${f.schicht_stunden.toFixed(1)}h Schicht — bitte Dispatcherin informieren und eine Pause einlegen. Sicherheit geht vor!`;
  if (f.ampel === 'gelb')
    return `${f.schicht_stunden.toFixed(1)}h Schicht — du bist im gelben Bereich. Denk an regelmäßige Pausen, damit du fit bleibst.`;
  if (f.ampel === 'gruen' && f.trend === 'steigend')
    return `${f.schicht_stunden.toFixed(1)}h — gute Schichtlänge, aber die Tendenz steigt. Halte ein Auge auf deine Pausen.`;
  return `${f.schicht_stunden.toFixed(1)}h Schicht — alles im grünen Bereich, super Einsatz heute!`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={12} className="text-red-500" />;
  if (trend === 'fallend') return <TrendingDown size={12} className="text-green-600" />;
  return <Minus size={12} className="text-gray-400" />;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2447MeineUeberstunden({ driverId, locationId, isOnline }: Props) {
  const [mein, setMein] = useState<FahrerUE | null>(null);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId || !isOnline) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-ueberstunden?location_id=${locationId}`);
      if (!r.ok) return;
      const d: ApiData = await r.json();
      setTeamAvg(d.team_durchschnitt);
      const found = driverId
        ? (d.fahrer.find(f => f.fahrer_id === driverId) ?? d.fahrer[0] ?? null)
        : (d.fahrer[0] ?? null);
      setMein(found);
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !mein) return null;

  const maxH = 12;
  const pct = Math.min(100, (mein.schicht_stunden / maxH) * 100);
  const ziel8Pct = (8 / maxH) * 100;
  const ziel10Pct = (10 / maxH) * 100;

  return (
    <div className={`rounded-xl border mb-3 ${ampelBg(mein.ampel)}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className={ampelTextColor(mein.ampel)} />
          <span className="font-semibold text-sm">
            Meine Schichtdauer — {mein.schicht_stunden.toFixed(1)}h
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Großer Wert */}
          <div className="text-center py-2">
            <div className={`text-4xl font-bold ${ampelTextColor(mein.ampel)}`}>
              {mein.schicht_stunden.toFixed(1)}h
            </div>
            <div className="text-xs text-gray-500 mt-1">Schichtdauer heute</div>
          </div>

          {/* Balken 0–12h mit Ziel-Linien */}
          <div className="space-y-1">
            <div className="relative h-3 rounded-full bg-gray-200">
              <div
                className={`absolute left-0 top-0 h-full rounded-full ${barColor(mein.ampel)}`}
                style={{ width: `${pct}%` }}
              />
              <div
                className="absolute top-0 h-full border-l-2 border-dashed border-gray-500"
                style={{ left: `${ziel8Pct}%` }}
                title="Ziel 8h"
              />
              <div
                className="absolute top-0 h-full border-l-2 border-dashed border-gray-700"
                style={{ left: `${ziel10Pct}%` }}
                title="Alert 10h"
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>0h</span>
              <span>Ziel 8h</span>
              <span>Alert 10h</span>
              <span>12h</span>
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-4 gap-1.5">
            <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
              <div className="text-sm font-bold">{mein.vw_stunden.toFixed(1)}h</div>
              <div className="text-xs text-gray-500">Vorwoche</div>
            </div>
            <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
              <div className="flex items-center justify-center gap-0.5">
                <TrendIcon trend={mein.trend} />
                <span className="text-sm font-bold">{Math.abs(mein.trend_delta).toFixed(1)}h</span>
              </div>
              <div className="text-xs text-gray-500">Trend</div>
            </div>
            <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
              <div className="text-sm font-bold text-green-700">&lt;8h</div>
              <div className="text-xs text-gray-500">Ziel</div>
            </div>
            <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
              <div className="text-sm font-bold">{teamAvg?.toFixed(1) ?? '—'}h</div>
              <div className="text-xs text-gray-500">Team-Ø</div>
            </div>
          </div>

          {/* Coaching-Tipp */}
          <div className="rounded-lg bg-white bg-opacity-70 border border-current border-opacity-20 p-2">
            <p className="text-xs leading-relaxed">{coachingTipp(mein)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
