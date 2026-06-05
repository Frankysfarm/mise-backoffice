'use client'

import { useState } from 'react'
import { Order, OrderStatus, OrderItem, prepTimes, rejectionReasons, cancellationReasons } from '@/lib/lieferdienst/orders'
import { 
  Users, Package, Truck, Check, Clock, User, Phone, 
  X, AlertTriangle, Timer, PhoneCall, MessageSquare, ChefHat, 
  Zap, Crown, AlertOctagon
} from 'lucide-react'
import { getAllergyInfo } from '@/lib/lieferdienst/menu'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface OrderCardProps {
  order: Order
  currentTime: Date
  onAccept: (orderId: string, estimatedTime: number) => void
  onReject: (orderId: string, reason: string, unavailableItems?: string[]) => void
  onMarkDone: (orderId: string) => void
  onCustomerResponded: (orderId: string) => void
  onCancel: (orderId: string, reason: string) => void
}

function getTimeSince(date: Date, now: Date): { text: string; urgent: boolean; warning: boolean } {
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return { text: 'Jetzt', urgent: false, warning: false }
  if (diffMins === 1) return { text: '1 Min', urgent: false, warning: false }
  return { 
    text: `${diffMins} Min`, 
    urgent: diffMins >= 10, 
    warning: diffMins >= 5 && diffMins < 10 
  }
}

function getTypeConfig(type: Order['type']) {
  switch (type) {
    case 'dine_in': 
      return { 
        icon: Users, 
        label: 'Vor Ort', 
        bg: 'bg-emerald-50', 
        border: 'border-emerald-200',
        text: 'text-emerald-700',
        dot: 'bg-emerald-500'
      }
    case 'takeaway': 
      return { 
        icon: Package, 
        label: 'Abholung', 
        bg: 'bg-amber-50', 
        border: 'border-amber-200',
        text: 'text-amber-700',
        dot: 'bg-amber-500'
      }
    case 'delivery': 
      return { 
        icon: Truck, 
        label: 'Lieferung', 
        bg: 'bg-violet-50', 
        border: 'border-violet-200',
        text: 'text-violet-700',
        dot: 'bg-violet-500'
      }
  }
}

function getCategoryConfig(category: OrderItem['category']) {
  switch (category) {
    case 'main': return { bg: 'bg-saffron', text: 'text-white' }
    case 'side': return { bg: 'bg-teal-500', text: 'text-white' }
    case 'drink': return { bg: 'bg-blue-500', text: 'text-white' }
    case 'dessert': return { bg: 'bg-pink-500', text: 'text-white' }
  }
}

