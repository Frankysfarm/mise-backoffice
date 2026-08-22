'use client'

import { useState, useRef } from 'react'
import { X, Camera, Upload, Check } from 'lucide-react'
import { useDriver } from '@/lib/driver-app/driver-context'
import { ExternalPlatform } from '@/lib/driver-app/types'

interface ExternalOrderModalProps {
  isOpen: boolean
  onClose: () => void
}

const platforms: { id: ExternalPlatform; name: string; color: string }[] = [
  { id: 'uber', name: 'Uber Eats', color: 'bg-black' },
  { id: 'lieferando', name: 'Lieferando', color: 'bg-orange-500' },
  { id: 'wolt', name: 'Wolt', color: 'bg-cyan-500' },
  { id: 'flink', name: 'Flink', color: 'bg-pink-500' },
  { id: 'other', name: 'Andere', color: 'bg-zinc-600' },
]

export function ExternalOrderModal({ isOpen, onClose }: ExternalOrderModalProps) {
  const { addExternalOrder } = useDriver()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [selectedPlatform, setSelectedPlatform] = useState<ExternalPlatform | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [isCash, setIsCash] = useState(false)
  const [receiptImage, setReceiptImage] = useState<string | null>(null)
  
  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setReceiptImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }
  
  const handleSubmit = () => {
    if (!selectedPlatform || !customerName || !customerAddress || !totalAmount) return
    
    addExternalOrder({
      customerName,
      customerAddress,
      customerPhone: customerPhone || 'Nicht angegeben',
      totalAmount: parseFloat(totalAmount),
      paymentMethod: isCash ? 'cash' : 'card',
      platform: selectedPlatform,
      receiptImage: receiptImage || undefined,
    })
    
    // Reset form
    setSelectedPlatform(null)
    setCustomerName('')
    setCustomerAddress('')
    setCustomerPhone('')
    setTotalAmount('')
    setIsCash(false)
    setReceiptImage(null)
    onClose()
  }
  
  const isValid = selectedPlatform && customerName && customerAddress && totalAmount

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end">
      <div className="w-full bg-zinc-900 rounded-t-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Externe Bestellung</h2>
          <button onClick={onClose} className="p-2 text-zinc-400">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-4 space-y-6">
          {/* Platform selection */}
          <div>
            <label className="text-sm text-zinc-400 mb-3 block">Plattform</label>
            <div className="grid grid-cols-3 gap-2">
              {platforms.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => setSelectedPlatform(platform.id)}
                  className={`p-3 rounded-xl text-center transition-all ${
                    selectedPlatform === platform.id
                      ? `${platform.color} text-white ring-2 ring-white`
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  <span className="text-sm font-medium">{platform.name}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Receipt photo */}
          <div>
            <label className="text-sm text-zinc-400 mb-3 block">Kassenbon (optional)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageCapture}
              className="hidden"
            />
            {receiptImage ? (
              <div className="relative">
                <img 
                  src={receiptImage} 
                  alt="Kassenbon" 
                  className="w-full h-40 object-cover rounded-xl"
                />
                <button
                  onClick={() => setReceiptImage(null)}
                  className="absolute top-2 right-2 p-2 bg-black/50 rounded-full"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-zinc-700 rounded-xl flex flex-col items-center justify-center gap-2 text-zinc-500"
              >
                <Camera className="w-8 h-8" />
                <span className="text-sm">Bon fotografieren</span>
              </button>
            )}
          </div>
          
          {/* Customer name */}
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Kundenname *</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Name des Kunden"
              className="w-full h-12 px-4 bg-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          
          {/* Customer address */}
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Lieferadresse *</label>
            <input
              type="text"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder="Strasse, Hausnummer, PLZ Ort"
              className="w-full h-12 px-4 bg-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          
          {/* Customer phone */}
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Telefon (optional)</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+49 ..."
              className="w-full h-12 px-4 bg-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          
          {/* Amount */}
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Betrag *</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-12 px-4 pr-12 bg-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">EUR</span>
            </div>
          </div>
          
          {/* Cash toggle */}
          <div>
            <button
              onClick={() => setIsCash(!isCash)}
              className={`w-full h-14 rounded-xl flex items-center justify-center gap-3 font-medium transition-all ${
                isCash 
                  ? 'bg-amber-500 text-black' 
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {isCash && <Check className="w-5 h-5" />}
              Barzahlung
            </button>
          </div>
        </div>
        
        {/* Submit button */}
        <div className="sticky bottom-0 p-4 bg-zinc-900 border-t border-zinc-800">
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className={`w-full h-14 rounded-xl font-bold text-lg transition-all ${
              isValid 
                ? 'bg-emerald-500 text-white' 
                : 'bg-zinc-800 text-zinc-600'
            }`}
          >
            Bestellung hinzufuegen
          </button>
        </div>
      </div>
    </div>
  )
}
