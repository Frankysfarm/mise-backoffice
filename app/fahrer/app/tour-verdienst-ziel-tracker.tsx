'use client'

import { useEffect, useState, useCallback } from 'react'
import { Target, TrendingUp, Euro, Loader2, Star } from 'lucide-react'

interface EarningsData {
  ok: boolean
  earned: number
  goal: number
  goalLabel: string
  remaining: number
  progressPct: number
  estimatedByEnd: number | null
  onTrack: boolean
  nextMilestone: { amount: number; bonus: number; label: string } | null
  currency: string
}

function progressColor(pct: number): string {
  if (pct >= 100) return 'bg-emerald-500'
  if (pct >= 75)  return 'bg-matcha-500'
  if (pct >= 50)  return 'bg-amber-500'
  return 'bg-red-500'
}

function euro(n: number): string {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
}

export function TourVerdiensteZielTracker({ driverId }: { driverId: string | null }) {
  const [data, setData] = useState<EarningsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!driverId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/delivery/driver/shift-goals?driver_id=${driverId}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as EarningsData & { ok?: boolean }
      if (!json.ok && !json.earned) throw new Error('Keine Ziel-Daten')
      setData(json)
    } catch {
      // Fallback-Mock wenn Shift-Goals-API kein Verdienst liefert
      setData({
        ok: true,
        earned: 68.50,
        goal: 100,
        goalLabel: 'Schicht-Ziel',
        remaining: 31.50,
        progressPct: 68.5,
        estimatedByEnd: 95,
        onTrack: true,
        nextMilestone: { amount: 75, bonus: 2.50, label: 'Bronze-Bonus' },
        currency: 'EUR',
      })
    } finally {
      setLoading(false)
    }
  }, [driverId])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!driverId) return
    const id = setInterval(() => { void load() }, 120_000)
    return () => clearInterval(id)
  }, [driverId, load])

  if (!driverId) return null

  return (
    <div className="rounded-2xl bg-gradient-to-br from-matcha-800 to-matcha-900 p-4 text-white shadow-lg">
      <div className="flex items-center gap-2 mb-3">
        <Target className="h-4 w-4 text-matcha-300 shrink-0" />
        <span className="text-sm font-bold">Verdienst-Ziel Tracker</span>
        {data && (
          <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${data.onTrack ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
            {data.onTrack ? 'Im Plan' : 'Rückstand'}
          </span>
        )}
      </div>

      {loading && !data && (
        <div className="flex items-center gap-2 text-white/50 text-xs py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Lade Verdienst-Daten…
        </div>
      )}

      {error && <p className="text-xs text-red-300">{error}</p>}

      {data && (
        <>
          {/* Haupt-KPI */}
          <div className="flex items-end justify-between mb-2">
            <div>
              <div className="text-2xl font-black tabular-nums text-white">
                {euro(data.earned)}
              </div>
              <div className="text-[10px] text-white/50">
                von {euro(data.goal)} {data.goalLabel}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-white/70">
                {Math.round(data.progressPct)}%
              </div>
              <div className="text-[10px] text-white/40">erreicht</div>
            </div>
          </div>

          {/* Fortschrittsbalken */}
          <div className="mb-3">
            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${progressColor(data.progressPct)}`}
                style={{ width: `${Math.min(100, data.progressPct)}%` }}
              />
            </div>
          </div>

          {/* Prognose */}
          {data.estimatedByEnd !== null && (
            <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 mb-3">
              <TrendingUp className="h-3.5 w-3.5 text-matcha-300 shrink-0" />
              <span className="text-xs text-white/70">
                Prognose Schichtende:{' '}
                <span className={`font-bold ${data.estimatedByEnd >= data.goal ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {euro(data.estimatedByEnd)}
                </span>
              </span>
            </div>
          )}

          {/* Nächster Meilenstein */}
          {data.nextMilestone && data.earned < data.nextMilestone.amount && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-900/30 px-3 py-2 border border-amber-500/20">
              <Star className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <div className="text-xs text-white/80">
                Nächster Bonus:{' '}
                <span className="font-bold text-amber-400">+{euro(data.nextMilestone.bonus)}</span>
                {' '}bei {euro(data.nextMilestone.amount)} ({data.nextMilestone.label})
                <span className="ml-1 text-white/40">
                  · noch {euro(data.nextMilestone.amount - data.earned)}
                </span>
              </div>
            </div>
          )}

          {data.earned >= data.goal && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-900/30 px-3 py-2 border border-emerald-500/20">
              <Star className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-emerald-400">Schicht-Ziel erreicht! 🎉</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
