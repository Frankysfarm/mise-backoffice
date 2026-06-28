import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { getMonthlyStats } from '@/lib/loyalty/stats';
import { StatsCards } from '../components/stats-cards';

export const dynamic = 'force-dynamic';

export default async function LoyaltyDashboard() {
  const emp = await getCurrentEmployee();
  const tenantId = emp?.tenant_id;

  if (!tenantId) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ color: '#DC2626', fontSize: 14 }}>Fehler: Tenant konnte nicht ermittelt werden</div>
      </div>
    );
  }

  const stats = await getMonthlyStats(tenantId);

  return (
    <div style={{ maxWidth: 1200, padding: '20px 0' }}>
      <div style={{ marginBottom: 30 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0F172A', margin: '0 0 8px 0' }}>
          Bonusredemption Übersicht
        </h1>
        <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
          Statistiken zum Loyalty-Bonusprogramm des laufenden Monats
        </p>
      </div>

      <StatsCards stats={stats} />

      {/* Daily Trend Chart (Simple List) */}
      {stats.dailyTrend.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, color: '#64748B', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Täglich Eingelöst (30 Tage)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {stats.dailyTrend.map((day) => (
              <div
                key={day.date}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: '#F8FAFC',
                  borderRadius: 8,
                  border: '1px solid #E2E8F0',
                }}
              >
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  {new Date(day.date + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                  {day.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
