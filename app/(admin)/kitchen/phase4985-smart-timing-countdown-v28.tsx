'use client';

import { useEffect, useRef, useState } from 'react';
import { ChefHat, AlertTriangle, TrendingUp, TrendingDown, Zap, Clock, Target, CheckCircle2, Flame, Euro, BarChart2, RefreshCw } from 'lucide-react';

interface OrderCountdown {
  order_id: string;
  bestellnummer: string;
  kunde: string;
  prep_start: number;
  target_fertig_min: number;
  verbleibend_sek: number;
  komplexitaet: 'einfach' | 'mittel' | 'komplex';
  station: 'grill' | 'fritteuse' | 'kalt';
  batch_id: string | null;
  status: 'wartend' | 'kochend' | 'kritisch' | 'ueberfaellig' | 'fertig';
  fahrer_eta_min: number | null;
  kosten_eur: number;
  rentabilitaet: 'hoch' | 'mittel' | 'niedrig';
}

interface StationLast {
  name: string;
  auslastung_pct: number;
  aktive_orders: number;
  hitze: 'kalt' | 'warm' | 'heiss' | 'kritisch';
}

interface BatchGruppe {
  batch_id: string;
  orders_count: number;
  station: string;
  gesamt_kosten: number;
  effizienz_pct: number;
  fertig_in_min: number | null;
}

interface ApiResponse {
  timing_score: number;
  score_delta: number;
  aktive_orders: number;
  kritische_orders: number;
  fertige_orders: number;
  puenktlichkeit_pct: number;
  schicht_umsatz: number;
  umsatz_delta_pct: number;
  orders: OrderCountdown[];
  stationen: StationLast[];
  batches: BatchGruppe[];
  ki_empfehlung: string | null;
  alert: string | null;
}

const AMPEL: Record<string, { bg: string; border: string; text: string; label: string }> = {
  fertig:       { bg: 'bg-green-900/40',   border: 'border-green-600/50',  text: 'text-green-300',  label: 'Fertig' },
  kochend:      { bg: 'bg-blue-900/40',    border: 'border-blue-600/50',   text: 'text-blue-300',   label: 'Kochend' },
  wartend:      { bg: 'bg-slate-800/60',   border: 'border-slate-700/40',  text: 'text-slate-400',  label: 'Wartet' },
  kritisch:     { bg: 'bg-amber-900/40',   border: 'border-amber-600/50',  text: 'text-amber-300',  label: 'Kritisch' },
  ueberfaellig: { bg: 'bg-red-900/40',     border: 'border-red-600/50',    text: 'text-red-300',    label: 'Überfällig' },
};

const HITZE: Record<string, string> = {
  kalt:     'bg-blue-500',
  warm:     'bg-green-500',
  heiss:    'bg-orange-500',
  kritisch: 'bg-red-600 animate-pulse',
};

const STATION_FARBE: Record<string, string> = {
  grill:     'bg-orange-500',
  fritteuse: 'bg-yellow-500',
  kalt:      'bg-blue-500',
};

const MOCK: ApiResponse = {
  timing_score: 88,
  score_delta: 4,
  aktive_orders: 7,
  kritische_orders: 2,
  fertige_orders: 18,
  puenktlichkeit_pct: 86,
  schicht_umsatz: 1240,
  umsatz_delta_pct: 12,
  ki_empfehlung: 'Grill läuft kritisch — Batch #B2 zuerst abschließen, dann #B4 starten',
  alert: null,
  stationen: [
    { name: 'Grill',     auslastung_pct: 92, aktive_orders: 3, hitze: 'kritisch' },
    { name: 'Fritteuse', auslastung_pct: 60, aktive_orders: 2, hitze: 'warm' },
    { name: 'Kalt',      auslastung_pct: 35, aktive_orders: 1, hitze: 'kalt' },
  ],
  batches: [
    { batch_id: 'B2', orders_count: 3, station: 'Grill',     gesamt_kosten: 48.50, effizienz_pct: 94, fertig_in_min: 3 },
    { batch_id: 'B4', orders_count: 2, station: 'Fritteuse', gesamt_kosten: 22.00, effizienz_pct: 78, fertig_in_min: 8 },
  ],
  orders: [
    { order_id: 'o1', bestellnummer: '#1301', kunde: 'Herr Müller',  prep_start: Date.now() - 520000, target_fertig_min: 12, verbleibend_sek: 200,  komplexitaet: 'komplex', station: 'grill',     batch_id: 'B2', status: 'kritisch',     fahrer_eta_min: 3,  kosten_eur: 18.50, rentabilitaet: 'hoch' },
    { order_id: 'o2', bestellnummer: '#1302', kunde: 'Frau Schmidt', prep_start: Date.now() - 400000, target_fertig_min: 10, verbleibend_sek: -90,  komplexitaet: 'mittel', station: 'fritteuse', batch_id: 'B2', status: 'ueberfaellig', fahrer_eta_min: 2,  kosten_eur: 12.00, rentabilitaet: 'mittel' },
    { order_id: 'o3', bestellnummer: '#1303', kunde: 'Familie Weber',prep_start: Date.now() - 200000, target_fertig_min: 15, verbleibend_sek: 700,  komplexitaet: 'komplex', station: 'grill',     batch_id: 'B2', status: 'kochend',     fahrer_eta_min: 11, kosten_eur: 24.00, rentabilitaet: 'hoch' },
    { order_id: 'o4', bestellnummer: '#1304', kunde: 'Herr Koch',    prep_start: Date.now() - 90000,  target_fertig_min: 8,  verbleibend_sek: 390,  komplexitaet: 'einfach', station: 'kalt',      batch_id: null, status: 'kochend',     fahrer_eta_min: 6,  kosten_eur: 9.00,  rentabilitaet: 'niedrig' },
    { order_id: 'o5', bestellnummer: '#1305', kunde: 'Frau Braun',   prep_start: Date.now(),          target_fertig_min: 12, verbleibend_sek: 720,  komplexitaet: 'mittel', station: 'fritteuse', batch_id: 'B4', status: 'wartend',     fahrer_eta_min: null, kosten_eur: 14.50, rentabilitaet: 'mittel' },
    { order_id: 'o6', bestellnummer: '#1306', kunde: 'Herr Fischer', prep_start: Date.now(),          target_fertig_min: 20, verbleibend_sek: 1200, komplexitaet: 'komplex', station: 'grill',     batch_id: 'B4', status: 'wartend',     fahrer_eta_min: null, kosten_eur: 22.00, rentabilitaet: 'hoch' },
    { order_id: 'o7', bestellnummer: '#1307', kunde: 'Frau Keller',  prep_start: Date.now(),          target_fertig_min: 10, verbleibend_sek: 600,  komplexitaet: 'einfach', station: 'kalt',      batch_id: null, status: 'wartend',     fahrer_eta_min: null, kosten_eur: 8.50,  rentabilitaet: 'niedrig' },
  ],
};

