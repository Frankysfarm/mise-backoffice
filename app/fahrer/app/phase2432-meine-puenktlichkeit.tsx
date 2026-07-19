'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerP {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  gesamt_stopps: number;
  puenktlich: number;
  zu_spaet: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
}

interface ApiData {
  fahrer: FahrerP[];
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

function coachingTipp(f: FahrerP): string {
  if (f.quote_pct < 75) return `Nur ${f.quote_pct.toFixed(1)}% pünktlich — früher starten und Routen optimieren, um Verspätungen zu reduzieren.`;
  if (f.ampel === 'gruen' && f.trend === 'steigend') return `Exzellent! ${f.quote_pct.toFixed(1)}% und steigend — du bist ein Vorbild für das Team!`;
  if (f.ampel === 'gruen') return `Super! ${f.quote_pct.toFixed(1)}% Pünktlichkeit — Kunden und Küche schätzen deine Zuverlässigkeit.`;
  return `${f.quote_pct.toFixed(1)}% — Ziel ist ≥90%. Kürzere Wartezeiten an der Tür und direkte Routen helfen.`;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2432MeinePuenktlichkeit({ driverId, locationId, isOnline }: Props) {
  const [mein, setMein] = useState<FahrerP | null>(null);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId || !isOnline) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit?location_id=${locationId}`);
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

  return (
    <div className={`rounded-xl border mb-3 ${ampelBg(mein.ampel)}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className={ampelTextColor(mein.ampel)} />
          <span className="font-semibold text-sm">
            Meine Pünktlichkeit — {mein.quote_pct.toFixed(1)}%
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="text-center py-2">
            <p className={`text-4xl font-black ${ampelTextColor(mein.ampel)}`}>
              {mein.quote_pct.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {mein.puenktlich} von {mein.gesamt_stopps} Stopps pünktlich
            </p>
            <div className="flex items-center justify-center gap-1 mt-1">
              {mein.trend === 'steigend' ? (
                <TrendingUp size={14} className="text-green-600" />
              ) : mein.trend === 'fallend' ? (
                <TrendingDown size={14} className="text-red-500" />
              ) : (
                <Minus size={14} className="text-gray-400" />
              )}
              <span className="text-xs text-gray-600">
                {mein.trend_delta !== 0
                  ? `${mein.trend_delta > 0 ? '+' : ''}${mein.trend_delta}% ggü. VW`
                  : 'Wie Vorwoche'}
              </span>
            </div>
          </div>

          <div className="relative h-3 rounded-full bg-gray-200">
            <div
              className={`absolute left-0 top-0 h-full rounded-full ${barColor(mein.ampel)}`}
              style={{ width: `${Math.min(100, mein.quote_pct)}%` }}
            />
            <div className="absolute top-0 h-full border-l-2 border-dashed border-gray-500" style={{ left: '75%' }} title="75%" />
            <div className="absolute top-0 h-full border-l-2 border-dashed border-gray-700" style={{ left: '90%' }} title="90%" />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>0%</span><span>75%</span><span>90%</span><span>100%</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Zu spät', value: `${mein.zu_spaet}` },
              { label: 'Trend', value: mein.trend === 'steigend' ? '↑' : mein.trend === 'fallend' ? '↓' : '→' },
              { label: 'Ziel', value: '≥90%' },
              { label: 'Team-Ø', value: teamAvg !== null ? `${teamAvg.toFixed(1)}%` : '—' },
            ].map(k => (
              <div key={k.label} className="bg-white/60 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className="text-xs font-bold text-gray-800">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 bg-white/60 rounded-lg p-2">
            <Clock size={12} className={`${ampelTextColor(mein.ampel)} mt-0.5 shrink-0`} />
            <p className="text-xs text-gray-700">{coachingTipp(mein)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
