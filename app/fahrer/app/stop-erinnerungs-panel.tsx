'use client'

import { useState, useEffect } from 'react'
import { Phone, CheckSquare, Square, MapPin, Package, Euro, MessageSquare, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'

type Stop = {
  id: string
  order_id: string
  reihenfolge: number
  angekommen_am: string | null
  geliefert_am: string | null
  distanz_zum_vorgaenger_m?: number | null
  order: {
    bestellnummer: string
    kunde_name: string
    kunde_adresse: string | null
    kunde_plz: string | null
    kunde_notiz?: string | null
    kunde_lieferhinweis?: string | null
    kunde_telefon?: string | null
    gesamtbetrag: number
  }
}

type ActiveBatch = {
  id: string
  stops: Stop[]
}

type Props = {
  activeBatch: ActiveBatch | null
}

type ChecklistItem = {
  id: string
  icon: React.ReactNode
  label: string
}

export function FahrerStoppErinnerungsPanel({ activeBatch }: Props) {
  const [checkedIds, setCheckedIds] = useState<string[]>([])

  const currentStop = activeBatch?.stops.find((s) => s.geliefert_am === null) ?? null

  useEffect(() => {
    setCheckedIds([])
  }, [currentStop?.id])

  if (!activeBatch) return null

  const totalStops = activeBatch.stops.length
  const allDelivered = currentStop === null

  if (allDelivered) {
    return (
      <div className="rounded-2xl bg-zinc-900 px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <span className="text-lg font-semibold">Alle Stopps abgeschlossen!</span>
        </div>
      </div>
    )
  }

  const { order, reihenfolge } = currentStop

  const betragFormatiert = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(order.gesamtbetrag)

  const items: ChecklistItem[] = [
    {
      id: 'adresse',
      icon: <MapPin className="h-4 w-4 shrink-0 text-zinc-400" />,
      label: `Adresse prüfen: ${[order.kunde_plz, order.kunde_adresse].filter(Boolean).join(' ')}`,
    },
    {
      id: 'klingeln',
      icon: <Truck className="h-4 w-4 shrink-0 text-zinc-400" />,
      label: 'Klingeln / anklopfen',
    },
    {
      id: 'bestellnummer',
      icon: <Package className="h-4 w-4 shrink-0 text-zinc-400" />,
      label: `Bestellnummer bestätigen: #${order.bestellnummer}`,
    },
    {
      id: 'betrag',
      icon: <Euro className="h-4 w-4 shrink-0 text-zinc-400" />,
      label: `Betrag: ${betragFormatiert}`,
    },
    ...(order.kunde_notiz
      ? [
          {
            id: 'notiz',
            icon: <MessageSquare className="h-4 w-4 shrink-0 text-zinc-400" />,
            label: `Kundennotiz: ${order.kunde_notiz}`,
          },
        ]
      : []),
    ...(order.kunde_lieferhinweis
      ? [
          {
            id: 'hinweis',
            icon: <MessageSquare className="h-4 w-4 shrink-0 text-amber-400" />,
            label: `Hinweis: ${order.kunde_lieferhinweis}`,
          },
        ]
      : []),
  ]

  function toggleItem(id: string) {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  return (
    <div className="rounded-2xl bg-zinc-900 text-white">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <span className="text-xs font-medium uppercase tracking-widest text-zinc-400">
          Stopp-Checkliste
        </span>
        <span className="rounded-full bg-zinc-800 px-3 py-0.5 text-xs font-semibold text-zinc-300">
          Stopp {reihenfolge} von {totalStops}
        </span>
      </div>

      <div className="px-5 pt-4 pb-1">
        <p className="text-base font-semibold leading-tight">{order.kunde_name}</p>
      </div>

      <ul className="space-y-1 px-4 py-3">
        {items.map((item) => {
          const checked = checkedIds.includes(item.id)
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => toggleItem(item.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                  checked ? 'bg-zinc-800/60 text-zinc-500 line-through' : 'hover:bg-zinc-800/40 text-zinc-100'
                )}
              >
                <span className="mt-0.5 shrink-0 transition-transform duration-150">
                  {checked ? (
                    <CheckSquare className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Square className="h-4 w-4 text-zinc-500" />
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {item.icon}
                  {item.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {order.kunde_telefon && (
        <div className="px-5 pb-5 pt-2">
          <a
            href={`tel:${order.kunde_telefon}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-800 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 active:scale-95"
          >
            <Phone className="h-4 w-4" />
            Anrufen
          </a>
        </div>
      )}
    </div>
  )
}
