'use client';

/**
 * SmartDeliveryDashboard — Zentrale Übersicht des Smart Delivery Systems.
 * Kombiniert Kitchen Timing Wall, Tour Board, Fahrer-Navigator und Statistiken.
 * Route: /delivery/smart-delivery
 */

import { useState } from 'react';
import { Timer, Route, BarChart3, Navigation, Zap, RefreshCw, Layers, Map, TrendingUp } from 'lucide-react';
import { SmartDeliveryTimingWall } from '@/app/(admin)/kitchen/smart-delivery-timing-wall';
import { SmartDeliveryTourBoard } from '@/app/(admin)/dispatch/smart-delivery-tour-board';
import { SmartDeliveryNavCockpit } from '@/app/fahrer/app/smart-delivery-nav-cockpit';
import { SmartDeliveryStatsPanel } from '@/app/(admin)/lieferdienst/smart-delivery-stats-panel';
import { KitchenBatchSyncIntelligence } from '@/app/(admin)/kitchen/kitchen-batch-sync-intelligence';
import { DispatchTourEtaMatrix } from '@/app/(admin)/dispatch/dispatch-tour-eta-matrix';
import { FahrerSmartNavV3 } from '@/app/fahrer/app/fahrer-smart-nav-v3';
import { LieferdienstPerformanceHub } from '@/app/(admin)/lieferdienst/lieferdienst-performance-hub';
import { SmartEtaLiveHub } from '@/app/order/[locationSlug]/smart-eta-live-hub';

const LOCATION_ID = 'bb01ae0a-da47-48b1-b986-3a1201aacc4b';

type ViewMode = 'overview' | 'kitchen' | 'dispatch' | 'fahrer' | 'stats' | 'eta';

const VIEWS: { key: ViewMode; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'overview', label: 'Übersicht',   icon: <Zap className="w-4 h-4" />,        color: 'text-saffron bg-saffron/10 border-saffron/30 hover:bg-saffron/20' },
  { key: 'kitchen',  label: 'Küche',        icon: <Timer className="w-4 h-4" />,       color: 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100' },
  { key: 'dispatch', label: 'Dispatch',     icon: <Route className="w-4 h-4" />,       color: 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100' },
  { key: 'fahrer',   label: 'Fahrer',       icon: <Navigation className="w-4 h-4" />, color: 'text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100' },
  { key: 'stats',    label: 'Performance',  icon: <TrendingUp className="w-4 h-4" />, color: 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100' },
  { key: 'eta',      label: 'Live ETA',     icon: <Map className="w-4 h-4" />,         color: 'text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100' },
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
        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-hide">
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
              <SectionHeader icon={<Timer className="w-4 h-4 text-green-600" />} title="Batch-Sync Intelligence" />
              <KitchenBatchSyncIntelligence key={`batch-${refreshKey}`} locationId={LOCATION_ID} />
            </div>
            <div className="space-y-4">
              <SectionHeader icon={<Route className="w-4 h-4 text-blue-600" />} title="Tour ETA-Matrix" />
              <DispatchTourEtaMatrix key={`eta-${refreshKey}`} locationId={LOCATION_ID} />
            </div>
            <div className="space-y-4">
              <SectionHeader icon={<Navigation className="w-4 h-4 text-purple-600" />} title="Fahrer Smart Nav v3" />
              <FahrerSmartNavV3 key={`nav-${refreshKey}`} />
            </div>
            <div className="space-y-4">
              <SectionHeader icon={<TrendingUp className="w-4 h-4 text-rose-600" />} title="Performance Hub" />
              <LieferdienstPerformanceHub key={`perf-${refreshKey}`} locationId={LOCATION_ID} />
            </div>
          </div>
        )}

        {/* Kitchen View: Smart Timing + Batch-Sync */}
        {view === 'kitchen' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <SectionHeader icon={<Timer className="w-4 h-4 text-green-600" />} title="Smart Timing Wall" />
            <SmartDeliveryTimingWall key={`timing-${refreshKey}`} locationId={LOCATION_ID} />
            <SectionHeader icon={<Layers className="w-4 h-4 text-green-700" />} title="Batch-Sync Intelligence" />
            <KitchenBatchSyncIntelligence key={`batch-${refreshKey}`} locationId={LOCATION_ID} />
          </div>
        )}

        {/* Dispatch View: Tour Board + ETA Matrix */}
        {view === 'dispatch' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <SectionHeader icon={<Route className="w-4 h-4 text-blue-600" />} title="Tour Score-Board" />
            <SmartDeliveryTourBoard key={`tour-${refreshKey}`} locationId={LOCATION_ID} />
            <SectionHeader icon={<Map className="w-4 h-4 text-blue-700" />} title="ETA-Matrix — Alle Touren" />
            <DispatchTourEtaMatrix key={`matrix-${refreshKey}`} locationId={LOCATION_ID} />
          </div>
        )}

        {/* Fahrer View: Nav Cockpit + Smart Nav v3 */}
        {view === 'fahrer' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <div className="space-y-4">
              <SectionHeader icon={<Navigation className="w-4 h-4 text-purple-600" />} title="Tour-Navigator" />
              <SmartDeliveryNavCockpit key={`nav-${refreshKey}`} />
            </div>
            <div className="space-y-4">
              <SectionHeader icon={<Zap className="w-4 h-4 text-purple-700" />} title="Smart Nav v3" />
              <FahrerSmartNavV3 key={`navv3-${refreshKey}`} />
            </div>
          </div>
        )}

        {/* Performance/Stats View */}
        {view === 'stats' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <SectionHeader icon={<TrendingUp className="w-4 h-4 text-rose-600" />} title="Performance Hub — Stündlich, Zonen, Fahrer" />
            <LieferdienstPerformanceHub key={`perf-${refreshKey}`} locationId={LOCATION_ID} />
            <SectionHeader icon={<BarChart3 className="w-4 h-4 text-rose-700" />} title="Tages-Statistiken" />
            <SmartDeliveryStatsPanel key={`stats-${refreshKey}`} locationId={LOCATION_ID} />
          </div>
        )}

        {/* Live ETA View: Storefront-style customer tracking */}
        {view === 'eta' && (
          <div className="max-w-sm mx-auto space-y-4">
            <SectionHeader icon={<Map className="w-4 h-4 text-indigo-600" />} title="Live ETA — Kunden-Tracking (Demo)" />
            <SmartEtaLiveHub key={`eta-${refreshKey}`} />
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
