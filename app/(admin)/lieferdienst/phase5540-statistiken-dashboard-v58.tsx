'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, TrendingUp, TrendingDown, Users, Clock, Euro, AlertCircle, Star, Target, Zap, ChevronUp, ChevronDown } from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, BarChart as ReBarChart, Bar, YAxis, LineChart, Line } from 'recharts';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Phase 5540 — Statistiken-Dashboard V58
// V57+: Echtzeit-Fahrer-Verfügbarkeits-Kalender (freie/gebuchte/aktive Slots je Stunde);
// Schicht-Fluktuation-Index (Abgang-Rate/Aufnahme-Rate je Schicht);
// Kunden-Beschwerde-Trend-Monitor (Beschwerde-Rate% letzte 7h AreaChart);
// SLA-Verletzungs-Kosten-Analyse (€ Kompensation je SLA-Verletzung vs. Trend);
// 19-KPI-Grid 4-spaltig; 14-Tab-Nav;
// 60s-Polling; Mock-Fallback

type Tab =
  | 'ueberblick' | 'kapazitaet' | 'prognose' | 'ertrag' | 'zonen' | 'kosten' | 'kunden'
  | 'moral' | 'momentum' | 'perzentil' | 'puenktlichkeit' | 'qualitaet' | 'roi' | 'fluktuation';

interface KpiItem { label: string; value: string; delta: string; up: boolean; alert: boolean }
interface VerfuegbarkeitsSlot { stunde: string; frei: number; gebucht: number; aktiv: number }
interface FluktuationPunkt { schicht: string; abgang: number; aufnahme: number }
interface BeschwerdeHour { stunde: string; rate_pct: number }
interface SlaKosten { tag: string; kosten_eur: number; verletzungen: number }

const MOCK_KPI: KpiItem[] = [
  { label: 'Bestellungen',    value: '214',    delta: '+19%', up: true,  alert: false },
  { label: 'Umsatz',          value: '5.820€', delta: '+24%', up: true,  alert: false },
  { label: 'Ø-Lieferzeit',    value: '21min',  delta: '-8min', up: true,  alert: false },
  { label: 'SLA-Quote',       value: '95%',    delta: '+7%',  up: true,  alert: false },
  { label: 'Storno-Rate',     value: '2.3%',   delta: '-1.0%',up: true,  alert: false },
  { label: 'Fahrer aktiv',    value: '12',     delta: '+6',   up: true,  alert: false },
  { label: 'Ø-Bewertung',     value: '4.9★',   delta: '+0.2', up: true,  alert: false },
  { label: 'Touren gesamt',   value: '64',     delta: '+15',  up: true,  alert: false },
  { label: 'Kosten',          value: '1.640€', delta: '+5%',  up: false, alert: false },
  { label: 'Gewinn',          value: '4.180€', delta: '+33%', up: true,  alert: false },
  { label: 'Ertrag/km',       value: '3.51€',  delta: '+0.31',up: true,  alert: false },
  { label: 'Moral-Index',     value: '93',     delta: '+9',   up: true,  alert: false },
  { label: 'Momentum',        value: '+17€/h', delta: '+6',   up: true,  alert: false },
  { label: 'P90-Lieferzeit',  value: '32min',  delta: '-6min',up: true,  alert: false },
  { label: 'Bindungs-Score',  value: '78%',    delta: '+8%',  up: true,  alert: false },
  { label: 'Pünktlichkeit',   value: '92%',    delta: '+5%',  up: true,  alert: false },
  { label: 'Qualitäts-Index', value: '86',     delta: '+9',   up: true,  alert: false },
  { label: 'Schicht-ROI',     value: '155%',   delta: '+15%', up: true,  alert: false },
  { label: 'Fluktuation',     value: '4.1%',   delta: '-0.8%',up: true,  alert: false },
]

