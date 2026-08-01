'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, BarChart2, TrendingUp, TrendingDown, Users, Clock, Euro, AlertCircle, Star, Target, Zap, Heart, ChevronUp, ChevronDown, BarChart } from 'lucide-react'
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, BarChart as ReBarChart, Bar, YAxis, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Phase 5535 — Statistiken-Dashboard V57
// V56+: Schicht-ROI-Analyse (Umsatz minus Fahrer-/Energie-Kosten, ROI % je Schicht);
// Personalkosten-Benchmark (Ø-Kosten/Lieferung vs. Industrie-Benchmark, Ampel);
// Touren-Rendite-Heatmap (Ertrag/Tour je Stunde als Grid 6×4);
// Wellbeing-Trend (Fahrer-Moralindex über letzte 7 Schichten LineArea);
// 18-KPI-Grid 4-spaltig; 13-Tab-Nav; 60s-Polling; Mock-Fallback

type Tab = 'ueberblick' | 'kapazitaet' | 'prognose' | 'ertrag' | 'zonen' | 'kosten' | 'kunden' | 'moral' | 'momentum' | 'perzentil' | 'puenktlichkeit' | 'qualitaet' | 'roi'

interface KpiItem { label: string; value: string; delta: string; up: boolean; alert: boolean }
interface RoiSchicht { name: string; umsatz: number; kosten: number; roi_pct: number }
interface PersonalkostenVergleich { label: string; wert: number; benchmark: number; ampel: 'gruen' | 'gelb' | 'rot' }
interface TourenRenditeZelle { stunde: string; tag: string; ertrag_eur: number }
interface WellbeingPunkt { schicht: string; moralindex: number }

const MOCK_KPI: KpiItem[] = [
  { label: 'Bestellungen',    value: '197',    delta: '+17%', up: true,  alert: false },
  { label: 'Umsatz',          value: '5.320€', delta: '+21%', up: true,  alert: false },
  { label: 'Ø-Lieferzeit',    value: '22min',  delta: '-7min',up: true,  alert: false },
  { label: 'SLA-Quote',       value: '94%',    delta: '+6%',  up: true,  alert: false },
  { label: 'Storno-Rate',     value: '2.6%',   delta: '-0.9%',up: true,  alert: false },
  { label: 'Fahrer aktiv',    value: '11',     delta: '+5',   up: true,  alert: false },
  { label: 'Ø-Bewertung',     value: '4.9★',   delta: '+0.2', up: true,  alert: false },
  { label: 'Touren gesamt',   value: '59',     delta: '+13',  up: true,  alert: false },
  { label: 'Kosten',          value: '1.560€', delta: '+4%',  up: false, alert: false },
  { label: 'Gewinn',          value: '3.760€', delta: '+29%', up: true,  alert: false },
  { label: 'Ertrag/km',       value: '3.31€',  delta: '+0.26',up: true,  alert: false },
  { label: 'Moral-Index',     value: '91',     delta: '+7',   up: true,  alert: false },
  { label: 'Momentum',        value: '+15€/h', delta: '+5',   up: true,  alert: false },
  { label: 'P90-Lieferzeit',  value: '34min',  delta: '-5min',up: true,  alert: false },
  { label: 'Bindungs-Score',  value: '76%',    delta: '+7%',  up: true,  alert: false },
  { label: 'Pünktlichkeit',   value: '90%',    delta: '+4%',  up: true,  alert: false },
  { label: 'Qualitäts-Index', value: '84',     delta: '+8',   up: true,  alert: false },
  { label: 'Schicht-ROI',     value: '142%',   delta: '+12%', up: true,  alert: false },
]

const MOCK_ROI: RoiSchicht[] = [
  { name: 'Mo', umsatz: 1120, kosten: 460, roi_pct: 143 },
  { name: 'Di', umsatz: 980,  kosten: 420, roi_pct: 133 },
  { name: 'Mi', umsatz: 1340, kosten: 510, roi_pct: 163 },
  { name: 'Do', umsatz: 1180, kosten: 480, roi_pct: 146 },
  { name: 'Fr', umsatz: 1820, kosten: 620, roi_pct: 194 },
  { name: 'Sa', umsatz: 2100, kosten: 690, roi_pct: 204 },
  { name: 'So', umsatz: 1650, kosten: 580, roi_pct: 184 },
]

const MOCK_PERSONALKOSTEN: PersonalkostenVergleich[] = [
  { label: 'Kosten/Lieferung', wert: 4.20, benchmark: 5.50, ampel: 'gruen' },
  { label: 'Kosten/km',        wert: 0.82, benchmark: 0.90, ampel: 'gruen' },
  { label: 'Kosten/Stunde',    wert: 12.40, benchmark: 11.00, ampel: 'gelb' },
]

