'use client'

import { useState } from 'react'
import { Order, prepTimes, rejectionReasons } from '@/lib/lieferdienst/orders'
import { Button } from '@/components/ui/button'
import { 
  Bell, Users, Package, Truck, Check, X, Clock, 
  AlertTriangle, ChefHat, Crown, Zap, AlertOctagon
} from 'lucide-react'
import { getAllergyInfo } from '@/lib/lieferdienst/menu'

interface IncomingOrderDialogProps {
  order: Order
  onAccept: (estimatedTime: number) => void
  onReject: (reason: string, unavailableItems?: string[]) => void
}

export function IncomingOrderDialog({ order, onAccept, onReject }: IncomingOrderDialogProps) {
  const [view, setView] = useState<'order' | 'accept' | 'reject'>('order')
  const [selectedTime, setSelectedTime] = useState<number | null>(null)
  const [customTime, setCustomTime] = useState<string>('')
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [unavailableItems, setUnavailableItems] = useState<string[]>([])

  const effectiveTime = customTime ? parseInt(customTime) : selectedTime

  const handleAccept = () => {
    if (effectiveTime && effectiveTime > 0) {
      onAccept(effectiveTime)
    }
  }

  const handleReject = () => {
    if (selectedReason) {
      if (selectedReason === 'Artikel nicht verfügbar' && unavailableItems.length > 0) {
        onReject(selectedReason, unavailableItems)
      } else {
        onReject(selectedReason)
      }
    }
  }

  const toggleUnavailableItem = (itemName: string) => {
    setUnavailableItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(i => i !== itemName)
        : [...prev, itemName]
    )
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'main': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'side': return 'bg-teal-100 text-teal-700 border-teal-200'
      case 'drink': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'dessert': return 'bg-pink-100 text-pink-700 border-pink-200'
      default: return 'bg-stone-100 text-stone-700 border-stone-200'
    }
  }

  // Check for allergies
  const hasAllergies = order.items.some(item => item.allergies && item.allergies.length > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-saffron via-orange-500 to-saffron-deep animate-pulse-slow" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.3)_100%)]" />
      
      {/* Pulsing Ring Effect */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[600px] rounded-full border-4 border-white/10 animate-ping-slow" />
        <div className="absolute w-[500px] h-[500px] rounded-full border-4 border-white/10 animate-ping-slow animation-delay-300" />
        <div className="absolute w-[400px] h-[400px] rounded-full border-4 border-white/10 animate-ping-slow animation-delay-600" />
      </div>

      {/* Content Card */}
      <div className="relative w-full max-w-3xl mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-saffron to-orange-500 px-8 py-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Bell className="w-7 h-7" />
              </div>
              <div>
                <p className="text-white/80 text-sm font-medium uppercase tracking-wider">Neue Bestellung</p>
                <h1 className="text-3xl font-bold tracking-tight">{order.orderNumber}</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {order.priority === 'vip' && (
                <span className="flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-lg bg-amber-400 text-amber-900">
                  <Crown className="w-4 h-4" />
                  VIP
                </span>
              )}
              {order.priority === 'express' && (
                <span className="flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-lg bg-violet-500 text-white">
                  <Zap className="w-4 h-4" />
                  EXPRESS
                </span>
              )}
              {order.priority === 'rush' && (
                <span className="flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-lg bg-red-500 text-white animate-pulse">
                  <Zap className="w-4 h-4" />
                  EILIG
                </span>
              )}
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl">
                {order.type === 'dine_in' && <Users className="w-5 h-5" />}
                {order.type === 'takeaway' && <Package className="w-5 h-5" />}
                {order.type === 'delivery' && <Truck className="w-5 h-5" />}
                <span className="font-medium">
                  {order.type === 'dine_in' && `Tisch ${order.table}`}
                  {order.type === 'takeaway' && 'Abholung'}
                  {order.type === 'delivery' && 'Lieferung'}
                </span>
              </div>
            </div>
          </div>
          {order.customerName && (
            <p className="mt-3 text-white/90 font-medium">{order.customerName}</p>
          )}
        </div>

        {/* Allergy Warning Banner */}
        {hasAllergies && (
          <div className="bg-red-50 border-b border-red-200 px-8 py-3 flex items-center gap-3">
            <AlertOctagon className="w-5 h-5 text-red-600" />
            <span className="text-red-700 font-medium">Achtung: Bestellung enthält Allergene!</span>
          </div>
        )}

        {/* Order View */}
        {view === 'order' && (
          <>
            {/* Items List */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4">
                {order.items.length} Artikel
              </h3>
              <ul className="space-y-3">
                {order.items.map((item, index) => (
                  <li key={index} className="flex items-start gap-4 p-4 bg-stone-50 rounded-xl border border-stone-100">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-saffron text-white font-bold text-lg">
                      {item.quantity}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-char text-lg">{item.name}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${getCategoryColor(item.category)}`}>
                          {item.category === 'main' && 'Hauptgericht'}
                          {item.category === 'side' && 'Beilage'}
                          {item.category === 'drink' && 'Getränk'}
                          {item.category === 'dessert' && 'Dessert'}
                        </span>
                      </div>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <p className="text-sm text-stone-500 mt-1">{item.modifiers.join(', ')}</p>
                      )}
                      {item.notes && (
                        <p className="text-sm text-amber-600 italic mt-1">{item.notes}</p>
                      )}
                      {item.allergies && item.allergies.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <AlertOctagon className="w-4 h-4 text-red-500" />
                          <div className="flex gap-1">
                            {item.allergies.map(code => {
                              const allergy = getAllergyInfo(code)
                              return allergy ? (
                                <span 
                                  key={code}
                                  className={`text-xs font-bold text-white px-1.5 py-0.5 rounded ${allergy.color}`}
                                  title={allergy.name}
                                >
                                  {code}
                                </span>
                              ) : null
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="px-8 py-6 bg-stone-50 border-t border-stone-200">
              <div className="flex gap-4">
                <Button
                  onClick={() => setView('reject')}
                  variant="outline"
                  className="flex-1 h-16 text-lg font-semibold border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-2xl"
                >
                  <X className="w-6 h-6 mr-2" />
                  Ablehnen
                </Button>
                <Button
                  onClick={() => setView('accept')}
                  className="flex-1 h-16 text-lg font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-500/30"
                >
                  <Check className="w-6 h-6 mr-2" />
                  Annehmen
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Accept View - Time Selection */}
        {view === 'accept' && (
          <>
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <button 
                onClick={() => setView('order')}
                className="text-sm text-stone-500 hover:text-stone-700 mb-4 flex items-center gap-1"
              >
                ← Zurück zur Bestellung
              </button>
              <div className="text-center mb-6">
                <ChefHat className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-char">Zubereitungszeit wählen</h3>
                <p className="text-stone-500 mt-1">Wie lange dauert die Zubereitung?</p>
              </div>
              {/* Quick Time Buttons */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {prepTimes.map(time => (
                  <button
                    key={time.value}
                    onClick={() => {
                      setSelectedTime(time.value)
                      setCustomTime('')
                    }}
                    className={`py-5 px-4 rounded-2xl font-bold text-xl transition-all border-2 ${
                      selectedTime === time.value && !customTime
                        ? 'bg-emerald-500 text-white border-emerald-500 scale-105 shadow-lg shadow-emerald-500/30'
                        : 'bg-white text-char border-stone-200 hover:border-emerald-300'
                    }`}
                  >
                    {time.label}
                  </button>
                ))}
              </div>

              {/* Custom Time Input */}
              <div className="bg-stone-100 rounded-2xl p-5 border-2 border-stone-200">
                <label className="block text-sm font-medium text-stone-600 mb-3">
                  Oder eigene Zeit eingeben:
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={customTime}
                    onChange={(e) => {
                      setCustomTime(e.target.value)
                      setSelectedTime(null)
                    }}
                    placeholder="z.B. 25"
                    className="flex-1 h-14 text-2xl font-bold text-center bg-white border-2 border-stone-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                  />
                  <span className="text-xl font-semibold text-stone-500">Minuten</span>
                </div>
              </div>
            </div>
            <div className="px-8 py-6 bg-stone-50 border-t border-stone-200">
              <Button
                onClick={handleAccept}
                disabled={!effectiveTime || effectiveTime <= 0}
                className="w-full h-16 text-lg font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Clock className="w-6 h-6 mr-2" />
                {effectiveTime && effectiveTime > 0 ? `Bestellung starten (${effectiveTime} Min)` : 'Zeit auswählen'}
              </Button>
            </div>
          </>
        )}

        {/* Reject View - Reason Selection */}
        {view === 'reject' && (
          <>
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <button 
                onClick={() => {
                  setView('order')
                  setSelectedReason(null)
                  setUnavailableItems([])
                }}
                className="text-sm text-stone-500 hover:text-stone-700 mb-4 flex items-center gap-1"
              >
                ← Zurück zur Bestellung
              </button>
              <div className="text-center mb-6">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-char">Grund für Ablehnung</h3>
                <p className="text-stone-500 mt-1">Warum kann die Bestellung nicht angenommen werden?</p>
              </div>
              <div className="space-y-2">
                {rejectionReasons.map(reason => (
                  <button
                    key={reason}
                    onClick={() => {
                      setSelectedReason(reason)
                      if (reason !== 'Artikel nicht verfügbar') {
                        setUnavailableItems([])
                      }
                    }}
                    className={`w-full py-4 px-5 rounded-xl font-medium text-left transition-all border-2 ${
                      selectedReason === reason 
                        ? 'bg-red-500 text-white border-red-500' 
                        : 'bg-white text-char border-stone-200 hover:border-red-200'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              {/* Item Selection for "Artikel nicht verfügbar" */}
              {selectedReason === 'Artikel nicht verfügbar' && (
                <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-sm font-medium text-amber-700 mb-3">Welche Artikel sind nicht verfügbar?</p>
                  <div className="space-y-2">
                    {order.items.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => toggleUnavailableItem(item.name)}
                        className={`w-full py-3 px-4 rounded-lg font-medium text-left transition-all flex items-center justify-between ${
                          unavailableItems.includes(item.name)
                            ? 'bg-amber-500 text-white'
                            : 'bg-white text-char border border-amber-200 hover:border-amber-400'
                        }`}
                      >
                        <span>{item.quantity}x {item.name}</span>
                        {unavailableItems.includes(item.name) && <Check className="w-5 h-5" />}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-amber-600 mt-3">
                    Der Kunde wird benachrichtigt und gefragt, ob er Alternativen möchte.
                  </p>
                </div>
              )}
            </div>
            <div className="px-8 py-6 bg-stone-50 border-t border-stone-200">
              <Button
                onClick={handleReject}
                disabled={!selectedReason || (selectedReason === 'Artikel nicht verfügbar' && unavailableItems.length === 0)}
                className="w-full h-16 text-lg font-semibold bg-red-500 hover:bg-red-600 text-white rounded-2xl shadow-lg shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-6 h-6 mr-2" />
                {selectedReason === 'Artikel nicht verfügbar' && unavailableItems.length > 0
                  ? 'Kunde anfragen'
                  : 'Bestellung ablehnen'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
