'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'

interface PublicTransparency {
  ok: boolean
  trustScore: number
  badgeLevel: 'bronze' | 'silver' | 'gold' | 'platinum'
  onTimeRatePct: number | null
  avgDeliveryMin: number | null
  gradeLabel: string
}

const BADGE_COLORS: Record<string, { ring: string; fill: string; label: string; text: string }> = {
  platinum: { ring: '#8b5cf6', fill: '#7c3aed', label: 'Platin',  text: '#c4b5fd' },
  gold:     { ring: '#f59e0b', fill: '#d97706', label: 'Gold',    text: '#fde68a' },
  silver:   { ring: '#94a3b8', fill: '#64748b', label: 'Silber',  text: '#cbd5e1' },
  bronze:   { ring: '#d97706', fill: '#b45309', label: 'Bronze',  text: '#fcd34d' },
}

export function LieferQualitaetsRing({ isDelivery }: { isDelivery: boolean }) {
  const [data, setData] = useState<PublicTransparency | null>(null)

  useEffect(() => {
    if (!isDelivery) return
    const slug =
      typeof window !== 'undefined'
        ? decodeURIComponent(window.location.pathname.split('/').filter(Boolean)[1] ?? '')
        : ''
    if (!slug) return
    let cancelled = false
    fetch(`/api/delivery/public/transparency?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j?.ok) setData(j as PublicTransparency) })
      .catch(() => {/* silently skip */})
    return () => { cancelled = true }
  }, [isDelivery])

  if (!isDelivery || !data) return null

  const meta  = BADGE_COLORS[data.badgeLevel] ?? BADGE_COLORS.bronze
  const pct   = Math.min(100, Math.max(0, data.trustScore))
  const r     = 20
  const circ  = 2 * Math.PI * r
  const dash  = (pct / 100) * circ

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      {/* SVG-Ring */}
      <div className="relative shrink-0 h-12 w-12">
        <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
          <circle
            cx="24" cy="24" r={r}
            fill="none"
            stroke={meta.ring}
            strokeWidth="4"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5" style={{ color: meta.text }} />
        </div>
      </div>

      {/* Info */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold" style={{ color: meta.text }}>
            {meta.label}-Qualität
          </span>
          <span className="text-[10px] text-white/40">· {pct} Pkt</span>
        </div>
        <div className="text-[10px] text-white/50 mt-0.5 flex items-center gap-2">
          {data.onTimeRatePct !== null && (
            <span>{Math.round(data.onTimeRatePct)} % pünktlich</span>
          )}
          {data.avgDeliveryMin !== null && (
            <span>Ø {Math.round(data.avgDeliveryMin)} Min</span>
          )}
        </div>
      </div>

      <div className="ml-auto text-right shrink-0">
        <div className="text-base font-black tabular-nums" style={{ color: meta.text }}>
          {data.gradeLabel ?? (pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : 'C')}
        </div>
        <div className="text-[9px] text-white/30">Gesamtnote</div>
      </div>
    </div>
  )
}
