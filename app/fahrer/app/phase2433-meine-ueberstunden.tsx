'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerSingle {
  fahrer_id: string;
  fahrer_name: string;
  ueberstunden_h: number;
  ueberstunden_h_vw: number;
  schicht_dauer_h: number;
  soll_dauer_h: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_ueberstunden: boolean;
}

interface ApiData {
  fahrer_single: FahrerSingle;
  team_avg_ueberstunden: number;
}

function fmtH(h: number) {
  const sign = h > 0 ? '+' : '';
  return `${sign}${h.toFixed(1)}h`;
}

function ampelStyle(a: string) {
  if (a === 'gruen') return { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500' };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400' };
  return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', bar: 'bg-red-500' };
}

function coachingTipp(ampel: string): string {
  if (ampel === 'gruen') return 'Super — du liegst im Zeitplan. Weiter so!';
  if (ampel === 'gelb') return 'Leichte Überstunden. Achte auf eine pünktliche Schichtübergabe.';
  return 'Mehr als 2h Überstunden — bitte Schicht so bald wie möglich beenden und Teamleitung informieren.';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={13} className="text-red-500" />;
  if (trend === 'fallend') return <TrendingDown size={13} className="text-green-600" />;
  return <Minus size={13} className="text-gray-400" />;
}

export function FahrerPhase2433MeineUeberstunden({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!driverId || !locationId || !isOnline) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-ueberstunden?location_id=${locationId}&driver_id=${driverId}`)
        .then(r => r.json())
        .then(setData)
        .catch(console.error);
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data?.fahrer_single) return null;

  const f = data.fahrer_single;
  const style = ampelStyle(f.ampel);
  const maxH = 5;
  const barPct = Math.min(100, (Math.max(0, f.ueberstunden_h) / maxH) * 100);
  const ziel0Pct = 0;
  const ziel2Pct = (2 / maxH) * 100;

  return (
    <div className={`border rounded-xl mb-3 overflow-hidden ${style.bg}`}>
      <button
        className={`w-full flex items-center justify-between px-4 py-2 font-semibold text-sm ${style.text}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2">
          <Clock size={14} />
          Meine Überstunden
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="bg-white px-4 pb-4 pt-2 space-y-3">
          {/* Hero */}
          <div className="text-center">
            <div className={`text-4xl font-extrabold ${style.text}`}>{fmtH(f.ueberstunden_h)}</div>
            <div className="text-xs text-gray-400 mt-0.5">{f.schicht_dauer_h.toFixed(1)}h gearbeitet / {f.soll_dauer_h}h Soll</div>
          </div>

          {/* Fortschrittsbalken */}
          <div className="relative h-3 rounded-full bg-gray-200">
            <div className={`absolute left-0 top-0 h-full rounded-full ${style.bar}`} style={{ width: `${barPct}%` }} />
            <div className="absolute top-0 h-full border-l-2 border-dashed border-green-500" style={{ left: `${ziel0Pct}%` }} title="Ziel: 0h" />
            <div className="absolute top-0 h-full border-l-2 border-dashed border-amber-400" style={{ left: `${ziel2Pct}%` }} title="+2h Alert" />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0h</span>
            <span className="text-amber-500">+2h</span>
            <span>+5h</span>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-gray-400">Vorwoche</div>
              <div className="font-bold text-gray-700">{fmtH(f.ueberstunden_h_vw)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-gray-400">Trend</div>
              <div className="font-bold flex items-center justify-center gap-0.5">
                <TrendIcon trend={f.trend} />
                {f.trend_delta > 0 ? '+' : ''}{f.trend_delta.toFixed(1)}h
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-gray-400">Ziel</div>
              <div className="font-bold text-green-600">≤ 0h</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-gray-400">Team-Ø</div>
              <div className="font-bold text-gray-700">{fmtH(data.team_avg_ueberstunden)}</div>
            </div>
          </div>

          {/* Coaching */}
          <div className={`rounded-lg px-3 py-2 text-xs border ${style.bg} ${style.text}`}>
            {coachingTipp(f.ampel)}
          </div>
        </div>
      )}
    </div>
  );
}