const MOCK_VERFUEGBARKEIT: VerfuegbarkeitsSlot[] = [
  { stunde: '10:00', frei: 3, gebucht: 8, aktiv: 5 },
  { stunde: '11:00', frei: 2, gebucht: 9, aktiv: 7 },
  { stunde: '12:00', frei: 1, gebucht: 11, aktiv: 10 },
  { stunde: '13:00', frei: 0, gebucht: 12, aktiv: 12 },
  { stunde: '14:00', frei: 2, gebucht: 10, aktiv: 9 },
  { stunde: '15:00', frei: 4, gebucht: 8, aktiv: 6 },
]

const MOCK_FLUKTUATION: FluktuationPunkt[] = [
  { schicht: 'Mo', abgang: 1, aufnahme: 2 },
  { schicht: 'Di', abgang: 0, aufnahme: 1 },
  { schicht: 'Mi', abgang: 2, aufnahme: 3 },
  { schicht: 'Do', abgang: 1, aufnahme: 1 },
  { schicht: 'Fr', abgang: 0, aufnahme: 2 },
  { schicht: 'Sa', abgang: 1, aufnahme: 3 },
  { schicht: 'So', abgang: 0, aufnahme: 1 },
]

const MOCK_BESCHWERDEN: BeschwerdeHour[] = [
  { stunde: '10', rate_pct: 1.2 },
  { stunde: '11', rate_pct: 0.8 },
  { stunde: '12', rate_pct: 2.1 },
  { stunde: '13', rate_pct: 3.4 },
  { stunde: '14', rate_pct: 2.8 },
  { stunde: '15', rate_pct: 1.5 },
  { stunde: '16', rate_pct: 1.1 },
]

const MOCK_SLA_KOSTEN: SlaKosten[] = [
  { tag: 'Mo', kosten_eur: 42, verletzungen: 3 },
  { tag: 'Di', kosten_eur: 28, verletzungen: 2 },
  { tag: 'Mi', kosten_eur: 64, verletzungen: 5 },
  { tag: 'Do', kosten_eur: 35, verletzungen: 3 },
  { tag: 'Fr', kosten_eur: 18, verletzungen: 1 },
  { tag: 'Sa', kosten_eur: 24, verletzungen: 2 },
  { tag: 'So', kosten_eur: 12, verletzungen: 1 },
]

const ALL_TABS: { key: Tab; label: string }[] = [
  { key: 'ueberblick', label: 'Überblick' },
  { key: 'kapazitaet', label: 'Kapazität' },
  { key: 'prognose', label: 'Prognose' },
  { key: 'ertrag', label: 'Ertrag' },
  { key: 'zonen', label: 'Zonen' },
  { key: 'kosten', label: 'Kosten' },
  { key: 'kunden', label: 'Kunden' },
  { key: 'moral', label: 'Moral' },
  { key: 'momentum', label: 'Momentum' },
  { key: 'perzentil', label: 'Perzentil' },
  { key: 'puenktlichkeit', label: 'Pünktlichkeit' },
  { key: 'qualitaet', label: 'Qualität' },
  { key: 'roi', label: 'ROI' },
  { key: 'fluktuation', label: 'Fluktuation' },
]

