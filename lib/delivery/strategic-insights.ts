/**
 * lib/delivery/strategic-insights.ts — Phase 403
 *
 * Strategic Delivery Insights Engine.
 * Analysiert historische Daten über 7–14 Tage und erkennt strategische Muster:
 *  - SLA-Hotspots (welche Zonen/Zeiten haben systematisch Verstöße)
 *  - Umsatz-Trends (Wachstum oder Rückgang, Effizienz je Fahrerstunde)
 *  - Fahrer-Muster (Score-Einbrüche, Noten-Rückschritte, Coverage-Lücken)
 *  - Zonen-Schwierigkeiten (hohe Schwierigkeitsindizes, Verkehrsprobleme)
 *  - Küchen-Muster (Handoff-Wartezeiten, Late-Rate-Trends)
 *  - Kunden-Muster (Bewertungs-Trends, Stornoquoten)
 *
 * Ergänzt ops-recommendations.ts (Echtzeit) um strategische Langzeit-Analyse.
 *
 * Public API:
 *  generateStrategicInsights(locationId)       — Alle 6 Analysatoren ausführen, Insights upserten
 *  generateStrategicInsightsAllLocations()     — Cron-Batch
 *  getStrategicInsights(locationId, opts?)     — Insights abrufen (gefiltert)
 *  getInsightsSummary(locationId)              — Zusammenfassung nach Schweregrad/Kategorie
 *  acknowledgeInsight(insightId, locationId)   — Als gelesen markieren
 *  dismissInsight(insightId, locationId)       — Verwerfen
 *  pruneOldInsights(daysToKeep)               — Cleanup
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export type InsightCategory = 'sla' | 'revenue' | 'drivers' | 'zones' | 'kitchen' | 'customers';
export type InsightSeverity = 'critical' | 'warning' | 'info' | 'positive';

export interface StrategicInsight {
  id: string;
  location_id: string;
  category: InsightCategory;
  insight_type: string;
  severity: InsightSeverity;
  title: string;
  description: string;
  data: Record<string, unknown>;
  impact_score: number;
  recommendation: string | null;
  is_acknowledged: boolean;
  acknowledged_at: string | null;
  is_dismissed: boolean;
  generated_at: string;
  valid_until: string | null;
}

export interface InsightsSummary {
  totalInsights: number;
  critical: number;
  warning: number;
  positive: number;
  info: number;
  byCategory: Record<string, number>;
  unacknowledged: number;
  topInsight: StrategicInsight | null;
}

export interface GenerateResult {
  generated: number;
  errors: string[];
}

export interface AllLocationsResult {
  locations: number;
  generated: number;
  errors: number;
}

interface InsightCandidate {
  category: InsightCategory;
  insight_type: string;
  severity: InsightSeverity;
  title: string;
  description: string;
  data: Record<string, unknown>;
  impact_score: number;
  recommendation: string | null;
  valid_until?: string;
}

type Sb = ReturnType<typeof createServiceClient>;

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

// ── 1. SLA-Muster-Analyse ─────────────────────────────────────────────────────

async function analyzeSlaPatterns(locationId: string, sb: Sb): Promise<InsightCandidate[]> {
  const insights: InsightCandidate[] = [];

  const { data: breaches } = await sb
    .from('sla_breach_events')
    .select('zone, breach_severity, breach_detected_at')
    .eq('location_id', locationId)
    .gte('breach_detected_at', daysAgoIso(14))
    .limit(500);

  if (!breaches || breaches.length === 0) return insights;

  // Häufigste Bruch-Zone finden
  const zoneCount: Record<string, number> = {};
  for (const b of breaches) {
    const z = (b.zone as string | null) ?? 'unbekannt';
    zoneCount[z] = (zoneCount[z] ?? 0) + 1;
  }
  const sorted = Object.entries(zoneCount).sort((a, b) => b[1] - a[1]);
  const [worstZone, worstCount] = sorted[0] ?? ['', 0];

  if (worstZone && worstCount >= 5) {
    const pct = Math.round((worstCount / breaches.length) * 100);
    insights.push({
      category: 'sla',
      insight_type: 'sla_zone_hotspot',
      severity: worstCount >= 12 ? 'critical' : 'warning',
      title: `Zone ${worstZone}: ${worstCount} SLA-Verstöße in 14 Tagen`,
      description: `Zone ${worstZone} verursacht ${pct}% aller SLA-Verstöße der letzten 2 Wochen (${worstCount} Fälle). Ein systematisches Kapazitäts- oder Routenproblem ist wahrscheinlich.`,
      data: { zoneCount, worstZone, totalBreaches: breaches.length },
      impact_score: Math.min(90, worstCount * 5),
      recommendation: `Zone ${worstZone} auf Fahrermangel oder Streckenprobleme prüfen. Temporär höhere Vorlaufzeit für diese Zone einplanen.`,
    });
  }

  // Anstieg der letzten 3 Tage vs. davor
  const cutoff3d = daysAgoIso(3);
  const recent = breaches.filter(b => (b.breach_detected_at as string | null) != null && (b.breach_detected_at as string) >= cutoff3d).length;
  const older = breaches.length - recent;
  const rateRecent = recent / 3;
  const rateOlder = Math.max(older / 11, 0.01);

  if (rateRecent > rateOlder * 1.6 && recent >= 3) {
    insights.push({
      category: 'sla',
      insight_type: 'sla_breach_spike',
      severity: 'warning',
      title: 'SLA-Verstöße nehmen zu',
      description: `Letzte 3 Tage: ${recent} Verstöße (${rateRecent.toFixed(1)}/Tag) — ${Math.round((rateRecent / rateOlder - 1) * 100)}% mehr als im 11-Tages-Schnitt (${rateOlder.toFixed(1)}/Tag).`,
      data: { recent, older, rateRecent, rateOlder },
      impact_score: 65,
      recommendation: 'Prüfen Sie Änderungen der letzten Tage: neue Fahrer, Zonenänderungen oder gestiegenes Auftragsvolumen.',
    });
  }

  return insights;
}

// ── 2. Umsatz-Muster-Analyse ──────────────────────────────────────────────────

async function analyzeRevenuePatterns(locationId: string, sb: Sb): Promise<InsightCandidate[]> {
  const insights: InsightCandidate[] = [];

  const { data: roiRows } = await sb
    .from('schicht_roi_daily')
    .select('snapshot_date, revenue_eur, delivery_count, revenue_per_driver_hour, net_margin_pct')
    .eq('location_id', locationId)
    .order('snapshot_date', { ascending: false })
    .limit(14);

  if (!roiRows || roiRows.length < 4) return insights;

  // Woche-über-Woche Vergleich
  const last7 = roiRows.slice(0, Math.min(7, roiRows.length));
  const prev7 = roiRows.slice(7, Math.min(14, roiRows.length));

  if (prev7.length >= 3) {
    const avg7 = last7.reduce((s, r) => s + (r.revenue_eur as number ?? 0), 0) / last7.length;
    const avgP7 = prev7.reduce((s, r) => s + (r.revenue_eur as number ?? 0), 0) / prev7.length;
    const chg = avgP7 > 0 ? ((avg7 - avgP7) / avgP7) * 100 : 0;

    if (chg <= -10) {
      insights.push({
        category: 'revenue',
        insight_type: 'revenue_week_decline',
        severity: chg <= -20 ? 'critical' : 'warning',
        title: `Wochenumsatz um ${Math.abs(Math.round(chg))}% gefallen`,
        description: `Ø Tagesumsatz letzte 7 Tage: ${avg7.toFixed(0)}€ — ${Math.abs(Math.round(chg))}% unter Vorwoche (${avgP7.toFixed(0)}€).`,
        data: { avg7, avgP7, chg },
        impact_score: Math.min(95, Math.abs(Math.round(chg)) * 3),
        recommendation: 'Analysieren Sie Feiertage, Wetter oder Konkurrenzaktionen. Gezielte Aktionen in umsatzschwachen Stunden erwägen.',
      });
    } else if (chg >= 15) {
      insights.push({
        category: 'revenue',
        insight_type: 'revenue_week_growth',
        severity: 'positive',
        title: `Wochenumsatz um ${Math.round(chg)}% gestiegen`,
        description: `Hervorragend! Ø Tagesumsatz stieg von ${avgP7.toFixed(0)}€ auf ${avg7.toFixed(0)}€ (+${Math.round(chg)}%).`,
        data: { avg7, avgP7, chg },
        impact_score: Math.min(70, Math.round(chg) * 2),
        recommendation: 'Analysieren Sie die Erfolgstreiber dieser Woche und verankern Sie sie als Best Practice.',
      });
    }
  }

  // Umsatz/Fahrerstunde sinkend
  const withRpdh = roiRows.filter(r => (r.revenue_per_driver_hour as number | null) != null && (r.revenue_per_driver_hour as number) > 0);
  if (withRpdh.length >= 6) {
    const rNew = withRpdh.slice(0, 3).reduce((s, r) => s + (r.revenue_per_driver_hour as number), 0) / 3;
    const rOld = withRpdh.slice(3, 6).reduce((s, r) => s + (r.revenue_per_driver_hour as number), 0) / 3;
    const rpdhChg = rOld > 0 ? ((rNew - rOld) / rOld) * 100 : 0;
    if (rpdhChg <= -15) {
      insights.push({
        category: 'revenue',
        insight_type: 'revenue_per_driver_declining',
        severity: 'warning',
        title: `Umsatz/Fahrerstunde −${Math.abs(Math.round(rpdhChg))}%`,
        description: `Effizienz je Fahrerstunde sank in 3 Tagen von ${rOld.toFixed(1)}€/h auf ${rNew.toFixed(1)}€/h. Mögliche Ursache: Überbesetzung bei niedrigem Volumen.`,
        data: { rNew, rOld, rpdhChg },
        impact_score: 55,
        recommendation: 'Personalplanung dem Auftragsvolumen anpassen. In schwachen Stunden weniger Fahrer einsetzen.',
      });
    }
  }

  return insights;
}

// ── 3. Fahrer-Muster-Analyse ──────────────────────────────────────────────────

async function analyzeDriverPatterns(locationId: string, sb: Sb): Promise<InsightCandidate[]> {
  const insights: InsightCandidate[] = [];

  // Score-Einbrüche
  const { data: alerts } = await sb
    .from('driver_score_drop_alerts')
    .select('driver_id, alert_type, score_today, score_baseline, drop_magnitude, grade_today, grade_baseline, alert_date')
    .eq('location_id', locationId)
    .eq('acknowledged', false)
    .order('alert_date', { ascending: false })
    .limit(20);

  if (alerts && alerts.length > 0) {
    const criticalDrops = alerts.filter(a => (a.drop_magnitude as number | null) != null && (a.drop_magnitude as number) >= 15);
    const gradeRegressions = alerts.filter(a => a.alert_type === 'grade_regression');

    if (criticalDrops.length >= 2) {
      insights.push({
        category: 'drivers',
        insight_type: 'driver_score_multi_drop',
        severity: 'warning',
        title: `${criticalDrops.length} Fahrer mit starkem Score-Einbruch`,
        description: `${criticalDrops.length} Fahrer zeigen unquittierte Einbrüche von ≥15 Punkten. Mögliche Ursachen: Überlastung, Demotivation oder Schulungsbedarf.`,
        data: { criticalDropCount: criticalDrops.length, totalAlerts: alerts.length },
        impact_score: Math.min(80, criticalDrops.length * 20),
        recommendation: 'Einzelgespräche mit betroffenen Fahrern. Prüfen Sie Überlastung oder externe Belastungen.',
      });
    }

    if (gradeRegressions.length >= 1) {
      insights.push({
        category: 'drivers',
        insight_type: 'driver_grade_regression',
        severity: 'warning',
        title: `${gradeRegressions.length} Fahrer mit Noten-Rückschritt`,
        description: `${gradeRegressions.length} Fahrer wurden in eine niedrigere Leistungsnote eingestuft. Frühzeitige Intervention verhindert weitere Verschlechterung.`,
        data: { regressionCount: gradeRegressions.length },
        impact_score: 60,
        recommendation: 'Coaching-Modul aktivieren und Feedbackgespräch planen.',
      });
    }
  }

  // Schicht-Coverage für morgen
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const dayAfter = new Date(tomorrow.getTime() + 24 * 3_600_000);

  const [{ data: tomorrowShifts }, { data: allDrivers }] = await Promise.all([
    sb.from('driver_shifts')
      .select('id')
      .eq('location_id', locationId)
      .gte('planned_start', tomorrow.toISOString())
      .lt('planned_start', dayAfter.toISOString())
      .limit(100),
    sb.from('mise_drivers')
      .select('id')
      .eq('location_id', locationId)
      .eq('is_active', true)
      .limit(100),
  ]);

  const scheduledCount = tomorrowShifts?.length ?? 0;
  const totalDrivers = allDrivers?.length ?? 0;

  if (totalDrivers > 0 && scheduledCount < Math.ceil(totalDrivers * 0.3)) {
    insights.push({
      category: 'drivers',
      insight_type: 'driver_coverage_gap',
      severity: scheduledCount === 0 ? 'critical' : 'warning',
      title: `Nur ${scheduledCount}/${totalDrivers} Fahrer für morgen eingeplant`,
      description: `Für morgen sind erst ${scheduledCount} von ${totalDrivers} aktiven Fahrern in Schichten eingeplant. Kapazitätsengpässe möglich.`,
      data: { scheduledCount, totalDrivers },
      impact_score: scheduledCount === 0 ? 90 : 70,
      recommendation: 'Verfügbare Fahrer für morgige Schichten kontaktieren oder Auto-Shift-Generator aktivieren.',
    });
  }

  return insights;
}

// ── 4. Zonen-Muster-Analyse ────────────────────────────────────────────────────

async function analyzeZonePatterns(locationId: string, sb: Sb): Promise<InsightCandidate[]> {
  const insights: InsightCandidate[] = [];

  const { data: zones } = await sb
    .from('zone_difficulty_cache')
    .select('zone, avg_difficulty, avg_traffic, issue_rate_parking, issue_rate_nav, issue_rate_address, stop_count_modifier')
    .eq('location_id', locationId)
    .limit(10);

  if (!zones || zones.length === 0) return insights;

  // Schwierigste Zone
  const hardZones = zones.filter(z => (z.avg_difficulty as number | null) != null && (z.avg_difficulty as number) > 3.5);
  if (hardZones.length > 0) {
    const hz = hardZones.sort((a, b) => (b.avg_difficulty as number) - (a.avg_difficulty as number))[0];
    const diff = hz.avg_difficulty as number;
    insights.push({
      category: 'zones',
      insight_type: 'zone_high_difficulty',
      severity: diff > 4.0 ? 'warning' : 'info',
      title: `Zone ${hz.zone as string}: Schwierigkeitsindex ${diff.toFixed(1)}/5.0`,
      description: `Zone ${hz.zone as string} liegt deutlich über dem Durchschnitt. Probleme: Parken ${(((hz.issue_rate_parking as number | null) ?? 0) * 100).toFixed(0)}%, Navigation ${(((hz.issue_rate_nav as number | null) ?? 0) * 100).toFixed(0)}%, Adresse ${(((hz.issue_rate_address as number | null) ?? 0) * 100).toFixed(0)}%.`,
      data: { zone: hz.zone, difficulty: diff, parking: hz.issue_rate_parking, nav: hz.issue_rate_nav },
      impact_score: Math.min(70, Math.round(diff * 14)),
      recommendation: `Für Zone ${hz.zone as string} längere ETAs einplanen. Adressdaten und Parkalternativen optimieren.`,
    });
  }

  // Stärkste Verkehrszone
  const trafficZones = zones.filter(z => (z.avg_traffic as number | null) != null && (z.avg_traffic as number) > 3.5);
  if (trafficZones.length > 0) {
    const tz = trafficZones.sort((a, b) => (b.avg_traffic as number) - (a.avg_traffic as number))[0];
    const traffic = tz.avg_traffic as number;
    insights.push({
      category: 'zones',
      insight_type: 'zone_traffic_hotspot',
      severity: 'info',
      title: `Zone ${tz.zone as string}: Verkehrsindex ${traffic.toFixed(1)}/5.0`,
      description: `Zone ${tz.zone as string} hat überdurchschnittliches Verkehrsaufkommen. ETAs sollten entsprechend angepasst sein.`,
      data: { zone: tz.zone, traffic },
      impact_score: 40,
      recommendation: `ETA-Kalibrierung für Zone ${tz.zone as string} überprüfen und Kunden transparenter über Wartezeiten informieren.`,
    });
  }

  return insights;
}

// ── 5. Küchen-Muster-Analyse ───────────────────────────────────────────────────

async function analyzeKitchenPatterns(locationId: string, sb: Sb): Promise<InsightCandidate[]> {
  const insights: InsightCandidate[] = [];

  const cutoff7d = daysAgoIso(7).slice(0, 10); // YYYY-MM-DD

  const { data: handoffRows } = await sb
    .from('handoff_rate_daily')
    .select('snapshot_date, avg_wait_min, late_pct, quick_pct')
    .eq('location_id', locationId)
    .gte('snapshot_date', cutoff7d)
    .order('snapshot_date', { ascending: false })
    .limit(7);

  if (!handoffRows || handoffRows.length < 4) return insights;

  const recentSlice = handoffRows.slice(0, 3);
  const olderSlice = handoffRows.slice(3);

  const avgWaitRecent = recentSlice.reduce((s, r) => s + ((r.avg_wait_min as number | null) ?? 0), 0) / recentSlice.length;
  const avgWaitOlder = olderSlice.reduce((s, r) => s + ((r.avg_wait_min as number | null) ?? 0), 0) / Math.max(olderSlice.length, 1);

  if (avgWaitRecent > avgWaitOlder * 1.25 && avgWaitRecent > 5) {
    insights.push({
      category: 'kitchen',
      insight_type: 'kitchen_handoff_worsening',
      severity: avgWaitRecent > 10 ? 'warning' : 'info',
      title: `Küche→Fahrer Wartezeit: ${avgWaitRecent.toFixed(1)} Min (↑)`,
      description: `Durchschnittliche Wartezeit stieg in 3 Tagen (${avgWaitRecent.toFixed(1)} Min) vs. Vorwoche (${avgWaitOlder.toFixed(1)} Min). Fertig gekochte Bestellungen warten zu lange.`,
      data: { avgWaitRecent, avgWaitOlder },
      impact_score: Math.min(75, Math.round(avgWaitRecent * 5)),
      recommendation: 'Prüfen Sie ob Kochzeiten überschätzt werden oder ob Fahrer zu spät erscheinen. Dispatch-Timing optimieren.',
    });
  }

  const avgLatePct = recentSlice.reduce((s, r) => s + ((r.late_pct as number | null) ?? 0), 0) / recentSlice.length;
  if (avgLatePct > 25) {
    insights.push({
      category: 'kitchen',
      insight_type: 'kitchen_late_handoff_rate',
      severity: avgLatePct > 40 ? 'critical' : 'warning',
      title: `${Math.round(avgLatePct)}% Late-Handoffs in 3 Tagen`,
      description: `${Math.round(avgLatePct)}% der fertigen Bestellungen warten länger als vereinbart auf einen Fahrer. Kochqualität und Kundenzufriedenheit leiden.`,
      data: { avgLatePct },
      impact_score: Math.min(85, Math.round(avgLatePct * 1.5)),
      recommendation: 'Fahrerzuweisung früher auslösen, sodass Fahrer bei Fertigstellung sofort abholen können.',
    });
  }

  return insights;
}

// ── 6. Kunden-Muster-Analyse ───────────────────────────────────────────────────

async function analyzeCustomerPatterns(locationId: string, sb: Sb): Promise<InsightCandidate[]> {
  const insights: InsightCandidate[] = [];

  const cutoff14d = daysAgoIso(14);
  const cutoff7d = daysAgoIso(7);

  const { data: ratings } = await sb
    .from('customer_delivery_ratings')
    .select('rating, created_at')
    .eq('location_id', locationId)
    .gte('created_at', cutoff14d)
    .limit(300);

  if (ratings && ratings.length >= 10) {
    const last7 = ratings.filter(r => (r.created_at as string | null) != null && (r.created_at as string) >= cutoff7d);
    const prev7 = ratings.filter(r => (r.created_at as string | null) != null && (r.created_at as string) < cutoff7d);

    if (last7.length >= 5 && prev7.length >= 5) {
      const avgL7 = last7.reduce((s, r) => s + ((r.rating as number | null) ?? 0), 0) / last7.length;
      const avgP7 = prev7.reduce((s, r) => s + ((r.rating as number | null) ?? 0), 0) / prev7.length;
      const delta = avgL7 - avgP7;

      if (delta <= -0.3) {
        insights.push({
          category: 'customers',
          insight_type: 'customer_rating_decline',
          severity: avgL7 < 3.5 ? 'critical' : 'warning',
          title: `Kundenbewertungen sanken auf Ø ${avgL7.toFixed(1)}★`,
          description: `Letzte 7 Tage: Ø ${avgL7.toFixed(1)}★ — ${Math.abs(delta).toFixed(1)}★ unter Vorwoche (${avgP7.toFixed(1)}★). ${last7.length} Bewertungen ausgewertet.`,
          data: { avgL7, avgP7, delta, count: last7.length },
          impact_score: Math.min(90, Math.round(Math.abs(delta) * 60 + 30)),
          recommendation: 'Bewertungskommentare auf gemeinsame Themen untersuchen. Prüfen Sie ob bestimmte Fahrer oder Tageszeiten die Verschlechterung verursachen.',
        });
      } else if (avgL7 >= 4.7 && last7.length >= 10) {
        insights.push({
          category: 'customers',
          insight_type: 'customer_rating_excellent',
          severity: 'positive',
          title: `Ausgezeichnete Bewertungen: Ø ${avgL7.toFixed(1)}★`,
          description: `${last7.length} Bewertungen diese Woche mit Ø ${avgL7.toFixed(1)}★ — Spitzenniveau! Das Lieferteam performt hervorragend.`,
          data: { avgL7, count: last7.length },
          impact_score: 50,
          recommendation: 'Erfolgsrezept dokumentieren und als Team-Best-Practice verankern.',
        });
      }
    }
  }

  // Stornoquote letzte 7 Tage
  const { data: recentOrders } = await sb
    .from('customer_orders')
    .select('status')
    .eq('location_id', locationId)
    .eq('bestellart', 'lieferung')
    .gte('bestellt_am', cutoff7d)
    .limit(500);

  if (recentOrders && recentOrders.length >= 20) {
    const cancelled = recentOrders.filter(o => o.status === 'storniert').length;
    const cancelPct = (cancelled / recentOrders.length) * 100;

    if (cancelPct > 12) {
      insights.push({
        category: 'customers',
        insight_type: 'customer_high_cancellation',
        severity: cancelPct > 20 ? 'critical' : 'warning',
        title: `Stornoquote ${cancelPct.toFixed(1)}% — über Normalwert`,
        description: `${cancelled} von ${recentOrders.length} Lieferbestellungen der letzten 7 Tage storniert (${cancelPct.toFixed(1)}%). Normalwert liegt unter 10%.`,
        data: { cancelled, total: recentOrders.length, cancelPct },
        impact_score: Math.min(85, Math.round(cancelPct * 3)),
        recommendation: 'Storno-Zeitpunkte analysieren: kurz nach Bestellung (ETA-Problem?) oder nach Wartezeit (Verzögerung?). Kundenkommunikation bei Verzögerungen verbessern.',
      });
    }
  }

  return insights;
}

// ── Haupt-Generierungsfunktion ──────────────────────────────────────────────────

export async function generateStrategicInsights(locationId: string): Promise<GenerateResult> {
  const sb = createServiceClient();
  const errors: string[] = [];
  const candidates: InsightCandidate[] = [];

  const analyzers = [
    analyzeSlaPatterns,
    analyzeRevenuePatterns,
    analyzeDriverPatterns,
    analyzeZonePatterns,
    analyzeKitchenPatterns,
    analyzeCustomerPatterns,
  ] as Array<(lid: string, sb: Sb) => Promise<InsightCandidate[]>>;

  const results = await Promise.allSettled(analyzers.map(fn => fn(locationId, sb)));
  for (const r of results) {
    if (r.status === 'fulfilled') candidates.push(...r.value);
    else errors.push(String(r.reason));
  }

  let generated = 0;
  for (const c of candidates) {
    const { error } = await sb.from('delivery_strategic_insights').upsert(
      {
        location_id: locationId,
        category: c.category,
        insight_type: c.insight_type,
        severity: c.severity,
        title: c.title,
        description: c.description,
        data: c.data,
        impact_score: c.impact_score,
        recommendation: c.recommendation,
        is_acknowledged: false,
        generated_at: new Date().toISOString(),
        valid_until: c.valid_until ?? new Date(Date.now() + 24 * 3_600_000).toISOString(),
      },
      { onConflict: 'location_id,insight_type' },
    );
    if (!error) generated++;
    else errors.push(`${c.insight_type}: ${error.message}`);
  }

  return { generated, errors };
}

export async function generateStrategicInsightsAllLocations(): Promise<AllLocationsResult> {
  const sb = createServiceClient();
  const { data: locations } = await sb.from('mise_locations').select('id').eq('is_active', true).limit(200);
  if (!locations?.length) return { locations: 0, generated: 0, errors: 0 };

  let totalGenerated = 0;
  let totalErrors = 0;

  const results = await Promise.allSettled(
    locations.map(loc => generateStrategicInsights(loc.id as string)),
  );
  for (const r of results) {
    if (r.status === 'fulfilled') totalGenerated += r.value.generated;
    else totalErrors++;
  }

  return { locations: locations.length, generated: totalGenerated, errors: totalErrors };
}

// ── Abfrage-Funktionen ─────────────────────────────────────────────────────────

export interface GetInsightsOpts {
  category?: InsightCategory;
  severity?: InsightSeverity;
  acknowledged?: boolean;
  includeExpired?: boolean;
}

export async function getStrategicInsights(
  locationId: string,
  opts: GetInsightsOpts = {},
): Promise<StrategicInsight[]> {
  const sb = createServiceClient();

  let q = sb
    .from('delivery_strategic_insights')
    .select('*')
    .eq('location_id', locationId)
    .eq('is_dismissed', false)
    .order('impact_score', { ascending: false })
    .limit(50);

  if (opts.category) q = q.eq('category', opts.category);
  if (opts.acknowledged !== undefined) q = q.eq('is_acknowledged', opts.acknowledged);
  if (!opts.includeExpired) {
    q = q.or(`valid_until.is.null,valid_until.gte.${new Date().toISOString()}`);
  }

  const severityRank: Record<InsightSeverity, number> = { critical: 4, warning: 3, info: 2, positive: 1 };
  if (opts.severity) {
    const minRank = severityRank[opts.severity];
    const allowed = (Object.keys(severityRank) as InsightSeverity[]).filter(s => severityRank[s] >= minRank);
    q = q.in('severity', allowed);
  }

  const { data } = await q;
  return (data ?? []) as StrategicInsight[];
}

export async function getInsightsSummary(locationId: string): Promise<InsightsSummary> {
  const insights = await getStrategicInsights(locationId);
  const byCategory: Record<string, number> = {};
  for (const i of insights) {
    byCategory[i.category] = (byCategory[i.category] ?? 0) + 1;
  }
  return {
    totalInsights: insights.length,
    critical: insights.filter(i => i.severity === 'critical').length,
    warning: insights.filter(i => i.severity === 'warning').length,
    positive: insights.filter(i => i.severity === 'positive').length,
    info: insights.filter(i => i.severity === 'info').length,
    byCategory,
    unacknowledged: insights.filter(i => !i.is_acknowledged).length,
    topInsight: insights.find(i => i.severity === 'critical') ?? insights.find(i => i.severity === 'warning') ?? insights[0] ?? null,
  };
}

export async function acknowledgeInsight(insightId: string, locationId: string): Promise<boolean> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('delivery_strategic_insights')
    .update({ is_acknowledged: true, acknowledged_at: new Date().toISOString() })
    .eq('id', insightId)
    .eq('location_id', locationId);
  return !error;
}

export async function dismissInsight(insightId: string, locationId: string): Promise<boolean> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('delivery_strategic_insights')
    .update({ is_dismissed: true })
    .eq('id', insightId)
    .eq('location_id', locationId);
  return !error;
}

export async function pruneOldInsights(daysToKeep: number = 30): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_delivery_strategic_insights', { days_to_keep: daysToKeep });
  return (data as number | null) ?? 0;
}
