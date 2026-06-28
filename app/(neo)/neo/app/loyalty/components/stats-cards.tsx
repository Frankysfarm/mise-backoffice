'use client';

import { MonthlyStats } from '@/lib/loyalty/stats';

export function StatsCards({ stats }: { stats: MonthlyStats }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 30 }}>
      {/* Total Redemptions Card */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>
          Bonusredemptionen (Monat)
        </div>
        <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 28, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>
          {stats.totalRedemptions}
        </div>
        <div style={{ fontSize: 12, color: '#475569' }}>
          {stats.dailyTrend.length > 0 
            ? `Über ${stats.dailyTrend.length} Tage verteilt`
            : 'Noch keine Daten'}
        </div>
      </div>

      {/* Top Items Card */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, gridColumn: 'span 1' }}>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>
          Top 5 Bonusartikel
        </div>
        {stats.topItems.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stats.topItems.map((item, idx) => (
              <div key={item.menuItemId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: idx < stats.topItems.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
                    {idx + 1}. {item.name}
                  </div>
                </div>
                <div style={{ background: '#F0F4F8', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#475569' }}>
                  {item.count}x
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#94A3B8', fontSize: 13 }}>Noch keine Bonusse eingelöst</div>
        )}
      </div>
    </div>
  );
}
