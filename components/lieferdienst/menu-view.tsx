'use client'

import { useState } from 'react'
import { MenuItem, allergies, getAllergyInfo } from '@/lib/lieferdienst/menu'
import { 
  Search, UtensilsCrossed, Flame, Salad, Wine, Cake,
  CheckCircle, XCircle, AlertTriangle
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

interface MenuViewProps {
  menuItems: MenuItem[]
  onToggleAvailability: (itemId: string) => void
}

const categoryConfig = {
  main: { icon: Flame, label: 'Hauptgerichte', color: 'saffron' },
  side: { icon: Salad, label: 'Beilagen', color: 'teal' },
  drink: { icon: Wine, label: 'Getränke', color: 'blue' },
  dessert: { icon: Cake, label: 'Desserts', color: 'pink' },
}

export function MenuView({ menuItems, onToggleAvailability }: MenuViewProps) {
  const [search, setSearch] = useState('')
  const [showOnlyUnavailable, setShowOnlyUnavailable] = useState(false)

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = search === '' || 
      item.name.toLowerCase().includes(search.toLowerCase())
    const matchesAvailability = !showOnlyUnavailable || !item.available
    return matchesSearch && matchesAvailability
  })

  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, MenuItem[]>)

  const unavailableCount = menuItems.filter(i => !i.available).length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-char">Artikelverfügbarkeit</h1>
          <p className="text-steel">
            {menuItems.length} Artikel, {unavailableCount} ausverkauft
          </p>
        </div>
        {unavailableCount > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">{unavailableCount} Ausverkauft</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            type="text"
            placeholder="Artikel suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl border-stone-200"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch 
            checked={showOnlyUnavailable}
            onCheckedChange={setShowOnlyUnavailable}
          />
          <span className="text-sm font-medium text-stone-600">Nur Ausverkaufte</span>
        </label>
      </div>

      {/* Categories */}
      <div className="space-y-8">
        {(['main', 'side', 'drink', 'dessert'] as const).map(category => {
          const items = groupedItems[category]
          if (!items || items.length === 0) return null
          
          const config = categoryConfig[category]
          const Icon = config.icon
          
          return (
            <div key={category}>
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  category === 'main' ? 'bg-saffron/10' :
                  category === 'side' ? 'bg-teal-500/10' :
                  category === 'drink' ? 'bg-blue-500/10' :
                  'bg-pink-500/10'
                }`}>
                  <Icon className={`w-4 h-4 ${
                    category === 'main' ? 'text-saffron' :
                    category === 'side' ? 'text-teal-500' :
                    category === 'drink' ? 'text-blue-500' :
                    'text-pink-500'
                  }`} />
                </div>
                <h2 className="text-lg font-semibold text-char">{config.label}</h2>
                <span className="text-sm text-steel">({items.length})</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {items.map(item => (
                  <div 
                    key={item.id}
                    className={`bg-white rounded-xl border-2 p-4 transition-all ${
                      item.available 
                        ? 'border-stone-200 hover:border-stone-300' 
                        : 'border-red-200 bg-red-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-medium ${item.available ? 'text-char' : 'text-red-700'}`}>
                          {item.name}
                        </h3>
                        <p className="text-sm text-steel mt-0.5">
                          {item.price.toFixed(2).replace('.', ',')} EUR
                        </p>
                        
                        {/* Allergies */}
                        {item.allergies && item.allergies.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
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
                        )}
                      </div>
                      
                      <button
                        onClick={() => onToggleAvailability(item.id)}
                        className={`flex-shrink-0 p-2 rounded-xl transition-all ${
                          item.available
                            ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                            : 'bg-red-100 text-red-600 hover:bg-red-200'
                        }`}
                      >
                        {item.available ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    
                    {!item.available && (
                      <div className="mt-3 pt-3 border-t border-red-200">
                        <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">Ausverkauft</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Allergy Legend */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <h3 className="text-sm font-semibold text-char mb-3">Allergene Legende</h3>
        <div className="flex flex-wrap gap-2">
          {allergies.map(allergy => (
            <span 
              key={allergy.code}
              className={`text-xs font-medium text-white px-2 py-1 rounded-lg ${allergy.color}`}
            >
              {allergy.code}: {allergy.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
