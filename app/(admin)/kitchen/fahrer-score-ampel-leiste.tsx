'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DriverScoreEntry {
  driverId: string
  driverName: string | null
  compositeScore: number
  grade: string
}

const GRADE_STYLE: Record<string, string> = {
  'A+': 'bg-matcha-100 text-matcha-800 border-matcha-300',
  'A':  'bg-matcha-50  text-matcha-700 border-matcha-200',
  'B':  'bg-blue-50    text-blue-700   border-blue-200',
  'C':  'bg-amber-50   text-amber-700  border-amber-200',
  'D':  'bg-red-50     text-red-700    border-red-200',
}

export function KitchenFahrerScoreAmpelLeiste({
  locationId,
}: {
  locationId: string | null
}) {
  const [drivers, setDrivers] = useState<DriverScoreEntry[]>([])

  const load = useCallback(async () => {
    if (!locationId) return
    try {
      const res = await fetch(
        `/api/delivery/admin/driver-score-daily?action=summary&location_id=${locationId}`,
      )
      if (!res.ok) return
      const json = (await res.json()) as { summary?: DriverScoreEntry[] }
      setDrivers((json.summary ?? []).slice(0, 6))
    } catch {
      // graceful
    }
  }, [locationId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const id = setInterval(() => { void load() }, 15_000)
    return () => clearInterval(id)
  }, [load])

  if (!locationId || drivers.length === 0) return null

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <Users className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Fahrer-Qualität Heute
        </span>
        <span className="ml-auto rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-500">
          {drivers.length} Fahrer
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {drivers.map((d) => (
          <div
            key={d.driverId}
            className={cn(
              'flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5',
              GRADE_STYLE[d.grade] ?? GRADE_STYLE['D'],
            )}
          >
            <Star className="h-3 w-3 shrink-0" />
            <span className="max-w-[72px] truncate text-xs font-semibold">
              {d.driverName ?? '—'}
            </span>
            <span className="text-xs font-black">{d.grade}</span>
            <span className="text-[10px] opacity-60">{Math.round(d.compositeScore)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
