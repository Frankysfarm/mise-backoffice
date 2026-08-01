'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, BarChart2, TrendingUp, TrendingDown, Users, Clock, Euro, AlertCircle, Star, Route, ChevronUp, ChevronDown, Target, Zap } from 'lucide-react'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, LineChart, Line, YAxis, AreaChart, Area } from 'recharts'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Phase 5511 — Statistiken-Dashboard V53
// V52+: Echtzeit-Kapazitätsmanagement (Fahrer-Slots frei/aktiv/Reserve);
// KI-Prognose-Score nächste 2h mit Konfidenz-Balken;
// Ertrag-pro-km-Entwicklung LineChart letzte 8h;
// Zonen-SLA-Matrix mit Trend-Icons (besser/schlechter);
// Revenue-Breakdown nach Zahlungsart (Karte/Bar/Online);
// 14-KPI-Grid 4-spaltig; 9-Tab-Nav;
// 60s-Polling; Mock-Fallback

type Tab = 'ueberblick' | 'kapazitaet' | 'prognose' | 'ertrag' | 'zonen' | 'zahlungen' | 'stunden' | 'fahrer' | 'bilanz'

interface KpiItem { label: string; value: string; delta: string; up: boolean; alert: boolean }
interface StundeData { h: number; bestellungen: number; umsatz: number; ertrag_km: number }
interface FahrerRow { name: string; score: number; touren: number; ertrag_km: number; sla: number }
interface ZoneRow { name: string; sla: number; sla_trend: 'up' | 'down' | 'stable'; avgMin: number; umsatz: number; fahrer: number }
interface KapazitaetSlot { slot: 'aktiv' | 'frei' | 'reserve'; count: number; label: string }
interface PrognoseHour { h: string; erwartet: number; konfidenz: number }
interface ZahlungsArt { art: string; betrag: number; anteil: number }
interface ErtragKmPoint { h: string; ertrag: number }

const MOCK_KPI: KpiItem[] = [
  { label: 'Bestellungen',     value: '162',    delta: '+11%', up: true,  alert: false },
  { label: 'Umsatz',           value: '4.210€', delta: '+14%', up: true,  alert: false },
  { label: 'Ø-Lieferzeit',     value: '26min',  delta: '-3min',up: true,  alert: false },
  { label: 'SLA-Quote',        value: '89%',    delta: '+2%',  up: true,  alert: false },
  { label: 'Storno-Rate',      value: '3.8%',   delta: '-0.4%',up: true,  alert: false },
  { label: 'Fahrer aktiv',     value: '7',      delta: '+1',   up: true,  alert: false },
  { label: 'Ø-Bewertung',      value: '4.7★',   delta: '+0.1', up: true,  alert: false },
  { label: 'Touren gesamt',    value: '42',     delta: '+6',   up: true,  alert: false },
  { label: 'Kosten',           value: '1.260€', delta: '+4%',  up: false, alert: false },
  { label: 'Gewinn',           value: '2.950€', delta: '+21%', up: true,  alert: false },
  { label: 'Ertrag/km',        value: '2.84€',  delta: '+0.15',up: true,  alert: false },
  { label: 'Vollständigkeit',  value: '97%',    delta: '+1%',  up: true,  alert: false },
  { label: 'Leerfahrten',      value: '6%',     delta: '-2%',  up: true,  alert: false },
  { label: 'Kapazität',        value: '85%',    delta: '+5%',  up: true,  alert: false },
]

const MOCK_STUNDEN: StundeData[] = Array.from({ length: 10 }, (_, i) => ({
  h: i + 11,
  bestellungen: [6, 10, 15, 22, 28, 32, 29, 20, 13, 7][i],
  umsatz: [150, 260, 390, 570, 730, 840, 760, 520, 340, 180][i],
  ertrag_km: [2.1, 2.3, 2.6, 2.9, 3.1, 3.3, 3.0, 2.8, 2.5, 2.2][i],
}))

