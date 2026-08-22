'use client'

import { Check, Navigation, Banknote } from 'lucide-react'
import { useDriver } from '@/lib/driver-app/driver-context'

export function PickingScreen() {
  const { acceptedOrders, checkItem, startDeliveries } = useDriver()
  
  // Wenn keine Bestellungen, zeige leeren State
  if (acceptedOrders.length === 0) {
    return (
      <div className="flex flex-col h-full bg-zinc-950 items-center justify-center p-6">
        <p className="text-zinc-500 text-center">Keine Bestellungen zum Abholen</p>
      </div>
    )
  }
  
  const allPicked = acceptedOrders.every(order => order.status === 'picked')
  const pickedCount = acceptedOrders.filter(order => order.status === 'picked').length

  // Google Maps URL berechnen
  const getMapsUrl = () => {
    if (acceptedOrders.length === 0) return '#'
    
    const waypoints = acceptedOrders.map(order => 
      `${order.customerLat},${order.customerLng}`
    )
    
    const destination = waypoints[waypoints.length - 1]
    
    if (waypoints.length === 1) {
      return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`
    }
    
    const origin = waypoints[0]
    if (waypoints.length === 2) {
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
    }
    
    const waypointsMiddle = waypoints.slice(1, -1).join('|')
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypointsMiddle}&travelmode=driving`
  }

  const handleStartDeliveries = () => {
    startDeliveries()
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Progress */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-zinc-400 text-sm">{pickedCount} von {acceptedOrders.length} bereit</span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-1.5">
          <div 
            className="bg-emerald-500 h-1.5 rounded-full transition-all"
            style={{ width: `${(pickedCount / acceptedOrders.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Orders list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">
        {acceptedOrders.map((order, index) => {
          const isCash = order.paymentMethod === 'cash'
          const allItemsChecked = order.items.every(item => item.checked)
          const checkedCount = order.items.filter(item => item.checked).length
          
          return (
            <div 
              key={order.id} 
              className={`rounded-2xl border-2 overflow-hidden ${
                allItemsChecked 
                  ? 'border-emerald-500 bg-emerald-500/10' 
                  : isCash
                    ? 'border-amber-500 bg-zinc-900'
                    : 'border-zinc-800 bg-zinc-900'
              }`}
            >
              {/* Header */}
              <div className="p-4 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                      allItemsChecked ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {allItemsChecked ? <Check className="w-5 h-5" /> : index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{order.customerName}</p>
                      <p className="text-zinc-500 text-sm">{checkedCount}/{order.items.length} Artikel</p>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-white">{order.totalAmount.toFixed(2)}€</span>
                </div>
                <p className="text-zinc-500 text-sm mt-2 ml-11 truncate">{order.customerAddress}</p>
              </div>

              {/* Cash indicator */}
              {isCash && (
                <div className="bg-amber-500/15 px-4 py-2 flex items-center justify-center gap-2">
                  <Banknote className="w-4 h-4 text-amber-500" />
                  <span className="font-medium text-amber-500 text-sm">Bar: {order.totalAmount.toFixed(2)}€</span>
                </div>
              )}

              {/* Items */}
              <div className="p-3 space-y-2">
                {order.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => checkItem(order.id, item.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                      item.checked 
                        ? 'bg-emerald-500/20 border border-emerald-500/50' 
                        : 'bg-zinc-800 border border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                        item.checked ? 'bg-emerald-500' : 'bg-zinc-700'
                      }`}>
                        {item.checked && <Check className="w-4 h-4 text-white" />}
                      </div>
                      <span className={`font-medium ${item.checked ? 'text-zinc-500 line-through' : 'text-white'}`}>
                        {item.quantity}x {item.name}
                      </span>
                    </div>
                    <span className={item.checked ? 'text-zinc-600' : 'text-zinc-400'}>
                      {(item.price * item.quantity).toFixed(2)}€
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Start button - als Link für bessere Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent pt-8">
        {allPicked ? (
          <a
            href={getMapsUrl()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleStartDeliveries}
            className="w-full h-16 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 bg-emerald-500 text-white"
          >
            <Navigation className="w-6 h-6" />
            Navigation starten
          </a>
        ) : (
          <button
            disabled
            className="w-full h-16 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 bg-zinc-800 text-zinc-600"
          >
            <Navigation className="w-6 h-6" />
            Alle Produkte abhaken
          </button>
        )}
      </div>
    </div>
  )
}
