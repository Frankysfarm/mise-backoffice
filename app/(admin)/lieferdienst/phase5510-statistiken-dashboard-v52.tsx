'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, BarChart2, TrendingUp, TrendingDown, Users, Clock, Euro, AlertCircle, Star, Route, ChevronUp, ChevronDown } from 'lucide-react'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, LineChart, Line, YAxis } from 'recharts'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Phase 5510 — Statistiken-Dashboard V52
// V51+: Wochentag-Muster-Heatmap (Bestellungen je Tag×Stunde);
// Fahrer-Kohortenanalyse (Einsteiger/Erfahren/Veteran) inkl. Retention-Rate;
// Storno-Ursachen-Breakdown Tortendiagramm als Balken;
// Revenue-Trend-SparkLine + Alert-Strip + 13-KPI-Grid;
// 8-Tab-Nav Überblick/Wochenmuster/Storno/Kohorten/Stunden/Fahrer/Zonen/Bilanz;
// 60-Sek-Polling; Mock-Fallback

type Tab = 'ueberblick' | 'wochenmuster' | 'storno' | 'kohorten' | 'stunden' | 'fahrer' | 'zonen' | 'bilanz'

interface KpiItem { label: string; value: string; delta: string; up: boolean; alert: boolean }
interface StundeData { h: number; bestellungen: number; umsatz: number }
interface FahrerRow { name: string; kohorte: 'einsteiger' | 'erfahren' | 'veteran'; score: number; pünktlichkeit: number; touren: number; retention: number }
interface ZoneRow { name: string; sla: number; avgMin: number; umsatz: number; fahrer: number }
interface StornoGrund { grund: string; anzahl: number; pct: number }
interface WochentegStunde { tag: string; stunde: number; bestellungen: number }

const MOCK_KPI: KpiItem[] = [
  { label: 'Bestellungen',    value: '147',    delta: '+8%',  up: true,  alert: false },
  { label: 'Umsatz',          value: '3.842€', delta: '+12%', up: true,  alert: false },
  { label: 'Ø-Lieferzeit',    value: '28min',  delta: '-2min',up: true,  alert: false },
  { label: 'SLA-Quote',       value: '87%',    delta: '-3%',  up: false, alert: true  },
  { label: 'Storno-Rate',     value: '4.2%',   delta: '+1%',  up: false, alert: true  },
  { label: 'Fahrer aktiv',    value: '6',      delta: '0',    up: true,  alert: false },
  { label: 'Ø-Bewertung',     value: '4.6★',   delta: '+0.1', up: true,  alert: false },
  { label: 'Touren gesamt',   value: '38',     delta: '+4',   up: true,  alert: false },
  { label: 'Kosten',          value: '1.140€', delta: '+5%',  up: false, alert: false },
  { label: 'Gewinn',          value: '2.702€', delta: '+17%', up: true,  alert: false },
  { label: 'Effizienz-Ratio', value: '3.37',   delta: '+0.3', up: true,  alert: false },
  { label: 'Vollständigkeit', value: '96%',    delta: '+1%',  up: true,  alert: false },
  { label: 'Leerfahrten',     value: '8%',     delta: '-2%',  up: true,  alert: false },
]

const MOCK_STUNDEN: StundeData[] = Array.from({ length: 12 }, (_, i) => ({
  h: i + 10,
  bestellungen: [5, 8, 12, 18, 22, 28, 31, 26, 19, 14, 9, 4][i],
  umsatz: [120, 200, 310, 470, 580, 730, 810, 680, 490, 360, 230, 100][i],
}))

const MOCK_FAHRER: FahrerRow[] = [
  { name: 'Nico W.',  kohorte: 'veteran',    score: 95, pünktlichkeit: 94, touren: 9, retention: 98 },
  { name: 'Sara K.',  kohorte: 'erfahren',   score: 83, pünktlichkeit: 81, touren: 7, retention: 88 },
  { name: 'Tom B.',   kohorte: 'einsteiger', score: 66, pünktlichkeit: 60, touren: 5, retention: 72 },
  { name: 'Mia F.',   kohorte: 'einsteiger', score: 44, pünktlichkeit: 38, touren: 3, retention: 55 },
  { name: 'Leon K.',  kohorte: 'erfahren',   score: 78, pünktlichkeit: 76, touren: 8, retention: 83 },
  { name: 'Eva M.',   kohorte: 'veteran',    score: 91, pünktlichkeit: 90, touren: 10, retention: 96 },
]