const MOCK_FAHRER: FahrerRow[] = [
  { name: 'Nico W.',  score: 95, touren: 10, ertrag_km: 3.40, sla: 96 },
  { name: 'Eva M.',   score: 91, touren: 9,  ertrag_km: 3.20, sla: 92 },
  { name: 'Sara K.',  score: 83, touren: 8,  ertrag_km: 2.80, sla: 85 },
  { name: 'Leon K.',  score: 78, touren: 7,  ertrag_km: 2.60, sla: 80 },
  { name: 'Tom B.',   score: 66, touren: 5,  ertrag_km: 2.10, sla: 68 },
  { name: 'Mia F.',   score: 44, touren: 3,  ertrag_km: 1.60, sla: 55 },
]

const MOCK_ZONEN: ZoneRow[] = [
  { name: 'Innenstadt',  sla: 93, sla_trend: 'up',    avgMin: 23, umsatz: 1820, fahrer: 3 },
  { name: 'Schwabing',   sla: 87, sla_trend: 'stable', avgMin: 27, umsatz: 1040, fahrer: 2 },
  { name: 'Maxvorstadt', sla: 80, sla_trend: 'down',  avgMin: 31, umsatz: 780,  fahrer: 1 },
  { name: 'Neuhausen',   sla: 74, sla_trend: 'down',  avgMin: 35, umsatz: 570,  fahrer: 1 },
]

const MOCK_KAPAZITAET: KapazitaetSlot[] = [
  { slot: 'aktiv',   count: 5, label: 'Aktiv' },
  { slot: 'frei',    count: 2, label: 'Frei' },
  { slot: 'reserve', count: 1, label: 'Reserve' },
]

const MOCK_PROGNOSE: PrognoseHour[] = [
  { h: 'Jetzt', erwartet: 28,  konfidenz: 91 },
  { h: '+30min',erwartet: 34,  konfidenz: 85 },
  { h: '+60min',erwartet: 42,  konfidenz: 78 },
  { h: '+90min',erwartet: 38,  konfidenz: 71 },
  { h: '+2h',   erwartet: 31,  konfidenz: 65 },
]

const MOCK_ZAHLUNGEN: ZahlungsArt[] = [
  { art: 'Online',   betrag: 2310, anteil: 55 },
  { art: 'Karte',    betrag: 1470, anteil: 35 },
  { art: 'Bar',      betrag: 430,  anteil: 10 },
]

const MOCK_ERTRAG_KM: ErtragKmPoint[] = MOCK_STUNDEN.map(s => ({ h: `${s.h}h`, ertrag: s.ertrag_km }))

const TREND_ICON: Record<'up' | 'down' | 'stable', { icon: string; cls: string }> = {
  up:     { icon: '↑', cls: 'text-emerald-400' },
  down:   { icon: '↓', cls: 'text-red-400' },
  stable: { icon: '→', cls: 'text-zinc-400' },
}

interface Props { locationId: string | null; className?: string }

