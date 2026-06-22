'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, MapPin, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  Cell,
} from 'recharts';

// ── Typen ──────────────────────────────────────────────────────────────────────

type TrendRichtung = 'up' | 'stable' | 'down';
type ZoneName = 'A' | 'B' | 'C' | 'D';

interface ZonenTagesPrognose {
  zone:               ZoneName;
  prognoseDatum:      string;
  wochentag:          number;
  wochentagLabel:     string;
  expectedOrders:     number;
  expectedRevenueEur: number;
  expectedFeeEur:     number;
  expectedMarginPct:  number | null;
  confidence:         number;
  rangeLowEur:        number;
  rangeHighEur:       number;
  basisSnapshots:     number;
  trendRichtung:      TrendRichtung;
}

interface ZonenPrognoseResult {
  locationId:             string;
  prognosen:              ZonenTagesPrognose[];
  gesamtPrognose7TageEur: number;
  topZone7Tage:           ZoneName | null;
  zoneSummen:             Record<string, number>;
  letzteAktualisierung:   string;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

function fmtTs(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

const ZONE_COLORS: Record<ZoneName, { bg: string; text: string; bar: string; border: string }> = {
  A: { bg: 'bg-matcha-50',  text: 'text-matcha-700',  bar: '#4ade80', border: 'border-matcha-200' },
  B: { bg: 'bg-sky-50',     text: 'text-sky-700',     bar: '#38bdf8', border: 'border-sky-200'    },
  C: { bg: 'bg-amber-50',   text: 'text-amber-700',   bar: '#fbbf24', border: 'border-amber-200'  },
  D: { bg: 'bg-rose-50',    text: 'text-rose-700',    bar: '#f87171', border: 'border-rose-200'   },
};

function TrendIcon({ richtung }: { richtung: TrendRichtung }) {
  if (richtung === 'up')   return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (richtung === 'down') return <TrendingDown className="h-3 w-3 text-rose-500" />;
  return <Minus className="h-3 w-3 text-stone-400" />;
}

function KonfidenzBalken({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-emerald-400' : pct >= 40 ? 'bg-amber-400' : 'bg-rose-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-stone-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-stone-400">{pct}%</span>
    </div>
  );
}

// ── Zonen-Chart ───────────────────────────────────────────────────────────────

function ZonenChart({ prognosen, zone }: { prognosen: ZonenTagesPrognose[]; zone: ZoneName }) {
  const data = prognosen
    .filter(p => p.zone === zone)
    .map(p => ({
      tag:     p.wochentagLabel,
      datum:   p.prognoseDatum,
      umsatz:  Math.round(p.expectedRevenueEur),
      gebuehr: Math.round(p.expectedFeeEur),
      orders:  Math.round(p.expectedOrders * 10) / 10,
    }));

  if (!data.length || data.every(d => d.umsatz === 0)) {
    return (
      <div className="flex items-center justify-center h-20 text-xs text-stone-400">
        Keine Datenbasis für Zone {zone}
      </div>
    );
  }

  const colors = ZONE_COLORS[zone];

  return (
    <ResponsiveContainer width="100%" height={90}>
      <BarChart data={data} barSize={18} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis dataKey="tag" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} />
        <Tooltip
          formatter={(v, name) => [
            `${Number(v ?? 0).toLocaleString('de-DE')} €`,
            name === 'umsatz' ? 'Umsatz' : 'Gebühren',
          ]}
          labelFormatter={(l) => `${l}`}
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }}
        />
        <Bar dataKey="umsatz" name="umsatz" radius={[3, 3, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? colors.bar : `${colors.bar}99`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Haupt-Panel ───────────────────────────────────────────────────────────────

export function ZonenPrognosePanel({ locationId }: { locationId: string | null }) {
  const [open, setOpen]         = useState(false);
  const [data, setData]         = useState<ZonenPrognoseResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [computing, setComputing] = useState(false);
  const [activeZone, setActiveZone] = useState<ZoneName>('A');

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/zonen-prognose?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json() as ZonenPrognoseResult;
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (open && locationId) load();
  }, [open, locationId, load]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => { void load(); }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [open, load]);

  const handleCompute = async () => {
    if (!locationId || computing) return;
    setComputing(true);
    try {
      await fetch('/api/delivery/admin/zonen-prognose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compute', location_id: locationId }),
      });
      await load();
    } finally {
      setComputing(false);
    }
  };

  const ZONES: ZoneName[] = ['A', 'B', 'C', 'D'];

  // Summe je Zone aus Prognosen
  const zoneSummen: Partial<Record<ZoneName, number>> = {};
  const zoneOrders: Partial<Record<ZoneName, number>> = {};
  const zoneTrend: Partial<Record<ZoneName, TrendRichtung>> = {};
  if (data) {
    for (const p of data.prognosen) {
      zoneSummen[p.zone] = (zoneSummen[p.zone] ?? 0) + p.expectedRevenueEur;
      zoneOrders[p.zone] = (zoneOrders[p.zone] ?? 0) + p.expectedOrders;
      zoneTrend[p.zone]  = p.trendRichtung;
    }
  }

  const hasData = data && data.prognosen.length > 0 && data.gesamtPrognose7TageEur > 0;
  const morgenPrognosen = data?.prognosen.filter(p => {
    const morgen = new Date();
    morgen.setDate(morgen.getDate() + 1);
    return p.prognoseDatum === morgen.toISOString().slice(0, 10);
  }) ?? [];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      {/* Header */}
      <button
        className="flex w-full items-center justify-between px-5 py-4"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600">
            <MapPin className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-char">Zonen-Prognose</div>
            <div className="text-xs text-stone-400">
              {data
                ? `7-Tage: ${fmtEur(data.gesamtPrognose7TageEur)} · Top: Zone ${data.topZone7Tage ?? '—'}`
                : 'Umsatz-Forecast je Lieferzone A/B/C/D'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-stone-300" />}
          {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-stone-100 px-5 pb-5 pt-4">

          {/* Leer-Zustand */}
          {!hasData && !loading && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <MapPin className="h-8 w-8 text-stone-200" />
              <div className="text-sm font-medium text-stone-500">Noch keine Prognosen vorhanden</div>
              <div className="text-xs text-stone-400 max-w-xs">
                Berechne jetzt die 7-Tage-Zone-Prognose auf Basis historischer zone_revenue_snapshots.
              </div>
              <button
                onClick={handleCompute}
                disabled={computing}
                className="mt-1 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {computing ? 'Berechne…' : 'Jetzt berechnen'}
              </button>
            </div>
          )}

          {hasData && (
            <>
              {/* KPI-Reihe */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl bg-violet-50 p-3">
                  <div className="text-base font-black tabular-nums text-violet-700">
                    {fmtEur(data!.gesamtPrognose7TageEur)}
                  </div>
                  <div className="text-[10px] font-semibold text-stone-500 mt-0.5">7-Tage Gesamt</div>
                </div>
                <div className="rounded-xl bg-stone-50 p-3">
                  <div className="text-base font-black tabular-nums text-char">
                    Zone {data!.topZone7Tage ?? '—'}
                  </div>
                  <div className="text-[10px] font-semibold text-stone-500 mt-0.5">Stärkste Zone</div>
                </div>
                <div className="rounded-xl bg-stone-50 p-3">
                  <div className="text-base font-black tabular-nums text-char">
                    {fmtEur(morgenPrognosen.reduce((s, p) => s + p.expectedRevenueEur, 0))}
                  </div>
                  <div className="text-[10px] font-semibold text-stone-500 mt-0.5">Morgen (Ges.)</div>
                </div>
              </div>

              {/* Zone-Tabs */}
              <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
                {ZONES.map(z => {
                  const colors = ZONE_COLORS[z];
                  const sum = zoneSummen[z];
                  if (sum == null) return null;
                  return (
                    <button
                      key={z}
                      onClick={() => setActiveZone(z)}
                      className={`flex-shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition-all
                        ${activeZone === z
                          ? `${colors.bg} ${colors.text} ${colors.border} ring-1 ring-offset-1 ring-violet-300`
                          : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50'}`}
                    >
                      <div>Zone {z}</div>
                      <div className="text-[10px] font-normal mt-0.5">{fmtEur(sum)}</div>
                    </button>
                  );
                })}
              </div>

              {/* Aktive Zone: Chart + Details */}
              {(() => {
                const colors = ZONE_COLORS[activeZone];
                const prognosen = data!.prognosen.filter(p => p.zone === activeZone);
                const morgenP   = morgenPrognosen.find(p => p.zone === activeZone);

                return (
                  <div className={`rounded-xl border ${colors.border} ${colors.bg} p-4`}>
                    {/* Zone-Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-black ${colors.bg} ${colors.text} border ${colors.border}`}>
                          {activeZone}
                        </div>
                        <span className={`text-sm font-bold ${colors.text}`}>Zone {activeZone} — 7-Tage Umsatz-Forecast</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendIcon richtung={zoneTrend[activeZone] ?? 'stable'} />
                        <span className="text-[10px] text-stone-500">
                          {zoneTrend[activeZone] === 'up' ? 'Steigend' : zoneTrend[activeZone] === 'down' ? 'Fallend' : 'Stabil'}
                        </span>
                      </div>
                    </div>

                    {/* Chart */}
                    <ZonenChart prognosen={data!.prognosen} zone={activeZone} />

                    {/* Morgen-Highlight */}
                    {morgenP && morgenP.expectedRevenueEur > 0 && (
                      <div className="mt-3 flex items-center justify-between rounded-lg bg-white/70 px-3 py-2">
                        <div>
                          <div className="text-[10px] text-stone-500">Morgen ({morgenP.wochentagLabel})</div>
                          <div className={`text-sm font-black tabular-nums ${colors.text}`}>
                            {fmtEur(morgenP.expectedRevenueEur)}
                          </div>
                          <div className="text-[10px] text-stone-400">
                            ~{morgenP.expectedOrders.toFixed(0)} Bestell. · Gebühren {fmtEur(morgenP.expectedFeeEur)}
                          </div>
                        </div>
                        <KonfidenzBalken value={morgenP.confidence} />
                      </div>
                    )}

                    {/* 7-Tage-Liste */}
                    <div className="mt-3 space-y-1">
                      {prognosen.map(p => (
                        <div key={p.prognoseDatum} className="flex items-center justify-between text-xs">
                          <span className="text-stone-500 w-10">{p.wochentagLabel}</span>
                          <span className="text-stone-400 w-20 text-right">
                            ~{p.expectedOrders.toFixed(0)} Best.
                          </span>
                          <span className={`font-semibold w-20 text-right ${colors.text}`}>
                            {fmtEur(p.expectedRevenueEur)}
                          </span>
                          <div className="w-20 flex justify-end">
                            <KonfidenzBalken value={p.confidence} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Footer */}
              <div className="mt-3 flex items-center justify-between text-[10px] text-stone-400">
                <span>
                  {data?.letzteAktualisierung
                    ? `Berechnet ${fmtTs(data.letzteAktualisierung)}`
                    : 'Basis: zone_revenue_snapshots'}
                </span>
                <button
                  onClick={handleCompute}
                  disabled={computing}
                  className="flex items-center gap-1 text-violet-500 hover:text-violet-700 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${computing ? 'animate-spin' : ''}`} />
                  Neu berechnen
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