export function LieferdienstPhase5540StatistikenDashboardV58({ locationId }: { locationId: string | null }) {
  const [kpi, setKpi] = useState<KpiItem[]>(MOCK_KPI)
  const [verfuegbarkeit, setVerfuegbarkeit] = useState<VerfuegbarkeitsSlot[]>(MOCK_VERFUEGBARKEIT)
  const [fluktuation, setFluktuation] = useState<FluktuationPunkt[]>(MOCK_FLUKTUATION)
  const [beschwerden, setBeschwerden] = useState<BeschwerdeHour[]>(MOCK_BESCHWERDEN)
  const [slaKosten, setSlaKosten] = useState<SlaKosten[]>(MOCK_SLA_KOSTEN)
  const [tab, setTab] = useState<Tab>('ueberblick')

  const load = useCallback(async () => {
    if (!locationId) return
    try {
      const r = await fetch(`/api/delivery/admin/statistiken?location_id=${locationId}&v=58`)
      if (r.ok) {
        const d = await r.json()
        if (d.kpi) setKpi(d.kpi)
        if (d.verfuegbarkeit) setVerfuegbarkeit(d.verfuegbarkeit)
        if (d.fluktuation) setFluktuation(d.fluktuation)
        if (d.beschwerden) setBeschwerden(d.beschwerden)
        if (d.sla_kosten) setSlaKosten(d.sla_kosten)
      }
    } catch { /* mock */ }
  }, [locationId])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  const gesamt_score_item = kpi.find(k => k.label === 'SLA-Quote')
  const gesamt_score = gesamt_score_item ? parseInt(gesamt_score_item.value) : 95

  return (
    <Card className="bg-gray-900 border-gray-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/40 bg-gray-800/60">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-teal-400" />
          <span className="text-sm font-semibold text-white">Statistiken V58</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-bold text-teal-300">{gesamt_score}%</div>
            <div className="text-[9px] text-gray-500">SLA-Score</div>
          </div>
          <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 rounded-full" style={{ width: `${gesamt_score}%` }} />
          </div>
        </div>
      </div>

      {/* 19-KPI-Grid */}
      <div className="grid grid-cols-4 gap-px bg-gray-700/30 border-b border-gray-700/40">
        {kpi.map(item => (
          <div key={item.label} className="bg-gray-900 px-2 py-1.5">
            <div className="flex items-center justify-between">
              <span className={cn('text-xs font-semibold', item.alert ? 'text-red-400' : item.up ? 'text-white' : 'text-gray-300')}>
                {item.value}
              </span>
              <span className={cn('text-[9px]', item.up ? 'text-emerald-400' : 'text-red-400')}>
                {item.up ? <ChevronUp className="h-2.5 w-2.5 inline" /> : <ChevronDown className="h-2.5 w-2.5 inline" />}
                {item.delta}
              </span>
            </div>
            <div className="text-[9px] text-gray-500 truncate">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Tab-Nav */}
      <div className="flex overflow-x-auto border-b border-gray-700/40 bg-gray-800/40 scrollbar-hide">
        {ALL_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-3 py-1.5 text-[10px] font-medium whitespace-nowrap shrink-0 transition-colors',
              tab === t.key ? 'text-teal-300 border-b-2 border-teal-400 bg-gray-800' : 'text-gray-500 hover:text-gray-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {tab === 'ueberblick' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {kpi.slice(0, 6).map(item => (
                <div key={item.label} className="rounded-lg bg-gray-800/60 px-3 py-2">
                  <div className={cn('text-base font-bold', item.up ? 'text-white' : 'text-gray-300')}>{item.value}</div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-500">{item.label}</span>
                    <span className={cn('text-[10px]', item.up ? 'text-emerald-400' : 'text-red-400')}>{item.delta}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'kapazitaet' && (
          <div className="space-y-3">
            <div className="text-xs font-medium text-gray-300 mb-2">Fahrer-Verfügbarkeit nach Stunde</div>
            <ResponsiveContainer width="100%" height={140}>
              <ReBarChart data={verfuegbarkeit} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#6b7280' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6, fontSize: 10 }} />
                <Bar dataKey="frei" stackId="a" fill="#34d399" name="Frei" radius={[0,0,0,0]} />
                <Bar dataKey="aktiv" stackId="a" fill="#60a5fa" name="Aktiv" radius={[0,0,0,0]} />
                <Bar dataKey="gebucht" stackId="a" fill="#a78bfa" name="Gebucht" radius={[4,4,0,0]} />
              </ReBarChart>
            </ResponsiveContainer>
            <div className="flex gap-3 text-[9px]">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-400 inline-block" />Frei</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-400 inline-block" />Aktiv</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-violet-400 inline-block" />Gebucht</span>
            </div>
          </div>
        )}

        {tab === 'fluktuation' && (
          <div className="space-y-3">
            <div className="text-xs font-medium text-gray-300 mb-2">Schicht-Fluktuation Abgang vs. Aufnahme</div>
            <ResponsiveContainer width="100%" height={140}>
              <ReBarChart data={fluktuation} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="schicht" tick={{ fontSize: 9, fill: '#6b7280' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6, fontSize: 10 }} />
                <Bar dataKey="aufnahme" fill="#34d399" name="Aufnahme" radius={[2,2,0,0]} />
                <Bar dataKey="abgang" fill="#f87171" name="Abgang" radius={[2,2,0,0]} />
              </ReBarChart>
            </ResponsiveContainer>
            <div className="flex gap-3 text-[9px]">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-400 inline-block" />Aufnahme</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-400 inline-block" />Abgang</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Fluktuation', value: kpi.find(k => k.label === 'Fluktuation')?.value ?? '4.1%', color: 'text-emerald-400' },
                { label: 'Aufnahmen Ø', value: '1.9/Sch.', color: 'text-sky-400' },
                { label: 'Abgänge Ø', value: '0.7/Sch.', color: 'text-red-400' },
              ].map(item => (
                <div key={item.label} className="rounded-lg bg-gray-800/60 px-2 py-2 text-center">
                  <div className={cn('text-sm font-bold', item.color)}>{item.value}</div>
                  <div className="text-[9px] text-gray-500">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'kunden' && (
          <div className="space-y-3">
            <div className="text-xs font-medium text-gray-300 mb-2">Beschwerde-Rate letzte 7h</div>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={beschwerden} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#6b7280' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6, fontSize: 10 }} />
                <Area type="monotone" dataKey="rate_pct" stroke="#f87171" fill="#7f1d1d" fillOpacity={0.5} name="Beschwerde %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {tab === 'kosten' && (
          <div className="space-y-3">
            <div className="text-xs font-medium text-gray-300 mb-2">SLA-Verletzungs-Kosten (7 Tage)</div>
            <ResponsiveContainer width="100%" height={120}>
              <ReBarChart data={slaKosten} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#6b7280' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6, fontSize: 10 }} />
                <Bar dataKey="kosten_eur" fill="#f59e0b" radius={[2,2,0,0]} name="€ Kompensation" />
              </ReBarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Gesamt-Kosten', value: `${slaKosten.reduce((a, b) => a + b.kosten_eur, 0)}€`, color: 'text-amber-400' },
                { label: 'Verletzungen', value: `${slaKosten.reduce((a, b) => a + b.verletzungen, 0)}`, color: 'text-red-400' },
                { label: 'Ø/Verletzung', value: `${Math.round(slaKosten.reduce((a, b) => a + b.kosten_eur, 0) / Math.max(1, slaKosten.reduce((a, b) => a + b.verletzungen, 0)))}€`, color: 'text-orange-400' },
              ].map(item => (
                <div key={item.label} className="rounded-lg bg-gray-800/60 px-2 py-2 text-center">
                  <div className={cn('text-sm font-bold', item.color)}>{item.value}</div>
                  <div className="text-[9px] text-gray-500">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(tab === 'prognose' || tab === 'ertrag' || tab === 'zonen' || tab === 'moral' || tab === 'momentum' || tab === 'perzentil' || tab === 'puenktlichkeit' || tab === 'qualitaet' || tab === 'roi') && (
          <div className="grid grid-cols-2 gap-3">
            {kpi.slice(8, 18).map(item => (
              <div key={item.label} className="rounded-lg bg-gray-800/60 px-3 py-2">
                <div className={cn('text-base font-bold', item.up ? 'text-white' : 'text-gray-300')}>{item.value}</div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-gray-500">{item.label}</span>
                  <span className={cn('text-[10px]', item.up ? 'text-emerald-400' : 'text-red-400')}>{item.delta}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
