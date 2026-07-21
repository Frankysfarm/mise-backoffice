'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Euro } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  einkommen_heute: number;
  basis: number;
  bonus: number;
  trinkgeld: number;
  touren_heute: number;
  ampel: string;
  trend: string;
  trend_delta: number;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_durchschnitt: number;
  tagesziel: number;
  alert_count: number;
}

const TAGESZIEL = 80;
const MAX_VAL   = 150;
const ALERT_PCT = 0.5;

function calcAmpel(e: number): string {
  const pct = e / TAGESZIEL;
  if (pct >= 1.0) return 'gruen';
  if (pct >= ALERT_PCT) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={12} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-red-500"   />;
  return                           <Minus        size={12} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f4', fahrer_name: 'Lisa F.',  einkommen_heute: 110.00, basis: 70, bonus: 30, trinkgeld: 10, touren_heute: 10, ampel: 'gruen', trend: 'steigend', trend_delta:  22.0, rang: 1 },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   einkommen_heute:  95.40, basis: 60, bonus: 25, trinkgeld: 10, touren_heute:  8, ampel: 'gruen', trend: 'steigend', trend_delta:  12.5, rang: 2 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  einkommen_heute:  72.80, basis: 52, bonus: 15, trinkgeld:  6, touren_heute:  6, ampel: 'gelb',  trend: 'stabil',   trend_delta:   0.0, rang: 3 },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   einkommen_heute:  38.20, basis: 30, bonus:  5, trinkgeld:  3, touren_heute:  3, ampel: 'rot',   trend: 'fallend',  trend_delta: -15.6, rang: 4 },
  ],
  team_durchschnitt: 79.10,
  tagesziel: TAGESZIEL,
  alert_count: 1,
};

export function DispatchPhase2826EinkommensTransparenzBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-einkommens-transparenz?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const ziel      = data.tagesziel ?? TAGESZIEL;
  const sorted    = [...data.fahrer].sort((a, b) => b.einkommen_heute - a.einkommen_heute);
  const alerts    = data.fahrer.filter(f => f.einkommen_heute < ziel * ALERT_PCT);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_durchschnitt);
  const best      = sorted[0]?.einkommen_heute ?? 0;
  const { text: teamText } = ampelCls(teamAmpel);
  const zielPct   = Math.min((ziel / MAX_VAL) * 100, 100);

  return (
    <div className={`rounded-xl border p-4 mb-4 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Euro size={16} className="text-green-600" />
          <span className="font-semibold text-sm text-gray-800">Einkommens-Transparenz</span>
          {hasAlert && <AlertTriangle size={14} className="text-red-500" />}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 ${teamText}`}>
            Ø {data.team_durchschnitt.toFixed(2)} €
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Alert-Banner */}
          {hasAlert && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-2 space-y-1">
              {alerts.map(f => (
                <div key={f.fahrer_id} className="flex items-center gap-2 text-xs text-red-700">
                  <AlertTriangle size={12} />
                  <span className="font-medium">{f.fahrer_name}</span>
                  <span>— Einkommensziel gefährdet! ({f.einkommen_heute.toFixed(2)} € / Ziel {ziel} €)</span>
                </div>
              ))}
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Team-Ø',    val: `${data.team_durchschnitt.toFixed(2)} €` },
              { label: 'Bester',    val: `${best.toFixed(2)} €` },
              { label: 'Tagesziel', val: `${ziel} €` },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">{k.label}</div>
                <div className="text-sm font-semibold text-gray-800">{k.val}</div>
              </div>
            ))}
          </div>

          {/* Fahrerliste */}
          <div className="space-y-2">
            {sorted.map(f => {
              const a      = ampelCls(f.ampel || calcAmpel(f.einkommen_heute));
              const barPct  = Math.min((f.einkommen_heute / MAX_VAL) * 100, 100);
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-2 ${a.bg}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${a.dot}`} />
                      <span className="text-xs font-medium text-gray-800">{f.fahrer_name}</span>
                      <TrendIcon trend={f.trend} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{f.touren_heute} Touren</span>
                      <span className={`font-bold ${a.text}`}>{f.einkommen_heute.toFixed(2)} €</span>
                    </div>
                  </div>
                  {/* Aufschlüsselung */}
                  <div className="flex gap-2 text-[10px] text-gray-500 mb-1">
                    <span>Basis: {f.basis.toFixed(0)} €</span>
                    <span>Bonus: +{f.bonus.toFixed(0)} €</span>
                    <span>Tip: +{f.trinkgeld.toFixed(0)} €</span>
                  </div>
                  {/* Balken 0–150€ mit Ziel-Linie 80€ */}
                  <div className="relative h-2 bg-gray-200 rounded-full overflow-visible">
                    <div
                      className={`h-full rounded-full ${a.bar}`}
                      style={{ width: `${barPct}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-blue-400"
                      style={{ left: `${zielPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>0</span>
                    <span className="text-blue-500">Ziel {ziel} €</span>
                    <span>{MAX_VAL} €</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ampel-Legende */}
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> ≥{ziel} €</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> {ziel / 2}–{ziel - 1} €</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /> &lt;{ziel / 2} €</span>
          </div>
        </div>
      )}
    </div>
  );
}