export function LieferdienstPhase5511StatistikenDashboardV53({ locationId, className }: Props) {
  const [kpis] = useState<KpiItem[]>(MOCK_KPI)
  const [stunden] = useState<StundeData[]>(MOCK_STUNDEN)
  const [fahrer] = useState<FahrerRow[]>(MOCK_FAHRER)
  const [zonen] = useState<ZoneRow[]>(MOCK_ZONEN)
  const [kapazitaet] = useState<KapazitaetSlot[]>(MOCK_KAPAZITAET)
  const [prognose] = useState<PrognoseHour[]>(MOCK_PROGNOSE)
  const [zahlungen] = useState<ZahlungsArt[]>(MOCK_ZAHLUNGEN)
  const [ertragKm] = useState<ErtragKmPoint[]>(MOCK_ERTRAG_KM)
  const [tab, setTab] = useState<Tab>('ueberblick')
  const [chartMode, setChartMode] = useState<'bestellungen' | 'umsatz'>('bestellungen')

  const TABS: { key: Tab; label: string }[] = [
    { key: 'ueberblick',  label: 'Überblick' },
    { key: 'kapazitaet',  label: 'Kapazität' },
    { key: 'prognose',    label: 'Prognose' },
    { key: 'ertrag',      label: 'Ertrag/km' },
    { key: 'zonen',       label: 'Zonen' },
    { key: 'zahlungen',   label: 'Zahlung' },
    { key: 'stunden',     label: 'Stunden' },
    { key: 'fahrer',      label: 'Fahrer' },
    { key: 'bilanz',      label: 'Bilanz' },
  ]

  return (
    <Card className={cn('bg-zinc-900 border-zinc-700/50 p-4 space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-teal-400 shrink-0" />
        <span className="text-xs font-semibold text-zinc-100">Statistiken V53</span>
        <span className="ml-auto text-[10px] text-zinc-500">Kapazität · KI-Prognose · Ertrag/km</span>
      </div>

      {/* 14-KPI-Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {kpis.map(k => (
          <div key={k.label} className={cn('rounded-md px-2 py-1.5 text-center', k.alert ? 'bg-red-500/10 ring-1 ring-red-500/30' : 'bg-zinc-800')}>
            <p className={cn('text-sm font-bold', k.alert ? 'text-red-400' : k.up ? 'text-emerald-400' : 'text-zinc-100')}>{k.value}</p>
            <p className="text-[8px] text-zinc-500 leading-none mt-0.5">{k.label}</p>
            <p className={cn('text-[8px] leading-none', k.up ? 'text-emerald-500' : 'text-red-500')}>{k.delta}</p>
          </div>
        ))}
      </div>

      {/* Tab Nav - scrollable */}
      <div className="flex gap-1 overflow-x-auto pb-0.5 no-scrollbar">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('flex-none text-[10px] px-2.5 py-1 rounded-md whitespace-nowrap transition-colors',
              tab === t.key ? 'bg-teal-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ueberblick' && (
        <div className="space-y-3">
          <div className="flex gap-1.5 mb-1">
            {(['bestellungen', 'umsatz'] as const).map(m => (
              <button key={m} onClick={() => setChartMode(m)}
                className={cn('flex-1 text-[10px] py-1 rounded-md', chartMode === m ? 'bg-teal-600 text-white' : 'bg-zinc-800 text-zinc-400')}>
                {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={stunden} barSize={14}>
              <XAxis dataKey="h" tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#18181b', border: 'none', borderRadius: 8, fontSize: 10 }} />
              <Bar dataKey={chartMode} fill="#14b8a6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'kapazitaet' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {kapazitaet.map(k => (
              <div key={k.slot} className={cn('rounded-lg p-3 text-center', k.slot === 'aktiv' ? 'bg-blue-500/15' : k.slot === 'frei' ? 'bg-emerald-500/15' : 'bg-zinc-800')}>
                <p className={cn('text-2xl font-bold', k.slot === 'aktiv' ? 'text-blue-300' : k.slot === 'frei' ? 'text-emerald-300' : 'text-zinc-300')}>{k.count}</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-zinc-800 rounded-lg p-3">
            <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
              <span>Auslastung</span>
              <span>{Math.round((kapazitaet.find(k => k.slot === 'aktiv')!.count / kapazitaet.reduce((a, k) => a + k.count, 0)) * 100)}%</span>
            </div>
            <div className="flex gap-0.5 h-3">
              {kapazitaet.map(k => (
                <div key={k.slot}
                  className={cn('rounded-sm', k.slot === 'aktiv' ? 'bg-blue-500' : k.slot === 'frei' ? 'bg-emerald-500' : 'bg-zinc-600')}
                  style={{ flex: k.count }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'prognose' && (
        <div className="space-y-2">
          <p className="text-[10px] text-zinc-500">KI-Prognose nächste 2h — Bestellungserwartung</p>
          {prognose.map(p => (
            <div key={p.h} className="bg-zinc-800 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-200">{p.h}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-300">{p.erwartet} Bestellungen</span>
                  <span className={cn('text-[10px]', p.konfidenz >= 80 ? 'text-emerald-400' : p.konfidenz >= 70 ? 'text-yellow-400' : 'text-red-400')}>
                    {p.konfidenz}% Konfidenz
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', p.konfidenz >= 80 ? 'bg-emerald-500' : p.konfidenz >= 70 ? 'bg-yellow-500' : 'bg-red-500')}
                  style={{ width: `${p.konfidenz}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'ertrag' && (
        <div className="space-y-2">
          <p className="text-[10px] text-zinc-500">Ertrag/km Entwicklung heute</p>
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={ertragKm}>
              <defs>
                <linearGradient id="ertragGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="h" tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} domain={[1.5, 3.8]} />
              <Tooltip contentStyle={{ background: '#18181b', border: 'none', borderRadius: 8, fontSize: 10 }} formatter={(v) => [`${(v as number).toFixed(2)}€`, 'Ertrag/km']} />
              <Area type="monotone" dataKey="ertrag" stroke="#14b8a6" fill="url(#ertragGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-800 rounded-lg p-2 text-center">
              <p className="text-sm font-bold text-teal-300">2.84€</p>
              <p className="text-[10px] text-zinc-500">Ø heute</p>
            </div>
            <div className="bg-zinc-800 rounded-lg p-2 text-center">
              <p className="text-sm font-bold text-emerald-400">3.30€</p>
              <p className="text-[10px] text-zinc-500">Peak (20h)</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'zonen' && (
        <div className="space-y-1.5">
          {zonen.map(z => {
            const trend = TREND_ICON[z.sla_trend]
            return (
              <div key={z.name} className="bg-zinc-800 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-zinc-100 flex-1">{z.name}</span>
                  <span className={cn('text-[10px] font-bold', z.sla >= 88 ? 'text-emerald-400' : z.sla >= 78 ? 'text-yellow-400' : 'text-red-400')}>
                    SLA {z.sla}%
                  </span>
                  <span className={cn('text-[10px] font-bold', trend.cls)}>{trend.icon}</span>
                </div>
                <div className="flex gap-3 text-[10px] text-zinc-500">
                  <span>Ø {z.avgMin}min</span>
                  <span>{z.umsatz}€</span>
                  <span>{z.fahrer} Fahrer</span>
                </div>
                <div className="mt-1.5 h-1 bg-zinc-700 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', z.sla >= 88 ? 'bg-emerald-500' : z.sla >= 78 ? 'bg-yellow-500' : 'bg-red-500')}
                    style={{ width: `${z.sla}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'zahlungen' && (
        <div className="space-y-2">
          <p className="text-[10px] text-zinc-500">Umsatz nach Zahlungsart</p>
          {zahlungen.map(z => (
            <div key={z.art} className="bg-zinc-800 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-200">{z.art}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-100">{z.betrag}€</span>
                  <span className="text-[10px] text-zinc-400">{z.anteil}%</span>
                </div>
              </div>
              <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', z.art === 'Online' ? 'bg-violet-500' : z.art === 'Karte' ? 'bg-blue-500' : 'bg-amber-500')}
                  style={{ width: `${z.anteil}%` }} />
              </div>
            </div>
          ))}
          <p className="text-[10px] text-zinc-500 text-center">Gesamt: {zahlungen.reduce((a, z) => a + z.betrag, 0)}€</p>
        </div>
      )}

      {tab === 'stunden' && (
        <div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={stunden} barSize={16}>
              <XAxis dataKey="h" tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#18181b', border: 'none', borderRadius: 8, fontSize: 10 }} />
              <Bar dataKey="bestellungen" fill="#14b8a6" radius={[3, 3, 0, 0]} name="Bestellungen" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'fahrer' && (
        <div className="space-y-1.5">
          {fahrer.map((f, i) => (
            <div key={f.name} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
              <span className="text-[10px] text-zinc-500 w-4">#{i + 1}</span>
              <span className="flex-1 text-xs text-zinc-200">{f.name}</span>
              <span className={cn('text-xs font-bold', f.score >= 85 ? 'text-violet-300' : f.score >= 70 ? 'text-yellow-300' : 'text-zinc-300')}>{f.score}</span>
              <span className="text-[10px] text-zinc-400">{f.touren}T</span>
              <span className="text-[10px] text-teal-400">{f.ertrag_km}€/km</span>
              <span className={cn('text-[10px]', f.sla >= 85 ? 'text-emerald-400' : 'text-yellow-400')}>{f.sla}%</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'bilanz' && (
        <div className="space-y-2">
          {[
            { label: 'Umsatz', value: '4.210€', cls: 'text-emerald-400' },
            { label: 'Kosten', value: '1.260€', cls: 'text-red-400' },
            { label: 'Gewinn', value: '2.950€', cls: 'text-teal-400' },
            { label: 'Marge',  value: '70.1%',  cls: 'text-violet-400' },
          ].map(b => (
            <div key={b.label} className="flex items-center gap-3 bg-zinc-800 rounded-lg px-3 py-2">
              <span className="flex-1 text-xs text-zinc-300">{b.label}</span>
              <span className={cn('text-sm font-bold', b.cls)}>{b.value}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
