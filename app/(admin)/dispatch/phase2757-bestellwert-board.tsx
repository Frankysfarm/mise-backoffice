'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, ShoppingBag } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_bestellwert_eur: number;
  touren: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  alert: string | null;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_bestellwert_eur: number;
}

const ZIEL = 25;
const WARN = 15;
const MAX  = 50;

function calcAmpel(eur: number): 'gruen' | 'gelb' | 'rot' {
  if (eur >= ZIEL) return 'gruen';
  if (eur >= WARN) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

function TrendIcon({ trend }: { trend: string }) {
  // steigend = höherer Bestellwert = besser (grün), fallend = schlechter (rot)
  if (trend === 'steigend') return <TrendingUp   size={12} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-red-500"   />;
  return                           <Minus        size={12} className="text-gray-400"  />;
}

function BestellwertBalken({ eur, barClass }: { eur: number; barClass: string }) {
  const fill    = Math.min(100, (eur / MAX) * 100);
  const zielPct = (ZIEL / MAX) * 100;
  return (
    <div className="relative h-3 rounded-full bg-gray-200 flex-1">
      <div
        className="absolute top-0 h-full w-0.5 bg-green-500 z-10"
        style={{ left: `${zielPct}%` }}
        title={`Ziel: ≥${ZIEL}€`}
      />
      <div
        className={`absolute top-0 left-0 h-full rounded-full ${barClass}`}
        style={{ width: `${fill}%` }}
      />
    </div>
  );
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   avg_bestellwert_eur: 32.5, touren: 10, trend: 'steigend', alert: null,                   rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  avg_bestellwert_eur: 21.8, touren:  8, trend: 'fallend',  alert: null,                   rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   avg_bestellwert_eur: 18.4, touren:  6, trend: 'steigend', alert: null,                   rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', avg_bestellwert_eur: 11.2, touren:  5, trend: 'fallend',  alert: 'Niedriger Bestellwert!', rang: 4 },
  ],
  team_avg_bestellwert_eur: 20.9,
};

export function DispatchPhase2757BestellwertBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-bestellwert-tour?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  // absteigend: höchster Bestellwert (bester) oben
  const sorted    = [...data.fahrer].sort((a, b) => b.avg_bestellwert_eur - a.avg_bestellwert_eur);
  const alerts    = data.fahrer.filter((f: FahrerEntry) => f.alert !== null);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_bestellwert_eur);
  const best      = sorted[0]?.avg_bestellwert_eur ?? 0;

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <ShoppingBag size={16} className={hasAlert ? 'text-red-500' : 'text-indigo-600'} />
          <span className="font-semibold text-sm text-gray-800">Ø Bestellwert je Tour</span>
          {hasAlert && (
            <span className="inline-flex items-center gap-0.5 text-xs text-red-600 font-medium">
              <AlertTriangle size={11} /> {alerts.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Alert-Banner */}
          {alerts.map((f: FahrerEntry) => (
            <div key={f.fahrer_id} className="flex items-center gap-2 rounded-lg bg-red-100 border border-red-200 px-3 py-2 text-xs text-red-700 font-medium">
              <AlertTriangle size={13} />
              <span className="font-bold">{f.fahrer_name}</span>: {f.alert} ({f.avg_bestellwert_eur}€)
            </div>
          ))}

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-2 py-2">
              <div className="text-[10px] text-gray-500 mb-0.5">Team-Ø</div>
              <div className={`text-base font-bold ${ampelCls(teamAmpel).text}`}>{data.team_avg_bestellwert_eur}€</div>
            </div>
            <div className="rounded-lg bg-green-50 border border-green-200 px-2 py-2">
              <div className="text-[10px] text-gray-500 mb-0.5">Bester</div>
              <div className="text-base font-bold text-green-700">{best}€</div>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-2 py-2">
              <div className="text-[10px] text-gray-500 mb-0.5">Ziel</div>
              <div className="text-base font-bold text-gray-700">≥{ZIEL}€</div>
            </div>
          </div>

          {/* Fahrerliste */}
          <div className="space-y-2">
            {sorted.map((f: FahrerEntry) => {
              const a   = calcAmpel(f.avg_bestellwert_eur);
              const cls = ampelCls(a);
              return (
                <div key={f.fahrer_id} className={`rounded-lg border ${cls.bg} px-3 py-2`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${cls.dot}`} />
                      <span className="text-xs font-semibold text-gray-800">{f.fahrer_name}</span>
                      <span className="text-[10px] text-gray-400">{f.touren} Touren</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendIcon trend={f.trend} />
                      <span className={`text-sm font-bold ${cls.text}`}>{f.avg_bestellwert_eur}€</span>
                    </div>
                  </div>
                  <BestellwertBalken eur={f.avg_bestellwert_eur} barClass={cls.bar} />
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex items-center gap-3 text-[10px] text-gray-500 pt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />≥{ZIEL}€</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{WARN}–{ZIEL - 1}€</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />&lt;{WARN}€</span>
            <span className="ml-auto flex items-center gap-1 text-gray-400">Ziel ≥{ZIEL}€/Tour</span>
          </div>
        </div>
      )}
    </div>
  );
}
