'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, Star, Medal } from 'lucide-react'

type BadgeLevel = 'bronze' | 'silver' | 'gold' | 'platinum'

interface TransparencyProfile {
  trustScore:       number | null
  badgeLevel:       BadgeLevel | null
  badgeLabel:       string | null
  avgDeliveryMin:   number | null
  onTimeRatePct:    number | null
  ordersLast30d:    number
  snapshotDate:     string | null
}

const BADGE_STYLE: Record<BadgeLevel, { icon: string; border: string; text: string }> = {
  platinum: { icon: 'text-violet-300', border: 'border-violet-500/40', text: 'text-violet-200' },
  gold:     { icon: 'text-yellow-300', border: 'border-yellow-500/40', text: 'text-yellow-100' },
  silver:   { icon: 'text-slate-300',  border: 'border-slate-500/40',  text: 'text-slate-200'  },
  bronze:   { icon: 'text-amber-400',  border: 'border-amber-600/40',  text: 'text-amber-100'  },
}

export function LieferTransparenzBadge({ isDelivery }: { isDelivery: boolean }) {
  const [profile, setProfile] = useState<TransparencyProfile | null>(null)

  useEffect(() => {
    if (!isDelivery) return
    const slug =
      typeof window !== 'undefined'
        ? decodeURIComponent(
            window.location.pathname.split('/').filter(Boolean)[1] ?? '',
          )
        : ''
    if (!slug) return

    fetch(`/api/delivery/public/transparency?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: TransparencyProfile | null) => {
        if (d?.badgeLevel) setProfile(d)
      })
      .catch(() => {})
  }, [isDelivery])

  if (!isDelivery) return null

  // Fallback-Badge bevor Daten laden
  if (!profile) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
        <ShieldCheck className="h-5 w-5 shrink-0 text-matcha-400" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-matcha-300">Zertifiziertes Lieferteam</div>
          <div className="mt-0.5 text-[10px] text-white/60">
            Mise Qualitätsstandard · Geprüfte Fahrer
          </div>
        </div>
        <Star className="h-4 w-4 text-matcha-400" />
      </div>
    )
  }

  const level  = profile.badgeLevel ?? 'bronze'
  const style  = BADGE_STYLE[level]
  const label  = profile.badgeLabel ?? 'Mise-Qualität'
  const score  = profile.trustScore ?? 0
  const onTime = profile.onTimeRatePct

  return (
    <div className={`flex items-center gap-3 rounded-xl border bg-white/5 px-4 py-3 backdrop-blur ${style.border}`}>
      <Medal className={`h-5 w-5 shrink-0 ${style.icon}`} />
      <div className="min-w-0 flex-1">
        <div className={`text-xs font-bold ${style.text}`}>{label}</div>
        <div className="mt-0.5 text-[10px] text-white/60">
          {[
            onTime !== null && `${Math.round(onTime)} % pünktlich`,
            profile.avgDeliveryMin !== null && `Ø ${Math.round(profile.avgDeliveryMin)} Min`,
          ]
            .filter(Boolean)
            .join(' · ') || 'Mise Qualitätsstandard'}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-center">
        <span className={`text-base font-black leading-none ${style.icon}`}>
          {score >= 90 ? 'A+' : score >= 75 ? 'A' : score >= 60 ? 'B' : 'C'}
        </span>
        <span className="text-[8px] text-white/40 mt-0.5">{Math.round(score)} Pkt</span>
      </div>
    </div>
  )
}
