'use client'

import { useEffect, useState, useCallback } from 'react'
import { Gauge, TrendingUp, TrendingDown, Loader2 } from 'lucide-react'

interface ShiftGoalData {
  summary: {
    activeDrivers: number
    avgStopsPct: number
    avgEarningsPct: number
    aheadCount: number
    onTrackCount: number
    behindCount: number
  }
  config: {
    targetStops: number
    targetEarningsEur: number
  }
  shiftPctElapsed: number
}

interface Props {
  completedToday: number
  locationId: string | null
}

function ringStyle(pct: number): string {
  if (pct >= 100) return '#22c55e'
  if (pct >= 70)  return '#84cc16'
  if (pct >= 40)  return '#f59e0b'
  return '#ef4444'
}

export function KitchenSchichtAuslastungsRing({ completedToday, locationId }: Props) {
  const [goal, setGoal] = useState<number | null>(null)
  const [shiftPct, setShiftPct] = useState<number>(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!locationId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/delivery/admin/shift-goals?action=dashboard&location_id=${locationId}`,
        { cache: 'no-store' },
      )
      if (!res.ok) throw new Error('failed')
      const json = await res.json() as ShiftGoalData
      setGoal(json.config?.targetStops ?? null)
      setShiftPct(json.shiftPctElapsed ?? 0)
    } catch {
      setGoal(null)
    } finally {
      setLoading(false)
    }
  }, [locationId])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!locationId) return
    const id = setInterval(() => { void load() }, 5 * 60_000)
    return () => clearInterval(id)
  }, [locationId, load])

  if (!locationId) return null

  const target = goal ?? 40
  const pct    = Math.min(100, (completedToday / target) * 100)
  const pace   = shiftPct > 0.05 ? completedToday / shiftPct : null
  const projEnd = pace !== null ? Math.round(pace) : null
  const ahead   = projEnd !== null && projEnd > target

  // SVG-Ring: r=28, Umfang ≈ 176
  const R    = 28
  const CIRC = 2 * Math.PI * R
  const dash = (pct / 100) * CIRC

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
          Schicht-Auslastung
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-gray-400 ml-auto" />}
      </div>

      <div className="flex items-center gap-5">
        {/* Ring */}
        <div className="relative shrink-0">
          <svg width={72} height={72} viewBox="0 0 72 72">
            <circle
              cx={36} cy={36} r={R}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth={8}
            />
            <circle
              cx={36} cy={36} r={R}
              fill="none"
              stroke={ringStyle(pct)}
              strokeWidth={8}
              strokeDasharray={`${dash} ${CIRC - dash}`}
              strokeDashoffset={CIRC / 4}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-black tabular-nums leading-none">
              {Math.round(pct)}%
            </span>
          </div>
        </div>

        {/* KPIs */}
        <div className="flex-1 space-y-1.5">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black tabular-nums text-gray-900">
              {completedToday}
            </span>
            <span className="text-xs text-gray-400">/ {target} Bestellungen</span>
          </div>

          {projEnd !== null && (
            <div className={`flex items-center gap-1.5 text-xs ${ahead ? 'text-emerald-600' : 'text-amber-600'}`}>
              {ahead
                ? <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                : <TrendingDown className="h-3.5 w-3.5 shrink-0" />}
              Hochrechnung: <strong>{projEnd}</strong> bis Schichtende
            </div>
          )}

          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width:       `${pct}%`,
                backgroundColor: ringStyle(pct),
              }}
            />
          </div>

          {/* Schicht-Fortschritt */}
          {shiftPct > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="font-bold text-gray-500">{Math.round(shiftPct * 100)}%</span>
              der Schicht abgelaufen
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
