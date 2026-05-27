'use client'

import { useEffect, useState } from 'react'
import { Driver } from '@/lib/lieferdienst/drivers'
import { Car, X, Clock } from 'lucide-react'

interface DriverReturningBannerProps {
  drivers: Driver[]
  onDismiss: () => void
  dismissed: boolean
}

export function DriverReturningBanner({ drivers, onDismiss, dismissed }: DriverReturningBannerProps) {
  const [isVisible, setIsVisible] = useState(false)
  
  const returningDrivers = drivers.filter(d => d.status === 'returning')
  const hasReturningDriver = returningDrivers.length > 0
  
  useEffect(() => {
    if (hasReturningDriver && !dismissed) {
      setIsVisible(true)
    } else {
      setIsVisible(false)
    }
  }, [hasReturningDriver, dismissed])

  if (!isVisible || returningDrivers.length === 0) return null

  const firstReturning = returningDrivers[0]
  
  // Calculate minutes until return
  const getMinutesUntilReturn = (driver: Driver) => {
    if (!driver.estimatedReturn) return null
    const now = new Date()
    const diffMs = driver.estimatedReturn.getTime() - now.getTime()
    return Math.max(1, Math.ceil(diffMs / 60000))
  }

  const minutesUntilReturn = getMinutesUntilReturn(firstReturning)

  return (
    <div className="fixed top-0 left-0 right-0 z-40 animate-slide-down">
      <div className="bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 shadow-xl shadow-green-500/30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Animated Icon */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                  <Car className="w-8 h-8 text-white animate-bounce" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                  <span className="text-xs font-bold text-green-600">{returningDrivers.length}</span>
                </div>
              </div>

              {/* Text */}
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">
                  Fahrer ist auf dem Weg!
                </h2>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-white/90 text-lg font-medium">
                    {firstReturning.name}
                  </span>
                  {minutesUntilReturn && (
                    <div className="flex items-center gap-1.5 text-white/80">
                      <Clock className="w-4 h-4" />
                      <span>ca. {minutesUntilReturn} Min</span>
                    </div>
                  )}
                  
                </div>
              </div>
            </div>

            {/* Multiple drivers indicator */}
            {returningDrivers.length > 1 && (
              <div className="hidden md:block text-right mr-4">
                <p className="text-white/80 text-sm">
                  +{returningDrivers.length - 1} weitere{returningDrivers.length > 2 ? '' : 'r'} Fahrer
                </p>
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={onDismiss}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Progress bar animation */}
        <div className="h-1 bg-white/20">
          <div className="h-full bg-white/50 animate-pulse" style={{ width: '100%' }} />
        </div>
      </div>
    </div>
  )
}
