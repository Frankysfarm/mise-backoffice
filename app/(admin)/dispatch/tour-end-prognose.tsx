'use client'

import { useEffect, useState, useCallback } from 'react'
import { Timer, ChevronDown, ChevronUp, Loader2, Car } from 'lucide-react'

interface TourPrediction {
  batchId: string
  driverName: string | null
  vehicle: string | null
  remainingStops: number
  completedStops: number
  predictedEndUtc: string | null
  confidence: number
  avgMinPerStop: number | null
}

interface DashboardResponse {
  ok: boolean
  dashboard: {
    activePredictions: TourPrediction[]
    accuracyP75: number | null
  }
}

function minutesUntil(iso: string | null): number | null {
  if (!iso) return null
  const diff = (new Date(iso).getTime() - Date.now()) / 60_000
  return Math.round(diff)
}

function urgencyColor(minsLeft: number | null): string {
  if (minsLeft === null) return 'text-gray-400'
  if (minsLeft < 0)   return 'text-red-600'
  if (minsLeft < 10)  return 'text-amber-600'
  return 'text-emerald-600'
}

export function DispatchTourEndPrognose({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<TourPrediction[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!locationId || !open) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/delivery/admin/tour-end-predictions?action=dashboard&location_id=${locationId}`,
        { cache: 'no-store' },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as DashboardResponse
      setRows(json.dashboard?.activePredictions ?? [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [locationId, open])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!open || !locationId) return
    const id = setInterval(() => { void load() }, 60_000)
    return () => clearInterval(id)
  }, [open, locationId, load])

  if (!locationId) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition"
      >
        <Timer className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
          Tour-End-Prognose
        </span>
        {rows.length > 0 && (
          <span className="ml-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5">
            {rows.length}
          </span>
        )}
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400 ml-auto mr-1" />}
        {open
          ? <ChevronUp className="h-4 w-4 text-gray-400 ml-auto" />
          : <ChevronDown className="h-4 w-4 text-gray-400 ml-auto" />}
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {rows.length === 0 && !loading && (
            <p className="px-4 py-3 text-xs text-gray-400">
              Keine aktiven Tour-Prognosen verfügbar.
            </p>
          )}

          {rows.length > 0 && (
            <div className="divide-y divide-gray-50">
              {rows.map((r) => {
                const minsLeft = minutesUntil(r.predictedEndUtc)
                return (
                  <div key={r.batchId} className="flex items-center gap-3 px-4 py-2.5">
                    <Car className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold truncate">
                          {r.driverName ?? 'Fahrer'}
                        </span>
                        {r.vehicle && (
                          <span className="text-[9px] rounded-full bg-gray-100 px-1.5 py-0.5 text-gray-500 font-bold">
                            {r.vehicle}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-500">
                        <span>{r.completedStops}/{r.completedStops + r.remainingStops} Stops</span>
                        {r.avgMinPerStop !== null && (
                          <span>· Ø {r.avgMinPerStop.toFixed(1)} Min/Stop</span>
                        )}
                        <span>· Konfidenz {r.confidence}%</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`text-sm font-black tabular-nums ${urgencyColor(minsLeft)}`}>
                        {minsLeft === null
                          ? '—'
                          : minsLeft < 0
                          ? `${Math.abs(minsLeft)}m überfällig`
                          : `~${minsLeft}m`}
                      </div>
                      <div className="text-[8px] text-gray-400">bis Rückkehr</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