const MOCK_HEATMAP: TourenRenditeZelle[] = [
  { stunde: '10', tag: 'Mo', ertrag_eur: 48 }, { stunde: '12', tag: 'Mo', ertrag_eur: 72 },
  { stunde: '14', tag: 'Mo', ertrag_eur: 61 }, { stunde: '18', tag: 'Mo', ertrag_eur: 95 },
  { stunde: '10', tag: 'Fr', ertrag_eur: 58 }, { stunde: '12', tag: 'Fr', ertrag_eur: 110 },
  { stunde: '14', tag: 'Fr', ertrag_eur: 88 }, { stunde: '18', tag: 'Fr', ertrag_eur: 142 },
  { stunde: '10', tag: 'Sa', ertrag_eur: 66 }, { stunde: '12', tag: 'Sa', ertrag_eur: 128 },
  { stunde: '14', tag: 'Sa', ertrag_eur: 101 }, { stunde: '18', tag: 'Sa', ertrag_eur: 168 },
]

const MOCK_WELLBEING: WellbeingPunkt[] = [
  { schicht: 'Mo', moralindex: 82 }, { schicht: 'Di', moralindex: 79 },
  { schicht: 'Mi', moralindex: 85 }, { schicht: 'Do', moralindex: 88 },
  { schicht: 'Fr', moralindex: 91 }, { schicht: 'Sa', moralindex: 89 },
  { schicht: 'So', moralindex: 93 },
]

const MOCK_RADAR = [
  { metrik: 'Pünktlichkeit', wert: 90 }, { metrik: 'Bindung', wert: 76 },
  { metrik: 'Effizienz', wert: 84 }, { metrik: 'Bewertung', wert: 98 },
  { metrik: 'Vollst.', wert: 94 },
]

const TABS: { key: Tab; label: string }[] = [
  { key: 'ueberblick',   label: 'Überblick'   },
  { key: 'kapazitaet',   label: 'Kapazität'   },
  { key: 'prognose',     label: 'Prognose'    },
  { key: 'ertrag',       label: 'Ertrag'      },
  { key: 'zonen',        label: 'Zonen'       },
  { key: 'kosten',       label: 'Kosten'      },
  { key: 'kunden',       label: 'Kunden'      },
  { key: 'moral',        label: 'Moral'       },
  { key: 'momentum',     label: 'Momentum'    },
  { key: 'perzentil',    label: 'Perzentil'   },
  { key: 'puenktlichkeit', label: 'Pünktl.'  },
  { key: 'qualitaet',    label: 'Qualität'    },
  { key: 'roi',          label: 'ROI'         },
]

const AMPEL_CLS: Record<'gruen' | 'gelb' | 'rot', string> = {
  gruen: 'text-emerald-400', gelb: 'text-yellow-400', rot: 'text-red-400',
}