const MOCK_ZONEN: ZoneRow[] = [
  { name: 'Innenstadt', sla: 91, avgMin: 24, umsatz: 1620, fahrer: 3 },
  { name: 'Schwabing',  sla: 85, avgMin: 29, umsatz: 980,  fahrer: 2 },
  { name: 'Maxvorstadt',sla: 78, avgMin: 33, umsatz: 740,  fahrer: 1 },
  { name: 'Haidhausen', sla: 82, avgMin: 31, umsatz: 502,  fahrer: 1 },
]

const MOCK_STORNO: StornoGrund[] = [
  { grund: 'Zu lange Wartezeit', anzahl: 18, pct: 43 },
  { grund: 'Falsche Bestellung', anzahl: 11, pct: 26 },
  { grund: 'Adresse nicht gefunden', anzahl: 7, pct: 17 },
  { grund: 'Fahrer nicht erreichbar', anzahl: 4, pct: 10 },
  { grund: 'Sonstiges', anzahl: 2, pct: 4 },
]

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const MOCK_WOCHE: WochentegStunde[] = WOCHENTAGE.flatMap(tag =>
  Array.from({ length: 8 }, (_, i) => ({
    tag, stunde: i + 11,
    bestellungen: Math.round(Math.random() * 20 + (tag === 'Sa' || tag === 'So' ? 10 : 0)),
  }))
)

const REVENUE_TREND = Array.from({ length: 7 }, (_, i) => ({ tag: `T-${6 - i}`, umsatz: 2800 + i * 180 + Math.round(Math.random() * 200) }))

const KOHORTE_CONFIG: Record<FahrerRow['kohorte'], { label: string; color: string; bg: string }> = {
  einsteiger: { label: 'Einsteiger', color: 'text-sky-300',    bg: 'bg-sky-500/10' },
  erfahren:   { label: 'Erfahren',   color: 'text-amber-300',  bg: 'bg-amber-500/10' },
  veteran:    { label: 'Veteran',    color: 'text-violet-300', bg: 'bg-violet-500/10' },
}

interface Props { locationId?: string | null; className?: string }

