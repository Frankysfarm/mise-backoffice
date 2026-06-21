'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, Star } from 'lucide-react'

export function BestellScoreVertrauen() {
  const [avgMin, setAvgMin] = useState<number | null>(null)

  useEffect(() => {
    const slug =
      typeof window !== 'undefined'
        ? decodeURIComponent(
            window.location.pathname.split('/').filter(Boolean)[1] ?? '',
          )
        : ''
    if (!slug) return
    fetch(`/api/delivery/public/avg-eta?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { avg_delivery_min?: number } | null) => {
        const avg = d?.avg_delivery_min ?? null
        if (typeof avg === 'number' && avg > 0) setAvgMin(avg)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
      <ShieldCheck className="h-5 w-5 shrink-0 text-matcha-400" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-matcha-300">Geprüftes Lieferteam</div>
        <div className="mt-0.5 text-[10px] text-white/60">
          {avgMin !== null
            ? `Heute Ø ${Math.round(avgMin)} Min · Qualitätsbewertetes Team`
            : 'Qualitätsbewertete Fahrer · Mise-Standard'}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Star className="h-3.5 w-3.5 fill-matcha-400 text-matcha-400" />
        <span className="text-xs font-black text-matcha-300">A</span>
      </div>
    </div>
  )
}
