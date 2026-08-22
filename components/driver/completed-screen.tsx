'use client'

import { CheckCircle } from 'lucide-react'
import { useDriver } from '@/lib/driver-app/driver-context'
import { useEffect } from 'react'

export function CompletedScreen() {
  const { resetToWaiting } = useDriver()

  useEffect(() => {
    const timer = setTimeout(() => {
      resetToWaiting()
    }, 3000)
    return () => clearTimeout(timer)
  }, [resetToWaiting])

  return (
    <div className="flex flex-col items-center justify-center h-full bg-zinc-950 p-6">
      <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6">
        <CheckCircle className="w-12 h-12 text-emerald-500" />
      </div>
      
      <h1 className="text-2xl font-bold text-white mb-2">Alle Lieferungen fertig</h1>
      <p className="text-zinc-500 text-center">Zurück zum Warten auf neue Bestellungen...</p>
    </div>
  )
}