function fmtSek(s: number): string {
  const abs = Math.abs(Math.round(s));
  const m = Math.floor(abs / 60);
  const sec = abs % 60;
  const prefix = s < 0 ? '+' : '';
  return `${prefix}${m}:${String(sec).padStart(2, '0')}`;
}

interface Props {
  locationId: string | null;
}

export function KitchenPhase4985SmartTimingCountdownV28({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'batches'>('orders');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/kitchen/smart-timing-v28?location_id=${locationId}`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => setTick(t => t + 1), 1000);
    pollRef.current  = setInterval(load, 15_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current)  clearInterval(pollRef.current);
    };
  }, [locationId]);

  const orders = [...data.orders].sort((a, b) => {
    const prio = { ueberfaellig: 0, kritisch: 1, kochend: 2, wartend: 3, fertig: 4 };
    return (prio[a.status] ?? 5) - (prio[b.status] ?? 5);
  });

  const ampelGlobal = data.timing_score >= 85
    ? { color: 'bg-green-500',  label: 'Optimal',   text: 'text-green-300' }
    : data.timing_score >= 70
    ? { color: 'bg-yellow-500', label: 'Gut',        text: 'text-yellow-300' }
    : data.timing_score >= 55
    ? { color: 'bg-orange-500', label: 'Kritisch',   text: 'text-orange-300' }
    : { color: 'bg-red-500',    label: 'Alarm',      text: 'text-red-300' };

  const rentabFarbe: Record<string, string> = {
    hoch:    'text-green-400',
    mittel:  'text-yellow-400',
    niedrig: 'text-slate-400',
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat size={18} className="text-indigo-400" />
          <span className="text-sm font-semibold text-slate-200">Smart Timing V28</span>
          <span className={`w-2 h-2 rounded-full ${ampelGlobal.color}`} />
          <span className={`text-xs font-medium ${ampelGlobal.text}`}>{ampelGlobal.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw size={12} className="text-slate-500 animate-spin" />}
          <span className="text-lg font-bold text-indigo-300">{data.timing_score}</span>
          {data.score_delta !== 0 && (
            <span className={`text-xs ${data.score_delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.score_delta > 0 ? '+' : ''}{data.score_delta}
            </span>
          )}
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-900/40 border border-red-600/50">
          <AlertTriangle size={14} className="text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{data.alert}</span>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { icon: <Target size={12} />,       label: 'Score',     val: `${data.timing_score}`,          color: 'text-indigo-300' },
          { icon: <Flame size={12} />,         label: 'Aktiv',     val: `${data.aktive_orders}`,         color: 'text-orange-300' },
          { icon: <AlertTriangle size={12} />, label: 'Kritisch',  val: `${data.kritische_orders}`,      color: 'text-amber-300'  },
          { icon: <CheckCircle2 size={12} />,  label: 'Fertig',    val: `${data.fertige_orders}`,        color: 'text-green-300'  },
          { icon: <Clock size={12} />,         label: 'Pünktl.',   val: `${data.puenktlichkeit_pct}%`,   color: 'text-blue-300'   },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-slate-800/60 rounded-lg p-2 text-center">
            <div className={`flex items-center justify-center gap-1 mb-1 ${kpi.color}`}>{kpi.icon}</div>
            <div className={`text-sm font-bold ${kpi.color}`}>{kpi.val}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Umsatz Strip */}
      <div className="flex items-center gap-3 bg-slate-800/40 rounded-lg px-3 py-2">
        <Euro size={14} className="text-green-400" />
        <span className="text-sm font-bold text-green-300">€{data.schicht_umsatz.toFixed(0)}</span>
        <span className="text-xs text-slate-500">Schicht-Umsatz</span>
        <span className={`ml-auto text-xs font-medium ${data.umsatz_delta_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {data.umsatz_delta_pct >= 0 ? '+' : ''}{data.umsatz_delta_pct}% vs. Vortag
        </span>
      </div>

      {/* Stationen Hitze-Map */}
      <div className="grid grid-cols-3 gap-2">
        {data.stationen.map(s => (
          <div key={s.name} className="bg-slate-800/50 rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-300">{s.name}</span>
              <span className={`w-2 h-2 rounded-full ${HITZE[s.hitze]}`} />
            </div>
            <div className="w-full bg-slate-700 rounded-full h-1.5 mb-1">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  s.auslastung_pct >= 90 ? 'bg-red-500' : s.auslastung_pct >= 70 ? 'bg-orange-500' : 'bg-green-500'
                }`}
                style={{ width: `${s.auslastung_pct}%` }}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] text-slate-400">{s.auslastung_pct}%</span>
              <span className="text-[10px] text-slate-500">{s.aktive_orders} Akt.</span>
            </div>
          </div>
        ))}
      </div>

      {/* KI Empfehlung */}
      {data.ki_empfehlung && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-indigo-900/30 border border-indigo-700/40">
          <Zap size={13} className="text-indigo-400 shrink-0 mt-0.5" />
          <span className="text-xs text-indigo-200">{data.ki_empfehlung}</span>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-2">
        {(['orders', 'batches'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === tab
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab === 'orders' ? `Bestellungen (${data.aktive_orders})` : `Batches (${data.batches.length})`}
          </button>
        ))}
      </div>

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="space-y-2">
          {orders.map(o => {
            const amp = AMPEL[o.status];
            const sek = o.verbleibend_sek - tick;
            const pct = Math.max(0, Math.min(100, ((o.target_fertig_min * 60 - sek) / (o.target_fertig_min * 60)) * 100));
            return (
              <div key={o.order_id} className={`rounded-lg border p-3 ${amp.bg} ${amp.border}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">{o.bestellnummer}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${amp.bg} ${amp.text} border ${amp.border}`}>{amp.label}</span>
                      {o.batch_id && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">B{o.batch_id}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{o.kunde}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-base font-mono font-bold ${sek < 0 ? 'text-red-400' : sek < 120 ? 'text-amber-400' : 'text-slate-200'}`}>
                      {fmtSek(sek)}
                    </div>
                    <div className={`text-[10px] font-medium ${rentabFarbe[o.rentabilitaet]}`}>
                      €{o.kosten_eur.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-700/50 rounded-full h-1 mb-2">
                  <div
                    className={`h-1 rounded-full transition-all ${
                      o.status === 'ueberfaellig' ? 'bg-red-500' :
                      o.status === 'kritisch'     ? 'bg-amber-500' :
                      o.status === 'fertig'       ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span className={`w-2 h-2 rounded-full inline-block ${STATION_FARBE[o.station]}`} />
                  <span>{o.station.charAt(0).toUpperCase() + o.station.slice(1)}</span>
                  <span className={
                    o.komplexitaet === 'komplex' ? 'text-orange-400' :
                    o.komplexitaet === 'mittel'  ? 'text-yellow-400' : 'text-slate-400'
                  }>
                    {o.komplexitaet}
                  </span>
                  {o.fahrer_eta_min !== null && (
                    <span className="ml-auto flex items-center gap-1 text-indigo-400">
                      <Zap size={10} /> Fahrer {o.fahrer_eta_min} Min
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Batches Tab */}
      {activeTab === 'batches' && (
        <div className="space-y-2">
          {data.batches.map(b => (
            <div key={b.batch_id} className="bg-slate-800/60 border border-slate-700/40 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BarChart2 size={13} className="text-indigo-400" />
                  <span className="text-sm font-bold text-slate-200">Batch #{b.batch_id}</span>
                  <span className="text-xs text-slate-500">{b.orders_count} Orders · {b.station}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-green-300">€{b.gesamt_kosten.toFixed(2)}</div>
                  {b.fertig_in_min !== null && (
                    <div className="text-[10px] text-slate-500">Fertig in {b.fertig_in_min} Min</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500">Batch-Effizienz</span>
                <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${b.effizienz_pct >= 85 ? 'bg-green-500' : b.effizienz_pct >= 65 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${b.effizienz_pct}%` }}
                  />
                </div>
                <span className={`text-xs font-medium ${b.effizienz_pct >= 85 ? 'text-green-400' : b.effizienz_pct >= 65 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {b.effizienz_pct}%
                </span>
              </div>
            </div>
          ))}
          {data.batches.length === 0 && (
            <div className="text-center text-sm text-slate-500 py-4">Keine aktiven Batches</div>
          )}
        </div>
      )}
    </div>
  );
}
