'use client';

/**
 * SmartDeliveryDashboard — Zentrale Übersicht des Smart Delivery Systems.
 * Kombiniert Kitchen Timing Wall, Tour Board, Fahrer-Navigator und Statistiken.
 * Route: /delivery/smart-delivery
 */

import { useState } from 'react';
import { Timer, Route, BarChart3, Navigation, Zap, RefreshCw } from 'lucide-react';
import { SmartDeliveryTimingWall } from '@/app/(admin)/kitchen/smart-delivery-timing-wall';
import { SmartDeliveryTourBoard } from '@/app/(admin)/dispatch/smart-delivery-tour-board';
import { SmartDeliveryNavCockpit } from '@/app/fahrer/app/smart-delivery-nav-cockpit';
import { SmartDeliveryStatsPanel } from '@/app/(admin)/lieferdienst/smart-delivery-stats-panel';

const LOCATION_ID = 'bb01ae0a-da47-48b1-b986-3a1201aacc4b';

type ViewMode = 'overview' | 'kitchen' | 'dispatch' | 'fahrer' | 'stats';

const VIEWS: { key: ViewMode; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'overview', label: 'Übersicht', icon: <Zap className="w-4 h-4" />, color: 'text-saffron bg-saffron/10 border-saffron/30 hover:bg-saffron/20' },
  { key: 'kitchen', label: 'Küche', icon: <Timer className="w-4 h-4" />, color: 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100' },
  { key: 'dispatch', label: 'Dispatch', icon: <Route className="w-4 h-4" />, color: 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100' },
  { key: 'fahrer', label: 'Fahrer', icon: <Navigation className="w-4 h-4" />, color: 'text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100' },
  { key: 'stats', label: 'Statistiken', icon: <BarChart3 className="w-4 h-4" />, color: 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100' },
];

export function SmartDeliveryDashboard() {
  const [view, setView] = useState<ViewMode>('overview');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-[#F8F6F3]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-stone-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-saffron to-amber-500 flex items-center justify-center shadow-sm">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-black text-stone-900">Smart Delivery System</h1>
              <p className="text-[10px] text-stone-400">Echtzeit-Übersicht · mise</p>
            </div>
          </div>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="p-2 rounded-xl bg-stone-100 border border-stone-200 text-stone-500 hover:bg-stone-200 transition-colors"
            title="Aktualisieren"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* View Tabs */}
        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto">
          {VIEWS.map(v => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-all ${
                view === v.key ? v.color + ' shadow-sm' : 'text-stone-500 bg-white border-stone-200 hover:bg-stone-50'
              }`}
            >
              {v.icon}
              {v.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 max-w-6xl mx-auto">
        {/* Overview: alle Panels */}
        {view === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              <SectionHeader icon={<Timer className="w-4 h-4 text-green-600" />} title="Küchen-Timing" />
              <SmartDeliveryTimingWall key={`kitchen-${refreshKey}`} locationId={LOCATION_ID} />
            </div>
            <div className="space-y-4">
              <SectionHeader icon={<Route className="w-4 h-4 text-blue-600" />} title="Aktive Touren" />
              <SmartDeliveryTourBoard key={`dispatch-${refreshKey}`} locationId={LOCATION_ID} />
            </div>
            <div className="space-y-4">
              <SectionHeader icon={<Navigation className="w-4 h-4 text-purple-600" />} title="Fahrer-Navigation (Demo)" />
              <SmartDeliveryNavCockpit key={`fahrer-${refreshKey}`} />
            </div>
            <div className="space-y-4">
              <SectionHeader icon={<BarChart3 className="w-4 h-4 text-rose-600" />} title="Tages-Statistiken" />
              <SmartDeliveryStatsPanel key={`stats-${refreshKey}`} locationId={LOCATION_ID} />
            </div>
          </div>
        )}

        {/* Kitchen View */}
        {view === 'kitchen' && (
          <div className="max-w-2xl mx-auto">
            <SectionHeader icon={<Timer className="w-4 h-4 text-green-600" />} title="Smart Timing Wall — Küche" />
            <SmartDeliveryTimingWall key={`kitchen-${refreshKey}`} locationId={LOCATION_ID} />
          </div>
        )}

        {/* Dispatch View */}
        {view === 'dispatch' && (
          <div className="max-w-2xl mx-auto">
            <SectionHeader icon={<Route className="w-4 h-4 text-blue-600" />} title="Tour-Visualisierung — Dispatch" />
            <SmartDeliveryTourBoard key={`dispatch-${refreshKey}`} locationId={LOCATION_ID} />
          </div>
        )}

        {/* Fahrer View */}
        {view === 'fahrer' && (
          <div className="max-w-sm mx-auto">
            <SectionHeader icon={<Navigation className="w-4 h-4 text-purple-600" />} title="Navigation — Fahrer" />
            <SmartDeliveryNavCockpit key={`fahrer-${refreshKey}`} />
          </div>
        )}

        {/* Stats View */}
        {view === 'stats' && (
          <div className="max-w-2xl mx-auto">
            <SectionHeader icon={<BarChart3 className="w-4 h-4 text-rose-600" />} title="Statistiken-Dashboard" />
            <SmartDeliveryStatsPanel key={`stats-${refreshKey}`} locationId={LOCATION_ID} />
          </div>
        )}
      </main>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <h2 className="text-sm font-bold text-stone-700">{title}</h2>
    </div>
  );
}