export function LieferdienstPhase5535StatistikenDashboardV57({ locationId }: { locationId: string | null }) {
  const [kpi, setKpi] = useState<KpiItem[]>(MOCK_KPI)
  const [roi, setRoi] = useState<RoiSchicht[]>(MOCK_ROI)
  const [personalkosten, setPersonalkosten] = useState<PersonalkostenVergleich[]>(MOCK_PERSONALKOSTEN)
  const [heatmap] = useState<TourenRenditeZelle[]>(MOCK_HEATMAP)
  const [wellbeing, setWellbeing] = useState<WellbeingPunkt[]>(MOCK_WELLBEING)
  const [tab, setTab] = useState<Tab>('ueberblick')

  const load = useCallback(async () => {
    if (!locationId) return
    try {
      const r = await fetch(`/api/delivery/lieferdienst/statistiken-v57?location_id=${locationId}`)
      if (r.ok) {
        const d = await r.json()
        setKpi(d.kpi ?? MOCK_KPI)
        setRoi(d.roi ?? MOCK_ROI)
        setPersonalkosten(d.personalkosten ?? MOCK_PERSONALKOSTEN)
        setWellbeing(d.wellbeing ?? MOCK_WELLBEING)
      }
    } catch { /* use mock */ }
  }, [locationId])

  useEffect(() => {
    load()
    const iv = setInterval(load, 60_000)
    return () => clearInterval(iv)
  }, [load])

  return (
    <Card className="bg-gray-900 border-gray-700/50 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-violet-400" />
          <span className="text-xs font-bold text-white">Statistiken V57</span>
        </div>
        <span className="text-[10px] text-gray-500">ROI: <span className="text-violet-400 font-bold">
          {roi.length > 0 ? `${roi[roi.length - 1].roi_pct}%` : '—'}
        </span></span>
      </div>

      {/* 18-KPI-Grid */}
      <div className="grid grid-cols-4 gap-1 text-center">
        {kpi.slice(0, 16).map(k => (
          <div key={k.label} className={cn('rounded py-1', k.alert ? 'bg-red-900/20' : 'bg-gray-800')}>
            <div className="text-[8px] text-gray-500 truncate px-0.5">{k.label}</div>
            <div className={cn('text-[10px] font-bold', k.alert ? 'text-red-400' : k.up ? 'text-emerald-400' : 'text-orange-400')}>{k.value}</div>
            <div className={cn('text-[8px]', k.up ? 'text-emerald-600' : 'text-red-600')}>{k.delta}</div>
          </div>
        ))}
        {kpi.slice(16).map(k => (
          <div key={k.label} className="rounded py-1 bg-violet-900/20 col-span-2">
            <div className="text-[8px] text-gray-500">{k.label}</div>
            <div className="text-xs font-bold text-violet-400">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('text-[10px] px-2 py-0.5 rounded whitespace-nowrap transition-colors',
              tab === t.key ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'ueberblick' && (
        <div className="space-y-2">
          <div className="text-[10px] text-gray-400 font-medium">Moral-Trend (7 Schichten)</div>
          <ResponsiveContainer width="100%" height={60}>
            <AreaChart data={wellbeing} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
              <Area type="monotone" dataKey="moralindex" stroke="#8b5cf6" fill="#8b5cf620" strokeWidth={1.5} dot={false} />
              <XAxis dataKey="schicht" tick={{ fontSize: 8, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', fontSize: 10 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'roi' && (
        <div className="space-y-2">
          <div className="text-[10px] text-gray-400 font-medium">Schicht-ROI (Ertrag minus Kosten)</div>
          <ResponsiveContainer width="100%" height={70}>
            <ReBarChart data={roi} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
              <Bar dataKey="roi_pct" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
              <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 8, fill: '#6b7280' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip formatter={(v) => [`${v}%`, 'ROI']} contentStyle={{ background: '#1f2937', border: '1px solid #374151', fontSize: 10 }} />
            </ReBarChart>
          </ResponsiveContainer>
          <div className="space-y-1">
            {roi.map(r => (
              <div key={r.name} className="flex items-center gap-2 rounded bg-gray-800 px-2 py-1">
                <span className="text-[10px] text-gray-400 w-6">{r.name}</span>
                <span className="text-[10px] text-emerald-400">{r.umsatz}€</span>
                <span className="text-[9px] text-gray-500">−{r.kosten}€</span>
                <div className="flex-1" />
                <span className={cn('text-xs font-bold', r.roi_pct >= 180 ? 'text-emerald-400' : r.roi_pct >= 140 ? 'text-yellow-400' : 'text-orange-400')}>
                  {r.roi_pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'kosten' && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-gray-400 font-medium">Personalkosten vs. Benchmark</div>
          {personalkosten.map(p => (
            <div key={p.label} className="rounded bg-gray-800 px-2 py-1.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-300">{p.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-xs font-bold', AMPEL_CLS[p.ampel])}>{p.wert.toFixed(2)}€</span>
                  <span className="text-[9px] text-gray-500">Bench: {p.benchmark.toFixed(2)}€</span>
                </div>
              </div>
              <div className="flex gap-1 h-1.5">
                <div className="flex-1 rounded-full bg-gray-700">
                  <div className={cn('h-1.5 rounded-full', AMPEL_CLS[p.ampel].replace('text-', 'bg-'))}
                    style={{ width: `${Math.min(100, (p.wert / p.benchmark) * 100)}%` }} />
                </div>
              </div>
            </div>
          ))}
          <div className="text-[9px] text-gray-500">Industrie-Benchmark-Vergleich</div>
        </div>
      )}

      {tab === 'qualitaet' && (
        <div className="space-y-1">
          <div className="text-[10px] text-gray-400 font-medium">Tour-Qualitäts-Radar</div>
          <ResponsiveContainer width="100%" height={120}>
            <RadarChart data={MOCK_RADAR} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="metrik" tick={{ fontSize: 8, fill: '#9ca3af' }} />
              <Radar dataKey="wert" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {(tab === 'ertrag' || tab === 'momentum') && (
        <div className="space-y-1">
          <div className="grid grid-cols-3 gap-1">
            {heatmap.slice(0, 12).map((z, i) => (
              <div key={i} className="rounded py-1 text-center"
                style={{ background: `rgba(139,92,246,${Math.min(1, z.ertrag_eur / 170)})` }}>
                <div className="text-[8px] text-gray-300">{z.tag} {z.stunde}h</div>
                <div className="text-[9px] font-bold text-white">{z.ertrag_eur}€</div>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-gray-500">Touren-Rendite-Heatmap je Stunde</div>
        </div>
      )}

      {(tab !== 'ueberblick' && tab !== 'roi' && tab !== 'kosten' && tab !== 'qualitaet' && tab !== 'ertrag' && tab !== 'momentum') && (
        <div className="space-y-1">
          {kpi.map(k => (
            <div key={k.label} className="flex items-center justify-between rounded bg-gray-800 px-2 py-1">
              <span className="text-[10px] text-gray-400">{k.label}</span>
              <div className="flex items-center gap-1">
                <span className={cn('text-xs font-bold', k.up ? 'text-emerald-400' : 'text-orange-400')}>{k.value}</span>
                <span className={cn('text-[9px]', k.up ? 'text-emerald-600' : 'text-red-600')}>{k.delta}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
