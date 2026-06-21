'use client'

import { useState, useEffect, useCallback } from 'react'
import { Award } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScoreEntry {
  driverId: string
  compositeScore: number
  grade: string
  fPunctuality: number
  fRating: number
  fEfficiency: number
  fReliability: number
  fActivity: number
  fVolume: number
  fFeedback: number
}

const GRADE_BG: Record<string, string> = {
  'A+': 'bg-matcha-600',
  'A':  'bg-matcha-500',
  'B':  'bg-blue-500',
  'C':  'bg-amber-500',
  'D':  'bg-red-500',
}

const GRADE_MSG: Record<string, string> = {
  'A+': 'Ausgezeichnet — weiter so!',
  'A':  'Sehr gut — du lieferst top.',
  'B':  'Gut gemacht, noch Potenzial.',
  'C':  'Du schaffst mehr — konzentriere dich!',
  'D':  'Fokus auf Pünktlichkeit und Bewertung.',
}

const FACTORS = [
  { key: 'fPunctuality', label: 'Pünktlichkeit', max: 30 },
  { key: 'fRating',      label: 'Bewertung',     max: 25 },
  { key: 'fEfficiency',  label: 'Effizienz',     max: 15 },
  { key: 'fReliability', label: 'Zuverlässigkeit', max: 15 },
  { key: 'fActivity',    label: 'Aktivität',     max: 10 },
  { key: 'fVolume',      label: 'Volumen',        max: 5 },
  { key: 'fFeedback',    label: 'Feedback',       max: 5 },
] as const

type FactorKey = typeof FACTORS[number]['key']

export function FahrerTagesScoreKarte({
  driverId,
  locationId,
}: {
  driverId: string
  locationId: string
}) {
  const [score, setScore] = useState<ScoreEntry | null>(null)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/delivery/admin/driver-score-daily?action=summary&location_id=${locationId}`,
      )
      if (!res.ok) return
      const json = (await res.json()) as {
        summary?: Array<{ driverId: string } & Partial<ScoreEntry>>
      }
      const entry = (json.summary ?? []).find((s) => s.driverId === driverId)
      if (entry) {
        setScore({
          driverId:       entry.driverId,
          compositeScore: entry.compositeScore ?? 0,
          grade:          entry.grade ?? 'D',
          fPunctuality:   entry.fPunctuality ?? 0,
          fRating:        entry.fRating ?? 0,
          fEfficiency:    entry.fEfficiency ?? 0,
          fReliability:   entry.fReliability ?? 0,
          fActivity:      entry.fActivity ?? 0,
          fVolume:        entry.fVolume ?? 0,
          fFeedback:      entry.fFeedback ?? 0,
        })
      }
    } catch {
      // graceful
    }
  }, [driverId, locationId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const id = setInterval(() => { void load() }, 600_000)
    return () => clearInterval(id)
  }, [load])

  if (!score) return null

  const grade = score.grade
  const composite = Math.round(score.compositeScore)

  return (
    <div className="mx-4 rounded-2xl border border-white/10 bg-stone-900/50 p-4 backdrop-blur">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
      >
        <Award className="h-4 w-4 text-matcha-400" />
        <span className="flex-1 text-xs font-bold uppercase tracking-wider text-stone-400">
          Dein Tages-Score
        </span>
        <div className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white font-black text-sm',
          GRADE_BG[grade] ?? 'bg-stone-600',
        )}>
          {grade}
        </div>
        <span className="text-xl font-black text-white tabular-nums">{composite}</span>
        <span className="text-[10px] text-stone-500">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
          <p className="text-[11px] text-stone-400 mb-3">{GRADE_MSG[grade] ?? ''}</p>
          {FACTORS.map((f) => {
            const val = score[f.key as FactorKey] ?? 0
            const pct = Math.min(100, Math.round((val / f.max) * 100))
            return (
              <div key={f.key} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-[10px] text-stone-400">{f.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-stone-700 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      pct >= 80 ? 'bg-matcha-400'
                      : pct >= 50 ? 'bg-blue-400'
                      : pct >= 30 ? 'bg-amber-400'
                      : 'bg-red-400',
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-[10px] font-bold text-stone-300 tabular-nums">
                  {val.toFixed(1)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
