'use client'

import { useState, useEffect, useCallback } from 'react'
import { Medal, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScoreEntry {
  driverId: string
  driverName: string | null
  compositeScore: number
  grade: string
  dataPoints: number
}

const GRADE_BADGE: Record<string, string> = {
  'A+': 'bg-matcha-100 text-matcha-800 border-matcha-300',
  'A':  'bg-matcha-50  text-matcha-700 border-matcha-200',
  'B':  'bg-blue-50    text-blue-700   border-blue-200',
  'C':  'bg-amber-50   text-amber-700  border-amber-200',
  'D':  'bg-red-50     text-red-700    border-red-200',
}

const RANK_ICON = ['🥇', '🥈', '🥉']

export function LieferdienstFahrerScoreTagesRanking({
  locationId,
}: {
  locationId: string | null
}) {
  const [entries, setEntries] = useState<ScoreEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    if (!locationId || !open) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/delivery/admin/driver-score-daily?action=summary&location_id=${locationId}`,
      )
      if (!res.ok) return
      const json = (await res.json()) as { summary?: ScoreEntry[] }
      setEntries(json.summary ?? [])
    } catch {
      // graceful
    } finally {
      setLoading(false)
    }
  }, [locationId, open])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!open) return
    const id = setInterval(() => { void load() }, 300_000)
    return () => clearInterval(id)
  }, [load, open])

  if (!locationId) return null

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-stone-50 transition"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <Medal className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-stone-800">Fahrer-Score Tages-Ranking</div>
          <div className="text-xs text-stone-400">Heute · Score &amp; Note je Fahrer</div>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-stone-400" />
          : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="border-t border-stone-100 px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
            </div>
          ) : entries.length === 0 ? (
            <div className="py-2 text-center text-sm text-stone-400">
              Noch keine Tages-Snapshots — Cron läuft täglich 00:20 UTC.
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((e, i) => (
                <div key={e.driverId} className="flex items-center gap-3">
                  <span className="w-6 shrink-0 text-center text-base">
                    {RANK_ICON[i] ?? <span className="text-xs font-bold text-stone-400">{i + 1}.</span>}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-stone-700">
                    {e.driverName ?? '—'}
                  </span>
                  {e.dataPoints > 0 && (
                    <span className="text-[10px] text-stone-400">n={e.dataPoints}</span>
                  )}
                  <div
                    className={cn(
                      'rounded-lg border px-2 py-0.5 text-xs font-black',
                      GRADE_BADGE[e.grade] ?? GRADE_BADGE['D'],
                    )}
                  >
                    {e.grade}
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs font-bold tabular-nums text-stone-600">
                    {Math.round(e.compositeScore)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
