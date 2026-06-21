'use client'

import { useState } from 'react'
import { Star, MessageCircle, CheckCircle2 } from 'lucide-react'

interface Props {
  orderId: string | null
  isDelivery: boolean
}

const STARS = [1, 2, 3, 4, 5] as const

export function LieferFeedbackPrompt({ orderId, isDelivery }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const [hover, setHover]       = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  if (!isDelivery || !orderId) return null

  if (submitted) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-3 text-white/70 text-xs">
        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
        Danke für dein Feedback!
      </div>
    )
  }

  function handleSelect(star: number) {
    setSelected(star)
    // Kurze Verzögerung damit die Sternauswahl sichtbar ist, dann abschicken
    setTimeout(() => setSubmitted(true), 600)
    // fire-and-forget — kein Token-Flow nötig, schlägt silent fehl wenn offline
    void fetch(`/api/delivery/orders/${orderId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stars: star, token: 'storefront-quick', rating: star }),
    }).catch(() => undefined)
  }

  return (
    <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-white">
      <div className="flex items-center gap-2 mb-2.5">
        <MessageCircle className="h-3.5 w-3.5 text-matcha-300 shrink-0" />
        <span className="text-[11px] font-bold text-white/80">Wie war deine Lieferung?</span>
      </div>
      <div className="flex items-center gap-2 justify-center">
        {STARS.map((s) => (
          <button
            key={s}
            onClick={() => handleSelect(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(null)}
            className="p-0.5 transition-transform active:scale-90"
            aria-label={`${s} Sterne`}
          >
            <Star
              className={`h-7 w-7 transition-colors ${
                (hover ?? selected ?? 0) >= s
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-white/20'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
