'use client'

import { Truck } from 'lucide-react'
import { useDriver } from '@/lib/driver-app/driver-context'

export function Header() {
  const { driver, phase, acceptedOrders, collectedOrders } = useDriver()

  const getPhaseTitle = () => {
    switch (phase) {
      case 'waiting':
        return 'MISE Driver'
      case 'incoming':
        return 'Neue Bestellung'
      case 'collecting':
        return `Gesammelt (${collectedOrders.length})`
      case 'picking':
        return `Abholen (${acceptedOrders.length})`
      case 'delivering':
        return 'Liefern'
      case 'completed':
        return 'Fertig'
      default:
        return 'MISE Driver'
    }
  }

  return (
    <header className="bg-zinc-950 border-b border-zinc-800">
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">{getPhaseTitle()}</span>
        </div>
        
        <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
          driver.isOnline 
            ? 'bg-emerald-500/20 text-emerald-400' 
            : 'bg-zinc-800 text-zinc-500'
        }`}>
          {driver.isOnline ? 'Online' : 'Offline'}
        </div>
      </div>
    </header>
  )
}
