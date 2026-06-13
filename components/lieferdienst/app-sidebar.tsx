'use client'

import {
  ChefHat, BarChart3, History, UtensilsCrossed, Users,
  StickyNote, Settings, LogOut, Flame, Salad, Wine, Cake, Car, Flag
} from 'lucide-react'
import { Language } from '@/lib/lieferdienst/translations'
import { StaffMember } from '@/lib/lieferdienst/staff'
import { Station } from '@/lib/lieferdienst/staff'

interface AppSidebarProps {
  currentView: 'orders' | 'stats' | 'history' | 'menu' | 'staff' | 'notes' | 'drivers' | 'reviews'
  onViewChange: (view: 'orders' | 'stats' | 'history' | 'menu' | 'staff' | 'notes' | 'drivers' | 'reviews') => void
  currentStation: Station
  onStationChange: (station: Station) => void
  currentStaff: StaffMember | null
  onLogout: () => void
  language: Language
  stats: { total: number; accepted: number; waiting: number }
  activeDrivers?: number
}

const stationIcons = {
  all: ChefHat,
  grill: Flame,
  salads: Salad,
  drinks: Wine,
  desserts: Cake,
}

export function AppSidebar({
  currentView,
  onViewChange,
  currentStation,
  onStationChange,
  currentStaff,
  onLogout,
  stats,
  activeDrivers = 0,
}: AppSidebarProps) {
  const navItems = [
    { key: 'orders' as const, icon: ChefHat, label: 'Bestellungen', badge: stats.total },
    { key: 'drivers' as const, icon: Car, label: 'Fahrer', badge: activeDrivers },
    { key: 'stats' as const, icon: BarChart3, label: 'Statistiken' },
    { key: 'history' as const, icon: History, label: 'Historie' },
    { key: 'menu' as const, icon: UtensilsCrossed, label: 'Artikel' },
    { key: 'notes' as const, icon: StickyNote, label: 'Notizen' },
    { key: 'reviews' as const, icon: Flag, label: 'Fahrer-Reviews', badge: undefined as number | undefined },
  ]

  const stationItems = [
    { key: 'all' as const, label: 'Alle' },
    { key: 'grill' as const, label: 'Grill' },
    { key: 'salads' as const, label: 'Salate' },
    { key: 'drinks' as const, label: 'Getränke' },
    { key: 'desserts' as const, label: 'Desserts' },
  ]

  return (
    <aside className="hidden md:flex w-20 lg:w-64 bg-white border-r border-stone-200 flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-4 lg:p-5 border-b border-stone-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-saffron flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-white">m</span>
          </div>
          <div className="hidden lg:block">
            <h1 className="text-lg font-bold text-char tracking-tight">Mise KDS</h1>
            <p className="text-xs text-steel">Küchen Display</p>
          </div>
        </div>
      </div>

      {/* Staff Info */}
      {currentStaff && (
        <div className="p-3 lg:p-4 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="hidden lg:block flex-1 min-w-0">
              <p className="text-sm font-medium text-char truncate">{currentStaff.name}</p>
              <p className="text-xs text-steel capitalize">{currentStaff.role}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 lg:p-4 space-y-1 overflow-y-auto">
        <p className="hidden lg:block text-xs font-semibold text-steel uppercase tracking-wider px-3 mb-2">Navigation</p>
        {navItems.map(item => {
          const Icon = item.icon
          const isActive = currentView === item.key
          return (
            <button
              key={item.key}
              onClick={() => onViewChange(item.key)}
              className={`w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-3 rounded-xl transition-all ${
                isActive 
                  ? 'bg-saffron text-white shadow-lg shadow-saffron/25' 
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="hidden lg:block font-medium">{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className={`hidden lg:flex ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-saffron/10 text-saffron'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}

        {/* Station Filter */}
        {currentView === 'orders' && (
          <>
            <div className="pt-4 pb-2">
              <p className="hidden lg:block text-xs font-semibold text-steel uppercase tracking-wider px-3 mb-2">Station</p>
            </div>
            {stationItems.map(station => {
              const Icon = stationIcons[station.key]
              const isActive = currentStation === station.key
              return (
                <button
                  key={station.key}
                  onClick={() => onStationChange(station.key)}
                  className={`w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    isActive 
                      ? 'bg-emerald-500 text-white' 
                      : 'text-stone-500 hover:bg-stone-100'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden lg:block text-sm font-medium">{station.label}</span>
                </button>
              )
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 lg:p-4 border-t border-stone-200 space-y-1">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 rounded-xl text-stone-500 hover:bg-stone-100 transition-all"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className="hidden lg:block text-sm font-medium">Abmelden</span>
        </button>
      </div>
    </aside>
  )
}
