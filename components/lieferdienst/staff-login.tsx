'use client'

import { useState } from 'react'
import { StaffMember, mockStaff } from '@/lib/lieferdienst/staff'
import { Users, ChefHat, KeyRound, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StaffLoginProps {
  onLogin: (staff: StaffMember) => void
}

export function StaffLogin({ onLogin }: StaffLoginProps) {
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const handlePinDigit = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit
      setPin(newPin)
      setError('')
      
      if (newPin.length === 4 && selectedStaff) {
        if (newPin === selectedStaff.pin) {
          onLogin(selectedStaff)
        } else {
          setError('Falsche PIN')
          setTimeout(() => {
            setPin('')
            setError('')
          }, 1500)
        }
      }
    }
  }

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1))
    setError('')
  }

  const handleBack = () => {
    setSelectedStaff(null)
    setPin('')
    setError('')
  }

  return (
    <div className="min-h-screen bg-[#F8F6F3] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-saffron mb-4">
            <ChefHat className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-char">Mise KDS</h1>
          <p className="text-steel">Küchen Display System</p>
        </div>

        {!selectedStaff ? (
          /* Staff Selection */
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-char mb-5 flex items-center gap-2">
              <Users className="w-5 h-5 text-saffron" />
              Mitarbeiter auswählen
            </h2>
            <div className="space-y-2">
              {mockStaff.filter(s => s.active).map(staff => (
                <button
                  key={staff.id}
                  onClick={() => setSelectedStaff(staff)}
                  className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-stone-200 hover:border-saffron/50 hover:bg-saffron/5 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">
                      <span className="text-lg font-bold text-stone-500">
                        {staff.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-char">{staff.name}</p>
                      <p className="text-sm text-steel capitalize">{staff.role}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-stone-400 group-hover:text-saffron transition-colors" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* PIN Entry */
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-lg">
            <button 
              onClick={handleBack}
              className="mb-4 text-sm text-steel hover:text-char transition-colors flex items-center gap-1"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              Zurück
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-3">
                <span className="text-xl font-bold text-stone-500">
                  {selectedStaff.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-char">{selectedStaff.name}</h2>
              <p className="text-sm text-steel">PIN eingeben</p>
            </div>

            {/* PIN Display */}
            <div className="flex justify-center gap-3 mb-6">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center transition-all ${
                    error 
                      ? 'border-red-300 bg-red-50' 
                      : pin.length > i 
                        ? 'border-saffron bg-saffron/10' 
                        : 'border-stone-200'
                  }`}
                >
                  {pin.length > i && (
                    <div className={`w-3 h-3 rounded-full ${error ? 'bg-red-500' : 'bg-saffron'}`} />
                  )}
                </div>
              ))}
            </div>

            {error && (
              <p className="text-center text-sm text-red-600 font-medium mb-4 animate-pulse">{error}</p>
            )}

            {/* Number Pad */}
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key, i) => (
                <div key={i} className="aspect-square">
                  {key === '' ? (
                    <div />
                  ) : key === 'del' ? (
                    <button
                      onClick={handleDelete}
                      className="w-full h-full rounded-xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center transition-colors"
                    >
                      <X className="w-6 h-6 text-stone-600" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePinDigit(key)}
                      className="w-full h-full rounded-xl bg-stone-100 hover:bg-saffron hover:text-white text-2xl font-semibold text-char transition-all"
                    >
                      {key}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-sm text-steel mt-6">
          Hinweis: Test-PIN ist 1234, 5678, 9012, etc.
        </p>
      </div>
    </div>
  )
}
