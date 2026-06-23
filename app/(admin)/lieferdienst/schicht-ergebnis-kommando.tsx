'use client'

import { useState, useEffect } from 'react'
import { euro } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

const MOCK = {
  bestellungen: 47,
  bestellungenGestern: 38,
  umsatz: 1247.80,
  umsatzGestern: 1089.20,
  avgLieferzeit: 28,
  fahrerAktiv: 3,
  stornoquote: 4.3,
  topZone: 'Zone A',
}

type Stats = typeof MOCK

function Trend({ current, prev }: { current: number; prev: number }) {
  const up = current >= prev
  return up ? (
    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
  ) : (
    <TrendingDown className="h-3.5 w-3.5 text-red-500" />
  )
}

export function SchichtErgebnisKommando({ locationId }: { locationId: string }) {
  const [data, setData] = useState<Stats>(MOCK)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!locationId) {
      setLoading(false)
      return
    }

    const load = () => {
      fetch(`/api/delivery/admin/analytics?location_id=${encodeURIComponent(locationId)}&type=today`)
        .then((r) => r.json())
        .then((d) => {
          if (d && typeof d.bestellungen === 'number') {
            setData({
              bestellungen: d.bestellungen ?? MOCK.bestellungen,
              bestellungenGestern: d.bestellungenGestern ?? MOCK.bestellungenGestern,
              umsatz: d.umsatz ?? MOCK.umsatz,
              umsatzGestern: d.umsatzGestern ?? MOCK.umsatzGestern,
              avgLieferzeit: d.avgLieferzeit ?? MOCK.avgLieferzeit,
              fahrerAktiv: d.fahrerAktiv ?? MOCK.fahrerAktiv,
              stornoquote: d.stornoquote ?? MOCK.stornoquote,
              topZone: d.topZone ?? MOCK.topZone,
            })
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }

    load()
    const id = setInterval(load, 2 * 60 * 1000)
    return () => clearInterval(id)
  }, [locationId])

  useEffect(() => {
    if (!locationId) setLoading(false)
  }, [locationId])

  const tiles = [
    {
      label: 'Bestellungen heute',
      value: data.bestellungen.toString(),
      bg: 'bg-matcha-50',
      color: 'text-matcha-700',
      trend: <Trend current={data.bestellungen} prev={data.bestellungenGestern} />,
    },
    {
      label: 'Umsatz',
      value: euro(data.umsatz),
      bg: 'bg-emerald-50',
      color: 'text-emerald-700',
      trend: <Trend current={data.umsatz} prev={data.umsatzGestern} />,
    },
    {
      label: 'Ø Lieferzeit',
      value: `${data.avgLieferzeit} Min`,
      bg: 'bg-blue-50',
      color: 'text-blue-700',
      trend: null,
    },
    {
      label: 'Fahrer aktiv',
      value: data.fahrerAktiv.toString(),
      bg: 'bg-amber-50',
      color: 'text-amber-700',
      trend: null,
    },
    {
      label: 'Stornoquote',
      value: data.stornoquote.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %',
      bg: 'bg-red-50',
      color: 'text-red-700',
      trend: null,
    },
    {
      label: 'Top-Zone',
      value: data.topZone,
      bg: 'bg-matcha-100',
      color: 'text-matcha-700',
      trend: null,
    },
  ]

  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-stone-800">Schicht-Ergebnis</span>
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700 uppercase tracking-wide">
              Heute
            </span>
          </div>
          <div className="text-xs text-stone-400 mt-0.5">Aktuelle Schichtkennzahlen auf einen Blick</div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-stone-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
          {tiles.map((tile) => (
            <div key={tile.label} className={`rounded-xl ${tile.bg} p-3`}>
              <div className="flex items-start justify-between">
                <div className={`text-lg font-black tabular-nums leading-tight ${tile.color}`}>
                  {tile.value}
                </div>
                {tile.trend && <div className="mt-0.5">{tile.trend}</div>}
              </div>
              <div className="text-[10px] font-semibold text-stone-500 mt-1">{tile.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
