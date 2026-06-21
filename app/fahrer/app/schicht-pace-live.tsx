'use client'

import { useEffect, useState, useCallback } from 'react'
import { Activity, TrendingUp, TrendingDown, Loader2 } from 'lucide-react'

interface GoalData {
  ok: boolean
  earned: number
  goal: number
  goalLabel: string
  progressPct: number
  onTrack: boolean
}

function paceLabel(pct: number, onTrack: boolean): string {
  if (pct >= 100) return 'Ziel erreicht!'
  if (onTrack)   return 'Im Plan'
  return 'Rückstand aufholen'
}

function paceColor(onTrack: boolean, pct: number): string {
  if (pct >= 100) return 'text-emerald-400'
  if (onTrack)   return 'text-matcha-300'
  return 'text-amber-400'
}

export function SchichtPaceLive({ driverId }: { driverId: string | null }) {
  const [data, setData] = useState<GoalData | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!driverId) return
    setLoading(true)
    try {
      const res = await fetch('/api/delivery/driver/shift-goals', { cache: 'no-store' })
      if (!res.ok) throw new Error('failed')
      const json = await res.json() as GoalData
      if (!json.ok) throw new Error('no data')
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [driverId])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!driverId) return
    const id = setInterval(() => { void load() }, 5 * 60_000)
    return () => clearInterval(id)
  }, [driverId, load])

  if (!driverId) return null

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-3 text-white shadow">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="h-4 w-4 text-slate-300 shrink-0" />
        <span className="text-xs font-bold">Live-Pace</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-white/30 ml-auto" />}
        {data && !loading && (
          <span className={`ml-auto text-[10px] font-black ${paceColor(data.onTrack, data.progressPct)}`}>
            {paceLabel(data.progressPct, data.onTrack)}
          </span>
        )}
      </div>

      {data ? (
        <div className="space-y-2">
          {/* Fortschrittsbalken */}
          <div>
            <div className="flex items-center justify-between mb-1 text-[10px] text-white/50">
              <span>Verdienst-Fortschritt</span>
              <span className="font-bold text-white/70">{Math.round(data.progressPct)}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  data.progressPct >= 100 ? 'bg-emerald-400' :
                  data.onTrack ? 'bg-matcha-400' : 'bg-amber-400'
                }`}
                style={{ width: `${Math.min(100, data.progressPct)}%` }}
              />
            </div>
          </div>

          {/* Tipp */}
          <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5">
            {data.onTrack
              ? <TrendingUp className="h-3.5 w-3.5 text-matcha-400 shrink-0" />
              : <TrendingDown className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
            <span className="text-[10px] text-white/70">
              {data.progressPct >= 100
                ? 'Super! Jeder weitere Stop bringt Extra-Verdienst.'
                : data.onTrack
                ? 'Weiter so — du bist auf Kurs zum Ziel.'
                : `Noch ${(data.goal - data.earned).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} bis zum Ziel.`
              }
            </span>
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-white/40">Keine Daten verfügbar.</p>
      )}
    </div>
  )
}
