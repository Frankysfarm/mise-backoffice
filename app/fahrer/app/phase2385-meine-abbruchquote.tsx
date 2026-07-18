'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, XCircle } from 'lucide-react';

interface FahrerAbbruchquote {
  id: string;
  name: string;
  quote_pct: number;
  quote_pct_vw: number;
  abbrueche: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer_single: FahrerAbbruchquote;
  team_avg_pct: number;
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-50 border-green-200 text-green-800';
  if (a === 'gelb') return 'bg-yellow-50 border-yellow-200 text-yellow-800';
  return 'bg-red-50 border-red-200 text-red-700';
}

function ampelRing(a: string) {
  if (a === 'gruen') return 'text-green-600';
  if (a === 'gelb') return 'text-yellow-600';
  return 'text-red-600';
}

function ampelBar(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

function coachingTipp(f: FahrerAbbruchquote): string {
  if (f.alert) return 'Abbruchquote >10% — bitte besprechen: Probleme bei Adressen oder Kunden sofort dem Dispatcher melden.';
  if (f.ampel === 'gruen' && f.trend === 'up') return 'Perfekt! 0 Abbrüche heute — dein Einsatz macht den Unterschied.';
  if (f.ampel === 'gruen') return 'Sehr gut! Abbruchquote im grünen Bereich — weiter so!';
  if (f.ampel === 'gelb') return 'Abbruchquote im gelben Bereich — versuche unter 5% zu bleiben.';
  return 'Abbruchquote zu hoch — bei Problemen sofort den Dispatcher kontaktieren.';
}

function fmtPct(pct: number) {
  return `${pct.toFixed(1)}%`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUp size={14} className="text-green-600" />;
  if (trend === 'down') return <TrendingDown size={14} className="text-red-500" />;
  return <Minus size={14} className="text-gray-400" />;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2385MeineAbbruchquote({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!driverId || !locationId || !isOnline) return;
    try {
      const r = await fetch(
        `/api/delivery/admin/fahrer-abbruchquote?location_id=${locationId}&driver_id=${driverId}`
      );
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline) return null;

  const f = data?.fahrer_single;
  const barPct = f ? Math.min(Math.round((f.quote_pct / 20) * 100), 100) : 0;

  return (
    <div className={`rounded-xl border mb-3 ${f ? ampelBg(f.ampel) : 'border-rose-200 bg-rose-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <XCircle size={16} className={f ? ampelRing(f.ampel) : 'text-rose-600'} />
          <span className="font-semibold text-sm">
            Meine Abbruchquote {f ? `— ${fmtPct(f.quote_pct)}` : ''}
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!f ? (
            <p className="text-xs text-gray-500">Lade…</p>
          ) : (
            <>
              {/* Main value */}
              <div className="text-center py-2">
                <div className={`text-4xl font-bold ${ampelRing(f.ampel)}`}>{fmtPct(f.quote_pct)}</div>
                <div className="text-xs text-gray-500 mt-1">Abbruchquote heute</div>
              </div>

              {/* Progress bar 0–20% with goal at 5% */}
              <div className="space-y-1">
                <div className="relative h-4 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`absolute left-0 top-0 h-full rounded-full transition-all ${ampelBar(f.ampel)}`}
                    style={{ width: `${barPct}%` }}
                  />
                  <div className="absolute top-0 h-full border-l-2 border-green-700 border-dashed opacity-70" style={{ left: '25%' }} />
                  <div className="absolute top-0 h-full border-l-2 border-yellow-600 border-dashed opacity-70" style={{ left: '50%' }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0%</span>
                  <span className="text-green-600">5% Ziel</span>
                  <span className="text-yellow-600">10%</span>
                  <span>20%+</span>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
                  <div className="text-sm font-bold">{f.abbrueche}</div>
                  <div className="text-xs text-gray-500">Abbrüche</div>
                </div>
                <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
                  <div className="text-sm font-bold">{f.touren}</div>
                  <div className="text-xs text-gray-500">Touren</div>
                </div>
                <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <TrendIcon trend={f.trend} />
                    <span className="text-sm font-bold">{fmtPct(f.quote_pct_vw)}</span>
                  </div>
                  <div className="text-xs text-gray-500">Vorwoche</div>
                </div>
                <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
                  <div className="text-sm font-bold">{fmtPct(data?.team_avg_pct ?? 0)}</div>
                  <div className="text-xs text-gray-500">Team-Ø</div>
                </div>
              </div>

              {/* Coaching tip */}
              <div className="rounded-lg bg-white bg-opacity-70 border px-3 py-2">
                <p className="text-xs text-gray-700">{coachingTipp(f)}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
