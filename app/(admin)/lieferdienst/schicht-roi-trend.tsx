'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { TrendingUp, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

interface RoiRow {
  snapshotDate: string
  revenueEur: number
  deliveryCount: number
  estimatedCostEur: number
  revenuePerDriverHour: number | null
  costPerDelivery: number | null
  netMarginEur: number | null
  netMarginPct: number | null
}

const DAYS_OPTIONS = [14, 30, 60, 90] as const
type DaysOption = (typeof DAYS_OPTIONS)[number]

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z')
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

function fmtEur(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
}

function fmtPct(v: number): string {
  return v.toFixed(1) + ' %'
}

type Tab = 'margin' | 'revenue_per_hour' | 'cost_per_delivery'

const TABS: { key: Tab; label: string }[] = [
  { key: 'margin', label: 'Netto-Marge %' },
  { key: 'revenue_per_hour', label: 'Umsatz/Stunde' },
  { key: 'cost_per_delivery', label: 'Kosten/Lieferung' },
]

export function LieferdienstSchichtROITrend({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(false)
  const [days, setDays] = useState<DaysOption>(30)
  const [tab, setTab] = useState<Tab>('margin')
  const [data, setData] = useState<RoiRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!locationId || !open) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/delivery/admin/schicht-roi?action=history&days=${days}${locationId ? `&location_id=${locationId}` : ''}`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { ok: boolean; history?: RoiRow[] }
      setData(json.history ?? [])
    } catch {
      setError('Daten konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [locationId, open, days])

  useEffect(() => { void load() }, [load])

  // 10-Min-Polling wenn offen
  useEffect(() => {
    if (!open) return
    const t = setInterval(() => { void load() }, 10 * 60_000)
    return () => clearInterval(t)
  }, [open, load])

  const chartData = data.map((r) => ({
    date: fmtDate(r.snapshotDate),
    netMarginPct: r.netMarginPct ?? 0,
    revenuePerHour: r.revenuePerDriverHour ?? 0,
    costPerDelivery: r.costPerDelivery ?? 0,
  }))

  // Letzte Zeile für KPI-Kacheln
  const last = data[data.length - 1]
  const prev = data[data.length - 2]

  const marginDelta =
    last && prev && last.netMarginPct != null && prev.netMarginPct != null
      ? last.netMarginPct - prev.netMarginPct
      : null

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        className="flex w-full items-center justify-between px-5 py-4"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-char">Schicht-ROI Trend</div>
            <div className="text-xs text-stone-400">
              {last
                ? `Letzte Marge: ${last.netMarginPct != null ? fmtPct(last.netMarginPct) : '–'}${marginDelta != null ? ` (${marginDelta >= 0 ? '+' : ''}${marginDelta.toFixed(1)} PP)` : ''}`
                : `${days}-Tage Verlauf`}
            </div>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="border-t border-stone-100 px-5 pb-5 pt-4 space-y-4">
          {/* Zeitraum-Selektor */}
          <div className="flex items-center gap-2">
            {DAYS_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  days === d
                    ? 'bg-emerald-600 text-white'
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
              >
                {d}T
              </button>
            ))}
          </div>

          {/* Tab-Auswahl */}
          <div className="flex gap-1 border-b border-stone-100 pb-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-t px-3 py-1.5 text-xs font-semibold transition-colors ${
                  tab === t.key
                    ? 'border-b-2 border-emerald-600 text-emerald-700'
                    : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* KPI-Kacheln */}
          {last && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-emerald-50 p-3">
                <div className="text-lg font-black tabular-nums text-emerald-700">
                  {last.netMarginPct != null ? fmtPct(last.netMarginPct) : '–'}
                </div>
                <div className="text-[10px] font-semibold text-stone-500 mt-0.5">Netto-Marge</div>
              </div>
              <div className="rounded-xl bg-blue-50 p-3">
                <div className="text-lg font-black tabular-nums text-blue-700">
                  {last.revenuePerDriverHour != null ? fmtEur(last.revenuePerDriverHour) : '–'}
                </div>
                <div className="text-[10px] font-semibold text-stone-500 mt-0.5">Umsatz/Fahr.-Std.</div>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <div className="text-lg font-black tabular-nums text-amber-700">
                  {last.costPerDelivery != null ? fmtEur(last.costPerDelivery) : '–'}
                </div>
                <div className="text-[10px] font-semibold text-stone-500 mt-0.5">Kosten/Lieferung</div>
              </div>
              <div className="rounded-xl bg-stone-50 p-3">
                <div className="text-lg font-black tabular-nums text-stone-700">
                  {fmtEur(last.revenueEur)}
                </div>
                <div className="text-[10px] font-semibold text-stone-500 mt-0.5">Umsatz ges.</div>
              </div>
            </div>
          )}

          {/* Chart */}
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-stone-300" />
            </div>
          ) : error ? (
            <div className="flex h-28 items-center justify-center text-xs text-stone-400">{error}</div>
          ) : chartData.length === 0 ? (
            <div className="flex h-28 flex-col items-center justify-center gap-1 text-stone-400">
              <TrendingUp className="h-6 w-6 text-stone-200" />
              <span className="text-xs">Noch keine Snapshots vorhanden.</span>
              <span className="text-[10px] text-stone-300">Cron läuft täglich 02:10 UTC.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  tickFormatter={
                    tab === 'margin'
                      ? (v: number) => v.toFixed(0) + '%'
                      : (v: number) => v.toFixed(0) + '€'
                  }
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }}
                  formatter={(value: unknown, name: unknown) => {
                    const v = Number(value);
                    if (name === 'netMarginPct') return [fmtPct(v), 'Marge']
                    if (name === 'revenuePerHour') return [fmtEur(v), 'Umsatz/h']
                    if (name === 'costPerDelivery') return [fmtEur(v), 'Kosten/Lief.']
                    return [String(value), String(name)]
                  }}
                />
                {tab === 'margin' && (
                  <Line
                    type="monotone"
                    dataKey="netMarginPct"
                    stroke="#059669"
                    strokeWidth={2}
                    dot={false}
                    name="netMarginPct"
                  />
                )}
                {tab === 'revenue_per_hour' && (
                  <Line
                    type="monotone"
                    dataKey="revenuePerHour"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    name="revenuePerHour"
                  />
                )}
                {tab === 'cost_per_delivery' && (
                  <Line
                    type="monotone"
                    dataKey="costPerDelivery"
                    stroke="#d97706"
                    strokeWidth={2}
                    dot={false}
                    name="costPerDelivery"
                  />
                )}
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  )
}