export function OrderCard({ 
  order, 
  currentTime, 
  onAccept, 
  onReject, 
  onMarkDone,
  onCustomerResponded,
  onCancel
}: OrderCardProps) {
  const [showAcceptDialog, setShowAcceptDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [selectedTime, setSelectedTime] = useState<number | null>(null)
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [selectedCancelReason, setSelectedCancelReason] = useState<string | null>(null)
  const [unavailableItems, setUnavailableItems] = useState<string[]>([])
  
  const timeInfo = getTimeSince(new Date(order.createdAt), currentTime)
  const typeConfig = getTypeConfig(order.type)
  const TypeIcon = typeConfig.icon
  
  const waitingTime = order.waitingForCustomerSince 
    ? Math.floor((currentTime.getTime() - order.waitingForCustomerSince.getTime()) / 60000)
    : 0

  // Countdown Timer berechnen
  const getCountdown = () => {
    if (order.status !== 'accepted' || !order.acceptedAt || !order.estimatedTime) return null
    const targetTime = new Date(new Date(order.acceptedAt).getTime() + order.estimatedTime * 60000)
    const remainingMs = targetTime.getTime() - currentTime.getTime()
    const remainingMins = Math.ceil(remainingMs / 60000)
    return {
      minutes: remainingMins,
      isOverdue: remainingMins <= 0,
      isUrgent: remainingMins > 0 && remainingMins <= 3,
      percentage: Math.max(0, Math.min(100, (1 - remainingMs / (order.estimatedTime * 60000)) * 100))
    }
  }
  const countdown = getCountdown()

  // Check for any allergies in items
  const hasAllergies = order.items.some(item => item.allergies && item.allergies.length > 0)

  const handleAccept = () => {
    if (selectedTime) {
      onAccept(order.id, selectedTime)
      setShowAcceptDialog(false)
      setSelectedTime(null)
    }
  }

  const handleReject = () => {
    if (selectedReason === 'Artikel nicht verfügbar' && unavailableItems.length > 0) {
      onReject(order.id, selectedReason, unavailableItems)
    } else if (selectedReason) {
      onReject(order.id, selectedReason)
    }
    setShowRejectDialog(false)
    setSelectedReason(null)
    setUnavailableItems([])
  }

  const toggleUnavailableItem = (itemName: string) => {
    setUnavailableItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(i => i !== itemName)
        : [...prev, itemName]
    )
  }

  const handleCancel = () => {
    if (selectedCancelReason) {
      onCancel(order.id, selectedCancelReason)
      setShowCancelDialog(false)
      setSelectedCancelReason(null)
    }
  }

  const cardBorderClass = 
    order.status === 'pending' ? 'border-saffron shadow-lg shadow-saffron/10' :
    order.status === 'accepted' ? 'border-emerald-300 shadow-md' :
    order.status === 'waiting_customer' ? 'border-amber-300 shadow-md' :
    order.status === 'call_customer' ? 'border-red-400 shadow-lg shadow-red-500/20' :
    'border-stone-200'

  return (
    <>
      <div className={`flex flex-col bg-white rounded-2xl overflow-hidden border-2 transition-all animate-slide-in ${cardBorderClass}`}>
        {/* Header */}
        <div className={`px-4 py-3 ${
          order.status === 'pending' ? 'bg-gradient-to-r from-saffron to-orange-400' :
          order.status === 'accepted' ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
          order.status === 'waiting_customer' ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
          order.status === 'call_customer' ? 'bg-gradient-to-r from-red-500 to-red-400' :
          'bg-stone-100'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`font-mono font-bold text-lg ${order.status === 'pending' || order.status === 'accepted' || order.status === 'waiting_customer' || order.status === 'call_customer' ? 'text-white' : 'text-char'}`}>
                {order.orderNumber}
              </span>
              {order.table && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${order.status === 'pending' || order.status === 'accepted' || order.status === 'waiting_customer' || order.status === 'call_customer' ? 'bg-white/20 text-white' : 'bg-stone-200 text-char'}`}>
                  {order.table}
                </span>
              )}
              {/* Priority Badge */}
              {order.priority === 'vip' && (
                <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md bg-amber-400 text-amber-900">
                  <Crown className="w-3 h-3" />
                  VIP
                </span>
              )}
              {order.priority === 'express' && (
                <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md bg-violet-500 text-white">
                  <Zap className="w-3 h-3" />
                  EXPRESS
                </span>
              )}
              {order.priority === 'rush' && (
                <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md bg-red-500 text-white animate-pulse">
                  <Zap className="w-3 h-3" />
                  EILIG
                </span>
              )}
            </div>
            <div className={`flex items-center gap-1.5 text-sm font-medium ${
              order.status === 'pending' || order.status === 'accepted' || order.status === 'waiting_customer' || order.status === 'call_customer' 
                ? timeInfo.urgent ? 'text-white bg-white/20 px-2 py-0.5 rounded-md' : 'text-white/90'
                : timeInfo.urgent ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded-md' : 'text-stone-500'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              <span className="font-mono">{timeInfo.text}</span>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        {order.status !== 'pending' && (
          <div className={`px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 ${
            order.status === 'accepted' ? 'bg-emerald-50 text-emerald-700' :
            order.status === 'waiting_customer' ? 'bg-amber-50 text-amber-700' :
            order.status === 'call_customer' ? 'bg-red-50 text-red-700 animate-pulse' :
            'bg-stone-50 text-stone-600'
          }`}>
            {order.status === 'accepted' && countdown && (
              <div className="w-full">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Timer className={`w-4 h-4 ${countdown.isOverdue ? 'text-red-600' : countdown.isUrgent ? 'text-amber-600' : ''}`} />
                  <span className={countdown.isOverdue ? 'text-red-600 font-bold' : countdown.isUrgent ? 'text-amber-600 font-bold' : ''}>
                    {countdown.isOverdue ? 'Überfällig!' : `Noch ${countdown.minutes} Min`}
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-emerald-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      countdown.isOverdue ? 'bg-red-500' : countdown.isUrgent ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${countdown.percentage}%` }}
                  />
                </div>
                {/* Exact finish time */}
                {!countdown.isOverdue && order.acceptedAt && order.estimatedTime && (
                  <div className="text-center text-[10px] text-emerald-600 font-mono mt-1.5 tabular-nums">
                    Fertig bis {new Date(new Date(order.acceptedAt).getTime() + order.estimatedTime * 60000)
                      .toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                  </div>
                )}
              </div>
            )}
            {order.status === 'waiting_customer' && (
              <>
                <MessageSquare className="w-4 h-4" />
                <span>Warten auf Kundenantwort ({waitingTime} Min)</span>
              </>
            )}
            {order.status === 'call_customer' && (
              <>
                <PhoneCall className="w-4 h-4" />
                <span>Bitte Kunde anrufen!</span>
              </>
            )}
          </div>
        )}

        {/* Type & Customer */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-stone-100">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${typeConfig.bg} ${typeConfig.border} ${typeConfig.text}`}>
            <TypeIcon className="w-3.5 h-3.5" />
            {typeConfig.label}
          </span>
          {order.customerName && (
            <span className="flex items-center gap-1.5 text-sm text-stone-500">
              <User className="w-3.5 h-3.5" />
              {order.customerName}
            </span>
          )}
        </div>

        {/* Call Customer */}
        {(order.status === 'call_customer') && order.customerPhone && (
          <div className="px-4 py-3 bg-red-50 border-b border-red-100">
            <a 
              href={`tel:${order.customerPhone.replace(/\s/g, '')}`}
              className="flex items-center justify-center gap-2 w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              <Phone className="w-5 h-5" />
              <span>{order.customerPhone}</span>
            </a>
          </div>
        )}

        {/* Unavailable Items Warning */}
        {order.unavailableItems && order.unavailableItems.length > 0 && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-amber-700">
              <span className="font-medium">Nicht verfügbar:</span> {order.unavailableItems.join(', ')}
            </span>
          </div>
        )}

        {/* Items */}
        <div className="flex-1 px-4 py-3">
          <ul className="space-y-2">
            {order.items.map(item => {
              const catConfig = getCategoryConfig(item.category)
              return (
                <li 
                  key={item.id} 
                  className={`flex items-start gap-3 ${item.unavailable ? 'opacity-40' : ''}`}
                >
                  <span className={`font-mono text-xs font-bold min-w-[28px] h-6 flex items-center justify-center rounded-md ${catConfig.bg} ${catConfig.text}`}>
                    {item.quantity}x
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium text-char ${item.unavailable ? 'line-through' : ''}`}>
                      {item.name}
                    </span>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <p className="text-xs text-teal-600 mt-0.5">+ {item.modifiers.join(', ')}</p>
                    )}
                    {item.notes && (
                      <p className="text-xs text-amber-600 italic mt-0.5">{item.notes}</p>
                    )}
                    {/* Allergy Warning */}
                    {item.allergies && item.allergies.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertOctagon className="w-3 h-3 text-red-500" />
                        <div className="flex gap-0.5">
                          {item.allergies.map(code => {
                            const allergy = getAllergyInfo(code)
                            return allergy ? (
                              <span 
                                key={code}
                                className={`text-[10px] font-bold text-white px-1 py-0.5 rounded ${allergy.color}`}
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
              )
            })}
          </ul>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-stone-100 bg-stone-50/50">
          {/* Order total */}
          {((order as any).totalAmount ?? (order as any).gesamtbetrag ?? 0) > 0 && (
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs text-stone-400 font-medium">Gesamt</span>
              <span className="text-sm font-mono font-bold text-emerald-700 tabular-nums">
                {((order as any).totalAmount ?? (order as any).gesamtbetrag ?? 0)
                  .toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
            </div>
          )}
          {order.status === 'pending' && (
            <div className="flex gap-2">
              <Button
                onClick={() => setShowRejectDialog(true)}
                variant="outline"
                className="flex-1 h-11 border-stone-300 text-stone-600 hover:bg-stone-100 hover:text-stone-800 font-medium rounded-xl"
              >
                <X className="w-4 h-4 mr-1.5" />
                Ablehnen
              </Button>
              <Button
                onClick={() => setShowAcceptDialog(true)}
                className="flex-1 h-11 bg-saffron hover:bg-saffron-deep text-white font-medium rounded-xl shadow-md shadow-saffron/25"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Annehmen
              </Button>
            </div>
          )}

          {order.status === 'accepted' && (
            <Button
              onClick={() => onMarkDone(order.id)}
              className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl shadow-md shadow-emerald-500/25"
            >
              <ChefHat className="w-4 h-4 mr-1.5" />
              Fertig
            </Button>
          )}

          {(order.status === 'waiting_customer' || order.status === 'call_customer') && (
            <div className="flex gap-2">
              <Button
                onClick={() => setShowCancelDialog(true)}
                variant="outline"
                className="flex-1 h-11 border-red-200 text-red-600 hover:bg-red-50 font-medium rounded-xl"
              >
                <X className="w-4 h-4 mr-1.5" />
                Stornieren
              </Button>
              <Button
                onClick={() => onCustomerResponded(order.id)}
                className="flex-1 h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Antwort erhalten
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Accept Dialog */}
      <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <DialogContent className="bg-white border border-stone-200 rounded-2xl max-w-md p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-saffron to-orange-400 px-6 py-5">
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Timer className="w-6 h-6" />
              Zubereitungszeit wählen
            </DialogTitle>
            <DialogDescription className="text-white/80 mt-1">
              Bestellung {order.orderNumber}
            </DialogDescription>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-3 gap-2">
              {prepTimes.map(time => (
                <button
                  key={time.value}
                  onClick={() => setSelectedTime(time.value)}
                  className={`py-4 px-3 rounded-xl font-semibold text-lg transition-all border-2 ${
                    selectedTime === time.value 
                      ? 'bg-saffron text-white border-saffron shadow-lg shadow-saffron/25 scale-105' 
                      : 'bg-stone-50 text-char border-stone-200 hover:border-saffron/50'
                  }`}
                >
                  {time.label}
                </button>
              ))}
            </div>
            <Button
              onClick={handleAccept}
              disabled={!selectedTime}
              className="w-full mt-6 h-14 bg-saffron hover:bg-saffron-deep text-white font-semibold text-lg rounded-xl disabled:opacity-50 shadow-lg shadow-saffron/25"
            >
              <Check className="w-5 h-5 mr-2" />
              Bestellung annehmen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="bg-white border border-stone-200 rounded-2xl max-w-md p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-red-500 to-red-400 px-6 py-5">
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <X className="w-6 h-6" />
              Bestellung ablehnen
            </DialogTitle>
            <DialogDescription className="text-white/80 mt-1">
              Bestellung {order.orderNumber}
            </DialogDescription>
          </div>
          <div className="p-6">
            <p className="text-sm font-medium text-stone-600 mb-3">Grund auswählen:</p>
            <div className="space-y-2">
              {rejectionReasons.map(reason => (
                <button
                  key={reason}
                  onClick={() => setSelectedReason(reason)}
                  className={`w-full py-3 px-4 rounded-xl font-medium text-left transition-all border-2 ${
                    selectedReason === reason 
                      ? 'bg-red-500 text-white border-red-500' 
                      : 'bg-stone-50 text-char border-stone-200 hover:border-red-200'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            {selectedReason === 'Artikel nicht verfügbar' && (
              <div className="mt-5 pt-5 border-t border-stone-200">
                <p className="text-sm font-medium text-stone-600 mb-3">Welche Artikel sind nicht verfügbar?</p>
                <div className="space-y-2">
                  {order.items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => toggleUnavailableItem(item.name)}
                      className={`w-full py-3 px-4 rounded-xl text-left transition-all border-2 flex items-center gap-3 ${
                        unavailableItems.includes(item.name) 
                          ? 'bg-amber-50 border-amber-300 text-amber-800' 
                          : 'bg-white border-stone-200 hover:border-amber-200'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                        unavailableItems.includes(item.name) ? 'bg-amber-500 border-amber-500' : 'border-stone-300'
                      }`}>
                        {unavailableItems.includes(item.name) && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span className="font-medium">{item.quantity}x {item.name}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-start gap-2 mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700">
                    Der Kunde wird gefragt, ob er ohne diese Artikel bestellen möchte.
                  </p>
                </div>
              </div>
            )}

            <Button
              onClick={handleReject}
              disabled={!selectedReason || (selectedReason === 'Artikel nicht verfügbar' && unavailableItems.length === 0)}
              className="w-full mt-6 h-14 bg-red-500 hover:bg-red-600 text-white font-semibold text-lg rounded-xl disabled:opacity-50"
            >
              <X className="w-5 h-5 mr-2" />
              {selectedReason === 'Artikel nicht verfügbar' ? 'Kunde anfragen' : 'Ablehnen'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="bg-white border border-stone-200 rounded-2xl max-w-md p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-red-500 to-red-400 px-6 py-5">
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              Bestellung stornieren
            </DialogTitle>
            <DialogDescription className="text-white/80 mt-1">
              Bestellung {order.orderNumber} - Bitte Grund angeben
            </DialogDescription>
          </div>
          <div className="p-6">
            <p className="text-sm font-medium text-stone-600 mb-3">Warum wird storniert?</p>
            <div className="space-y-2">
              {cancellationReasons.map(reason => (
                <button
                  key={reason}
                  onClick={() => setSelectedCancelReason(reason)}
                  className={`w-full py-3 px-4 rounded-xl font-medium text-left transition-all border-2 ${
                    selectedCancelReason === reason 
                      ? 'bg-red-500 text-white border-red-500' 
                      : 'bg-stone-50 text-char border-stone-200 hover:border-red-200'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <Button
              onClick={handleCancel}
              disabled={!selectedCancelReason}
              className="w-full mt-6 h-14 bg-red-500 hover:bg-red-600 text-white font-semibold text-lg rounded-xl disabled:opacity-50"
            >
              <X className="w-5 h-5 mr-2" />
              Bestellung stornieren
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
