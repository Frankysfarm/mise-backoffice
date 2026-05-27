'use client'

import { useState } from 'react'
import { Order, OrderItem, OrderStatus } from '@/lib/lieferdienst/orders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { 
  Phone, Plus, Trash2, User, MapPin, Clock, 
  Users, Package, Truck, Send, X
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ManualOrderFormProps {
  onSubmit: (order: Order) => void
  onCancel: () => void
}

let manualOrderCounter = 500

export function ManualOrderForm({ onSubmit, onCancel }: ManualOrderFormProps) {
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('takeaway')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [table, setTable] = useState('')
  const [address, setAddress] = useState('')
  const [estimatedTime, setEstimatedTime] = useState(20)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<{ name: string; quantity: number; notes: string }[]>([
    { name: '', quantity: 1, notes: '' }
  ])

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, notes: '' }])
  }

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const updateItem = (index: number, field: string, value: string | number) => {
    setItems(items.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ))
  }

  const handleSubmit = () => {
    // Filter out empty items
    const validItems = items.filter(item => item.name.trim())
    if (validItems.length === 0) return

    const orderItems: OrderItem[] = validItems.map((item, index) => ({
      id: `manual-${manualOrderCounter}-${index}`,
      name: item.name,
      quantity: item.quantity,
      notes: item.notes || undefined,
      category: 'main' as const, // Default category
    }))

    const order: Order = {
      id: `manual-order-${manualOrderCounter}`,
      orderNumber: `#${String(manualOrderCounter).padStart(4, '0')}`,
      type: orderType,
      items: orderItems,
      status: 'accepted' as OrderStatus,
      createdAt: new Date(),
      acceptedAt: new Date(),
      estimatedTime,
      customerName: customerName || 'Telefonbestellung',
      customerPhone: customerPhone || undefined,
      table: orderType === 'dine_in' ? table : undefined,
    }

    manualOrderCounter++
    onSubmit(order)
  }

  const isValid = items.some(item => item.name.trim())

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-lg overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-saffron to-saffron-deep px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Phone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white text-lg">Telefonbestellung</h2>
            <p className="text-white/80 text-xs">Bestellung manuell aufnehmen</p>
          </div>
        </div>
        <button 
          onClick={onCancel}
          className="p-2 hover:bg-white/20 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Order Type */}
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-2">Bestellart</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'dine_in', label: 'Vor Ort', icon: Users },
              { value: 'takeaway', label: 'Abholung', icon: Package },
              { value: 'delivery', label: 'Lieferung', icon: Truck },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setOrderType(value as typeof orderType)}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all ${
                  orderType === value
                    ? 'bg-saffron/10 border-saffron text-saffron'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Customer Info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1.5">Kundenname</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Name"
                className="pl-9 h-11 rounded-xl"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1.5">Telefon</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+43 ..."
                className="pl-9 h-11 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Table (for dine_in) */}
        {orderType === 'dine_in' && (
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1.5">Tischnummer</label>
            <Input
              value={table}
              onChange={(e) => setTable(e.target.value)}
              placeholder="z.B. T05"
              className="h-11 rounded-xl"
            />
          </div>
        )}

        {/* Address (for delivery) */}
        {orderType === 'delivery' && (
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1.5">Lieferadresse</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
              <Textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Straße, Hausnummer, PLZ Ort"
                className="pl-9 min-h-[70px] rounded-xl resize-none"
              />
            </div>
          </div>
        )}

        {/* Estimated Time */}
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1.5">Zubereitungszeit</label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Select value={String(estimatedTime)} onValueChange={(v) => setEstimatedTime(Number(v))}>
              <SelectTrigger className="pl-9 h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 15, 20, 25, 30, 45, 60].map(min => (
                  <SelectItem key={min} value={String(min)}>{min} Minuten</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-stone-600">Artikel</label>
            <button
              onClick={addItem}
              className="text-xs font-medium text-saffron hover:text-saffron-deep flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Hinzufügen
            </button>
          </div>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                  type="number"
                  min="1"
                  className="w-16 h-11 rounded-xl text-center font-semibold"
                />
                <Input
                  value={item.name}
                  onChange={(e) => updateItem(index, 'name', e.target.value)}
                  placeholder="Artikelname"
                  className="flex-1 h-11 rounded-xl"
                />
                <Input
                  value={item.notes}
                  onChange={(e) => updateItem(index, 'notes', e.target.value)}
                  placeholder="Notiz"
                  className="w-28 h-11 rounded-xl text-sm"
                />
                {items.length > 1 && (
                  <button
                    onClick={() => removeItem(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* General Notes */}
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1.5">Allgemeine Notizen</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Besondere Hinweise..."
            className="min-h-[60px] rounded-xl resize-none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-stone-200 bg-stone-50">
        <Button
          onClick={handleSubmit}
          disabled={!isValid}
          className="w-full h-12 bg-saffron hover:bg-saffron-deep text-white font-semibold rounded-xl shadow-lg shadow-saffron/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5 mr-2" />
          Bestellung aufnehmen
        </Button>
      </div>
    </div>
  )
}