export function LieferdienstPhase5510StatistikenDashboardV52({ locationId, className }: Props) {
  const [tab, setTab] = useState<Tab>('ueberblick')
  const [stundeMode, setStu] = useState<'bestellungen' | 'umsatz'>('bestellungen')

  const TABS: { key: Tab; label: string }[] = [
    { key: 'ueberblick',  label: 'Überblick' },
    { key: 'wochenmuster',label: 'Woche' },
    { key: 'storno',      label: 'Storno' },
    { key: 'kohorten',    label: 'Kohorten' },
    { key: 'stunden',     label: 'Stunden' },
    { key: 'fahrer',      label: 'Fahrer' },
    { key: 'zonen',       label: 'Zonen' },
    { key: 'bilanz',      label: 'Bilanz' },
  ]

  const alerts = MOCK_KPI.filter(k => k.alert)

  return (
    <Card className={cn('bg-zinc-900 text-white border-zinc-800 p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-teal-400" />
          <span className="font-semibold text-sm">Statistiken-Dashboard V52</span>
        </div>
        <span className="text-xs text-zinc-500">60s-Polling</span>
      </div>

      {/* Alert-Strip */}
      {alerts.length > 0 && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">
            {alerts.map(a => `${a.label} ${a.value}`).join(' · ')}
          </span>
        </div>
      )}

      {/* Revenue Sparkline */}
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={REVENUE_TREND} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
            <Line type="monotone" dataKey="umsatz" stroke="#14b8a6" strokeWidth={2} dot={false} />
            <Tooltip contentStyle={{ background: '#18181b', border: 'none', fontSize: 11 }} formatter={(v) => [`${(v as number)}€`, 'Umsatz']} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tab-Nav */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('shrink-0 text-xs px-3 py-1.5 rounded-lg transition-colors',
              tab === t.key ? 'bg-teal-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Überblick */}
      {tab === 'ueberblick' && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {MOCK_KPI.map(kpi => (
            <div key={kpi.label}
              className={cn('bg-zinc-800 rounded-lg p-3', kpi.alert && 'ring-1 ring-red-500/50')}>
              <div className="text-xs text-zinc-500 mb-1">{kpi.label}</div>
              <div className={cn('text-lg font-bold', kpi.alert ? 'text-red-300' : 'text-white')}>{kpi.value}</div>
              <div className={cn('text-xs flex items-center gap-0.5 mt-0.5', kpi.up ? 'text-emerald-400' : 'text-red-400')}>
                {kpi.up ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {kpi.delta}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Wochenmuster-Heatmap */}
      {tab === 'wochenmuster' && (
        <div className="overflow-x-auto">
          <div className="min-w-[420px]">
            <div className="grid grid-cols-[40px_repeat(8,1fr)] gap-0.5 mb-1">
              <div />
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="text-center text-xs text-zinc-500">{i + 11}h</div>
              ))}
            </div>
            {WOCHENTAGE.map(tag => {
              const stunden = MOCK_WOCHE.filter(w => w.tag === tag)
              const maxB = Math.max(...stunden.map(s => s.bestellungen))
              return (
                <div key={tag} className="grid grid-cols-[40px_repeat(8,1fr)] gap-0.5 mb-0.5">
                  <div className="text-xs text-zinc-400 flex items-center">{tag}</div>
                  {stunden.map(s => {
                    const intensity = s.bestellungen / Math.max(1, maxB)
                    const bg = intensity > 0.75 ? 'bg-teal-500' : intensity > 0.5 ? 'bg-teal-500/60' : intensity > 0.25 ? 'bg-teal-500/30' : 'bg-zinc-800'
                    return (
                      <div key={s.stunde}
                        className={cn('h-7 rounded text-center text-xs flex items-center justify-center', bg)}
                        title={`${tag} ${s.stunde}h: ${s.bestellungen} Bestellungen`}>
                        <span className="text-zinc-200 text-xs">{s.bestellungen > 0 ? s.bestellungen : ''}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
            <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-teal-500" /> Hoch
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-teal-500/30" /> Mittel
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-zinc-800" /> Gering
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Storno-Breakdown */}
      {tab === 'storno' && (
        <div className="space-y-3">
          <div className="text-xs text-zinc-400">Gesamt {MOCK_STORNO.reduce((a, b) => a + b.anzahl, 0)} Stornierungen diese Schicht</div>
          {MOCK_STORNO.map(s => (
            <div key={s.grund} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">{s.grund}</span>
                <span className="text-zinc-400">{s.anzahl} ({s.pct}%)</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-red-500/70 transition-all" style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Kohorten */}
      {tab === 'kohorten' && (
        <div className="space-y-3">
          {(['veteran', 'erfahren', 'einsteiger'] as FahrerRow['kohorte'][]).map(k => {
            const grp = MOCK_FAHRER.filter(f => f.kohorte === k)
            const cfg = KOHORTE_CONFIG[k]
            const avgScore = Math.round(grp.reduce((a, f) => a + f.score, 0) / Math.max(1, grp.length))
            const avgRet = Math.round(grp.reduce((a, f) => a + f.retention, 0) / Math.max(1, grp.length))
            return (
              <div key={k} className={cn('rounded-lg p-3', cfg.bg)}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className={cn('font-semibold text-sm', cfg.color)}>{cfg.label}</span>
                    <span className="text-xs text-zinc-500 ml-2">{grp.length} Fahrer</span>
                  </div>
                  <div className="text-right">
                    <div className={cn('text-sm font-bold', cfg.color)}>Score Ø {avgScore}</div>
                    <div className="text-xs text-zinc-500">Retention {avgRet}%</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {grp.map(f => (
                    <span key={f.name} className={cn('text-xs px-2 py-0.5 rounded-full', cfg.bg, cfg.color, 'ring-1 ring-current/20')}>
                      {f.name} {f.score}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Stunden */}
      {tab === 'stunden' && (
        <div className="space-y-3">
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz'] as const).map(m => (
              <button key={m} onClick={() => setStu(m)}
                className={cn('flex-1 text-xs py-1 rounded transition-colors',
                  stundeMode === m ? 'bg-teal-600 text-white' : 'bg-zinc-800 text-zinc-400')}>
                {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
              </button>
            ))}
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOCK_STUNDEN} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <XAxis dataKey="h" tick={{ fontSize: 10, fill: '#71717a' }} tickFormatter={v => `${v}h`} />
                <YAxis tick={{ fontSize: 10, fill: '#71717a' }} />
                <Tooltip contentStyle={{ background: '#18181b', border: 'none', fontSize: 11 }}
                  formatter={(v) => [stundeMode === 'umsatz' ? `${(v as number)}€` : `${(v as number)}`, stundeMode === 'bestellungen' ? 'Bestellungen' : 'Umsatz']} />
                <Bar dataKey={stundeMode} fill="#14b8a6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Fahrer */}
      {tab === 'fahrer' && (
        <div className="space-y-2">
          {MOCK_FAHRER.sort((a, b) => b.score - a.score).map((f, i) => {
            const cfg = KOHORTE_CONFIG[f.kohorte]
            return (
              <div key={f.name} className="flex items-center gap-3 bg-zinc-800 rounded-lg p-3">
                <span className="text-xs text-zinc-500 w-4">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{f.name}</span>
                    <span className={cn('text-xs px-1.5 py-0.5 rounded', cfg.bg, cfg.color)}>{cfg.label}</span>
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-zinc-500">
                    <span>Pünktl. {f.pünktlichkeit}%</span>
                    <span>Touren {f.touren}</span>
                    <span>Ret. {f.retention}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn('font-bold text-lg', f.score >= 85 ? 'text-violet-300' : f.score >= 70 ? 'text-yellow-300' : f.score >= 55 ? 'text-emerald-300' : 'text-red-300')}>
                    {f.score}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Zonen */}
      {tab === 'zonen' && (
        <div className="space-y-2">
          {MOCK_ZONEN.sort((a, b) => b.sla - a.sla).map(z => {
            const slaCol = z.sla >= 90 ? 'bg-emerald-500' : z.sla >= 80 ? 'bg-yellow-400' : 'bg-red-500'
            const slaText = z.sla >= 90 ? 'text-emerald-300' : z.sla >= 80 ? 'text-yellow-300' : 'text-red-300'
            return (
              <div key={z.name} className="bg-zinc-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{z.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">{z.fahrer} Fahrer</span>
                    <span className={cn('text-sm font-bold', slaText)}>SLA {z.sla}%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', slaCol)} style={{ width: `${z.sla}%` }} />
                </div>
                <div className="flex gap-4 text-xs text-zinc-500">
                  <span>Ø {z.avgMin}min</span>
                  <span>{z.umsatz.toFixed(0)}€ Umsatz</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bilanz */}
      {tab === 'bilanz' && (
        <div className="space-y-3">
          {[
            { label: 'Einnahmen', value: '3.842€', color: 'text-emerald-300', bg: 'bg-emerald-500/10', pct: 100 },
            { label: 'Kosten',    value: '1.140€', color: 'text-red-300',     bg: 'bg-red-500/10',     pct: Math.round(1140 / 3842 * 100) },
            { label: 'Gewinn',    value: '2.702€', color: 'text-violet-300',  bg: 'bg-violet-500/10',  pct: Math.round(2702 / 3842 * 100) },
          ].map(row => (
            <div key={row.label} className={cn('rounded-lg p-4', row.bg)}>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-zinc-300">{row.label}</span>
                <span className={cn('text-lg font-bold', row.color)}>{row.value}</span>
              </div>
              <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', row.color.replace('text', 'bg'))} style={{ width: `${row.pct}%` }} />
              </div>
              <div className="text-xs text-zinc-600 mt-1">{row.pct}% vom Umsatz</div>
            </div>
          ))}
          <div className="bg-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1">Netto-Marge</div>
            <div className="text-3xl font-bold text-violet-300">70%</div>
            <div className="text-xs text-emerald-400 mt-1">↑ +3% vs. gestern</div>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-zinc-600">60s-Polling · Phase 5510</p>
    </Card>
  )
}
