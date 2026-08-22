'use client'

import { Driver, getDriverStatusColor } from '@/lib/lieferdienst/drivers'
import { Truck, ArrowLeft, Package, Clock } from 'lucide-react'

interface DriverStatusBarProps {
  drivers: Driver[]
  onOpenPanel: () => void
}

export function DriverStatusBar({ drivers, onOpenPanel }: DriverStatusBarProps) {
  const activeDrivers = drivers.filter(d => d.status !== 'offline')
  const deliveringDrivers = drivers.filter(d => d.status === 'delivering')
  const returningDrivers = drivers.filter(d => d.status === 'returning')
  const pickingUpDrivers = drivers.filter(d => d.status === 'picking_up')

  // Nächster Fahrer der zurückkommt
  const nextReturning = [...returningDrivers, ...deliveringDrivers]
    .filter(d => d.estimatedReturn)
    .sort((a, b) => (a.estimatedReturn?.getTime() || 0) - (b.estimatedReturn?.getTime() || 0))[0]

  const getEstimatedMinutes = (date?: Date) => {
    if (!date) return null
    const mins = Math.ceil((date.getTime() - Date.now()) / 60000)
    return mins > 0 ? mins : 0
  }

  if (activeDrivers.length === 0) return null

  return (
    <button
      onClick={onOpenPanel}
      className="flex items-center gap-3 px-4 py-2 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-all shadow-sm"
    >
      {/* Fahrer Icon mit Badge */}
      <div className="relative">
        <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
          <Truck className="w-4 h-4 text-blue-600" />
        </div>
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
          {activeDrivers.length}
        </span>
      </div>

      {/* Status Info */}
      <div className="flex items-center gap-4 text-sm">
        {/* Unterwegs */}
        {deliveringDrivers.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-blue-500" />
            <span className="font-medium text-blue-700">{deliveringDrivers.length} unterwegs</span>
          </div>
        )}

        {/* Auf Rückweg */}
        {returningDrivers.length > 0 && (
          <div className="flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5 text-violet-500" />
            <span className="font-medium text-violet-700">{returningDrivers.length} Rückweg</span>
          </div>
        )}

        {/* Holt ab */}
        {pickingUpDrivers.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-amber-700">{pickingUpDrivers.length} holt ab</span>
          </div>
        )}

        {/* Nächster Fahrer */}
        {nextReturning && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-stone-200">
            <Clock className="w-3.5 h-3.5 text-stone-500" />
            <span className="text-stone-600">
              {nextReturning.name.split(' ')[0]} in {getEstimatedMinutes(nextReturning.estimatedReturn)} min
            </span>
          </div>
        )}
      </div>
    </button>
  )
}
