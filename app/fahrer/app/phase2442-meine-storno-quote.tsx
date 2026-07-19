'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, XCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerSQ {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  gesamt_touren: number;
  stornierungen: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  vw_quote_pct: number;
}

interface ApiData {
  fahrer: FahrerSQ[];
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

function coachingTipp(f: FahrerSQ): string {
  if (f.quote_pct > 10)
    return `${f.quote_pct.toFixed(1)}% Storno-Quote — bitte Dispatcherin informieren, Ursache klären (Adressproblem? Kundenerreichbarkeit?).`;
  if (f.ampel === 'gruen' && f.trend === 'fallend')
    return `Super! ${f.quote_pct.toFixed(1)}% — deine Storno-Quote sinkt, weiter so!`;
  if (f.ampel === 'gruen')
    return `Sehr gut! ${f.quote_pct.toFixed(1)}% Storno-Quote — du lieferst zuverlässig, Kunden und Team danken dir.`;
  return `${f.quote_pct.toFixed(1)}% — Ziel ist unter 5%. Bei Problemen immer zuerst die Dispatcherin anrufen.`;
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

export function FahrerPhase2442MeineStornoQuote({ driverId, locationId, isOnline }: Props) {
  const [mein, setMein] = useState<FahrerSQ | null>(null);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId || !isOnline) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-storno-quote?location_id=${locationId}`);
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

  const maxPct = 20;
  const pct = Math.min(100, (mein.quote_pct / maxPct) * 100);
  const ziel5Pct = (5 / maxPct) * 100;
  const ziel10Pct = (10 / maxPct) * 100;

  return (
    <div className={`rounded-xl border mb-3 ${ampelBg(mein.ampel)}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <XCircle size={16} className={ampelTextColor(mein.ampel)} />
          <span className="font-semibold text-sm">
            Meine Storno-Quote — {mein.quote_pct.toFixed(1)}%
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Großer Wert */}
          <div className="text-center py-2">
            <div className={`text-4xl font-bold ${ampelTextColor(mein.ampel)}`}>
              {mein.quote_pct.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">Storno-Quote heute</div>
          </div>

          {/* Balken 0–20% mit Ziel-Linien */}
          <div className="space-y-1">
            <div className="relative h-3 rounded-full bg-gray-200">
              <div
                className={`absolute left-0 top-0 h-full rounded-full ${barColor(mein.ampel)}`}
                style={{ width: `${pct}%` }}
              />
              <div
                className="absolute top-0 h-full border-l-2 border-dashed border-gray-500"
                style={{ left: `${ziel5Pct}%` }}
                title="Ziel 5%"
              />
              <div
                className="absolute top-0 h-full border-l-2 border-dashed border-gray-700"
                style={{ left: `${ziel10Pct}%` }}
                title="Alert 10%"
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>0%</span>
              <span>Ziel 5%</span>
              <span>Alert 10%</span>
              <span>20%</span>
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-4 gap-1.5">
            <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
              <div className="text-sm font-bold">{mein.vw_quote_pct.toFixed(1)}%</div>
              <div className="text-xs text-gray-500">Vorwoche</div>
            </div>
            <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
              <div className="flex items-center justify-center gap-0.5">
                <TrendIcon trend={mein.trend} />
                <span className="text-sm font-bold">{Math.abs(mein.trend_delta).toFixed(1)}%</span>
              </div>
              <div className="text-xs text-gray-500">Trend</div>
            </div>
            <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
              <div className="text-sm font-bold text-green-700">&lt;5%</div>
              <div className="text-xs text-gray-500">Ziel</div>
            </div>
            <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
              <div className="text-sm font-bold">{teamAvg?.toFixed(1) ?? '—'}%</div>
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
