/**
 * GET /api/delivery/driver/shift-goals
 *
 * Eigene Schicht-Ziele und Fortschritt für den eingeloggten Fahrer.
 * Gibt EarningsData zurück (kompatibel mit TourVerdiensteZielTracker).
 *
 * Auth: Fahrer eingeloggt (mise_drivers.auth_user_id = user.id)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getMyShiftGoalProgress } from '@/lib/delivery/driver-shift-goals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Feste Meilenstein-Stufen: Anteil am Ziel-Verdienst → Bonus-€
const MILESTONES = [
  { pct: 0.50, bonus: 2.00, label: 'Halbzeit-Bonus'   },
  { pct: 0.75, bonus: 3.50, label: 'Bronze-Bonus'      },
  { pct: 1.00, bonus: 5.00, label: 'Ziel-Bonus'        },
  { pct: 1.25, bonus: 8.00, label: 'Gold-Bonus'        },
] as const;

export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const svc = createServiceClient();

  const { data: driver } = await svc
    .from('mise_drivers')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!driver) return NextResponse.json({ error: 'Kein Fahrer-Profil' }, { status: 404 });
  const driverId = (driver as { id: string }).id;

  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const locationId = (emp as { location_id?: string } | null)?.location_id;
  if (!locationId) return NextResponse.json({ error: 'Keine Location' }, { status: 404 });

  const progress = await getMyShiftGoalProgress(driverId, locationId);
  if (!progress) return NextResponse.json({ error: 'Fahrer nicht gefunden' }, { status: 404 });

  const earned = progress.earningsEur;
  const goal   = progress.targetEarningsEur > 0 ? progress.targetEarningsEur : 80;

  const estimatedByEnd =
    progress.shiftPctElapsed > 0.05
      ? Math.round((earned / progress.shiftPctElapsed) * 100) / 100
      : null;

  const nextMilestone =
    MILESTONES.find((m) => m.pct * goal > earned) ?? null;

  return NextResponse.json({
    ok:         true,
    earned,
    goal,
    goalLabel:  'Schicht-Ziel',
    remaining:  Math.max(0, goal - earned),
    progressPct: goal > 0 ? (earned / goal) * 100 : 0,
    estimatedByEnd,
    onTrack:    progress.overallPace !== 'behind',
    nextMilestone: nextMilestone
      ? { amount: nextMilestone.pct * goal, bonus: nextMilestone.bonus, label: nextMilestone.label }
      : null,
    currency:   'EUR',
  });
}
