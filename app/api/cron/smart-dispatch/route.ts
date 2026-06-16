/**
 * GET /api/cron/smart-dispatch
 *
 * Vercel Cron-Endpoint: läuft alle 2 Minuten.
 * Scannt unzugewiesene Lieferbestellungen und dispatcht sie via Smart-Engine.
 *
 * Schutz: CRON_SECRET env (Vercel setzt Authorization: Bearer <secret>)
 * oder BISS_INTERNAL_TOKEN Header für Rückwärtskompatibilität.
 */
import { NextRequest, NextResponse } from 'next/server';
import { smartDispatchTick } from '@/lib/delivery/dispatch-engine';
import { syncKitchenNotifications } from '@/lib/delivery/kitchen-sync';
import { refreshEnRouteEtas } from '@/lib/delivery/eta';
import { autoCloseMissedShifts } from '@/lib/delivery/shifts';
import { snapshotAllLocations } from '@/lib/delivery/forecast';
import { evaluateAlertsAllLocations } from '@/lib/delivery/alerts';
import { scanStaleBatches } from '@/lib/delivery/recovery';
import { createServiceClient } from '@/lib/supabase/server';
import { generateMissingRatingTokens, processPendingRatingLinks } from '@/lib/delivery/satisfaction';
import { runDelayMonitorAllLocations } from '@/lib/delivery/delay-monitor';
import { releaseScheduledOrders } from '@/lib/delivery/scheduled';
import { processAllWebhooks } from '@/lib/delivery/webhooks';
import { runDailyReportCache } from '@/lib/delivery/reporting';
import { recomputeAllLocations as recomputeEtaCalibration } from '@/lib/delivery/eta-calibration';
import { evaluateSurgeAllLocations } from '@/lib/delivery/surge';
import { processWindowDispatchAllLocations, markMissedWindows } from '@/lib/delivery/windows';
import { releaseRetryAttempts } from '@/lib/delivery/proof';
import { evaluateAutoSignalAllLocations } from '@/lib/delivery/capacity';
import { expireStaleCredits } from '@/lib/delivery/credits';
import { expireOldBroadcasts } from '@/lib/delivery/messaging';
import { processAllCustomerNotifications } from '@/lib/delivery/customer-push';
import { autoCreateIncidentsForRatings } from '@/lib/delivery/incidents';
import { snapshotAllLocations as snapshotDriverPerformance } from '@/lib/delivery/driver-performance';
import { evaluateComplianceAllLocations } from '@/lib/delivery/compliance';
import { expireStaleApplicationsAllLocations } from '@/lib/delivery/onboarding';
import { runSlaEscalationAllLocations } from '@/lib/delivery/sla-escalation';
import { processExpiredPointsAllLocations } from '@/lib/delivery/loyalty-points';
import { pruneNavCache } from '@/lib/delivery/navigation';
import { detectAndHandleNoShowsAllLocations } from '@/lib/delivery/driver-reliability';
import { processUnscoredAllLocations as processCdesAllLocations } from '@/lib/delivery/cdes';
import { generateDigestAllLocations } from '@/lib/delivery/daily-digest';
import { checkAndAwardChallengesAllLocations } from '@/lib/delivery/challenges';
import { runPositioningAllLocations } from '@/lib/delivery/positioning';
import { snapshotAllLocations as snapshotProfitability } from '@/lib/delivery/profitability';
import { analyzeChurnAllLocations, runReEngagementAllLocations } from '@/lib/delivery/churn-prevention';
import { takeSnapshotAllLocations as takeHealthSnapshots, pruneOldSnapshots } from '@/lib/delivery/health-observatory';
import { runSurgePredictionAllLocations, evaluatePastPredictions } from '@/lib/delivery/surge-prediction';
import { batchRecomputeRatingsForLocation } from '@/lib/delivery/rating';
import { scanProblematicAddressesAllLocations } from '@/lib/delivery/address-intelligence';
import { pruneOldCommsLogs } from '@/lib/delivery/comms-log';
import { refreshZoneAffinityAllLocations } from '@/lib/delivery/zone-affinity';
import { checkAllDrivers } from '@/lib/delivery/review-flags';
import { scanAndRecordCompletedTours } from '@/lib/delivery/tour-analytics';
import { snapshotGeoDemandAllLocations } from '@/lib/delivery/geo-demand';
import { runFlowIntelligenceAllLocations, pruneOldFlowSnapshots } from '@/lib/delivery/flow-intelligence';
import { snapshotFatigueAllLocations, pruneFatigueSnapshots } from '@/lib/delivery/fatigue-monitor';
import { snapshotPatternsAllLocations as snapshotPeakPatterns, analyzePeakAllLocations, pruneOldAlerts as prunePeakAlerts } from '@/lib/delivery/peak-intelligence';
import { snapshotMenuAllLocations, pruneMenuSnapshots } from '@/lib/delivery/menu-analytics';
import { recomputePrepProfilesAllLocations, prunePrepObservations } from '@/lib/delivery/kitchen-prep-learning';
import { generateShiftSuggestionsAllLocations, pruneStaleSuggestions } from '@/lib/delivery/shift-suggestions';
import { processAutoCompensationsAllLocations } from '@/lib/delivery/sla-compensation';
import { evaluateBonusesAllLocations } from '@/lib/delivery/driver-bonus';
import { sendDailyDigestAllLocations } from '@/lib/delivery/digest-mailer';
import { sendDriverDailyDigestAllLocations } from '@/lib/delivery/driver-digest-mailer';
import { buildProfilesAllLocations as buildReorderProfiles, pruneStaleProfiles as pruneReorderProfiles } from '@/lib/delivery/reorder-engine';
import { renewExpiredSubscriptions } from '@/lib/delivery/subscriptions';
import { reconcileAllLocations as reconcileCashAllLocations } from '@/lib/delivery/cash-reconciliation';
import { pruneCustomerPushLogs, pruneInactiveSubscriptions } from '@/lib/delivery/customer-web-push';
import { computeClustersAllLocations } from '@/lib/delivery/geo-clustering';
import { computePushAnalyticsAllLocations } from '@/lib/delivery/push-analytics';
import { runDueCampaigns } from '@/lib/delivery/push-campaigns';
import { buildRfmAllLocations, pruneStaleRfmProfiles } from '@/lib/delivery/rfm-segmentation';
import { pruneExpiredVouchers } from '@/lib/delivery/vouchers';
import { processAllUnanalyzedLocations, pruneSentimentData } from '@/lib/delivery/feedback-sentiment';
import { computeAllLocations as computeTripCosts } from '@/lib/delivery/trip-cost-intelligence';
import { evaluateAllLocations as evaluateMenuAvailability, refreshDisableCounts } from '@/lib/delivery/menu-availability';
import { rebuildAllLocations as rebuildUpsellPairs } from '@/lib/delivery/smart-upsell';
import { processAllLocations as processReferralRewards, expireStaleConversions as expireReferralConversions } from '@/lib/delivery/referral-program';
import { computeCvsAllLocations, pruneStaleScores as pruneCvsScores } from '@/lib/delivery/customer-value-score';
import { buildStreakOverviewAllLocations } from '@/lib/delivery/driver-streaks';
import { snapshotAllLocations as snapshotDriverTipsAllLocations } from '@/lib/delivery/tips';
import { recordForecastAllLocations, fillActualsAllLocations, pruneForecastSnapshots } from '@/lib/delivery/demand-forecast';
import { optimizeAllLocations as optimizeRoutesAllLocations } from '@/lib/delivery/route-optimizer-v2';
import { takeWeatherSnapshotAllLocations, pruneOldWeatherSnapshots } from '@/lib/delivery/weather-intelligence';
import { computeScoresAllLocations as computeDriverScoresAllLocations } from '@/lib/delivery/driver-score';
import { snapshotAllLocations as snapshotNetworkHealth, pruneOldNetworkSnapshots } from '@/lib/delivery/network-health';
import { generateCapacityPlanAllLocations, pruneOldSlots as pruneCapacitySlots } from '@/lib/delivery/capacity-planner';
import { pruneOldDrafts as pruneAutoShiftDrafts } from '@/lib/delivery/auto-shift-generator';
import { pruneOldAmendmentsAllLocations } from '@/lib/delivery/order-amendments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  // Vercel Cron setzt Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth === `Bearer ${cronSecret}`) return true;
  }

  // Rückwärtskompatibel: x-internal-token
  const internalToken = process.env.BISS_INTERNAL_TOKEN;
  if (internalToken && internalToken.length >= 16) {
    if (req.headers.get('x-internal-token') === internalToken) return true;
  }

  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const start = Date.now();
  try {
    // Parallel: Dispatch + Küchen-Sync + Stale-Driver-Cleanup + Live-ETA-Refresh + Shift-Cleanup
    const serviceSb = createServiceClient();

    // Demand-Snapshot alle 30 Min (Minute :00 oder :30)
    const nowMin = new Date().getUTCMinutes();
    const isDemandTick = nowMin < 2 || (nowMin >= 30 && nowMin < 32);

    // Rating-Tokens alle 10 Min generieren (Minute :00, :10, :20, :30, :40, :50)
    const isRatingTick = nowMin % 10 < 2;

    // Report-Cache täglich um 02:00 UTC (Tag-Report + Wochen-Report für alle Locations)
    const nowHour       = new Date().getUTCHours();
    const isReportTick  = nowHour === 2 && nowMin < 2;
    // Daily digest: täglich um 03:00 UTC (nach Report-Cache bei 02:00)
    const isDigestTick = nowHour === 3 && nowMin < 2;
    // Churn-Analyse: täglich um 02:00 UTC (zusammen mit Report-Cache)
    // Re-Engagement: täglich um 04:00 UTC (nach Digest)
    const isChurnTick   = nowHour === 2 && nowMin < 2;
    const isReEngageTick = nowHour === 4 && nowMin < 2;
    // Adress-Intelligenz-Scan: täglich um 05:00 UTC
    const isAddressScanTick = nowHour === 5 && nowMin < 2;
    // Peak-Pattern-Snapshot: täglich um 02:30 UTC (nach Report-Tick)
    const isPeakPatternTick = nowHour === 2 && nowMin >= 28 && nowMin < 32;
    // Peak-Alert-Analyse: täglich um 06:00 UTC (frühmorgens, für Tagesvorbereitung)
    const isPeakAlertTick = nowHour === 6 && nowMin < 2;
    // Tagesbericht E-Mail: täglich um 07:00 UTC (4h nach Digest-Generierung)
    const isDigestEmailTick = nowHour === 7 && nowMin < 2;
    // Fahrer-Tagesbericht: täglich 20:00 UTC (nach Schichtende)
    const isDriverDigestTick = nowHour === 20 && nowMin < 2;
    // Reorder-Profile: täglich um 03:30 UTC (nach Digest-Generierung)
    const isReorderTick = nowHour === 3 && nowMin >= 28 && nowMin < 32;
    // Subscription-Renewal: täglich um 01:00 UTC (Perioden verlängern)
    const isSubscriptionRenewalTick = nowHour === 1 && nowMin < 2;
    // Cash-Abgleich: täglich um 23:30 UTC (Tagesabschluss)
    const isCashReconcileTick = nowHour === 23 && nowMin >= 28 && nowMin < 32;
    // Geo-Clustering: täglich 04:00 UTC (nach Reorder, gute Datenbasis)
    const isGeoClusterTick = nowHour === 4 && nowMin < 2;
    // RFM-Segmentierung: täglich 04:30 UTC (nach Geo-Clustering)
    const isRfmTick = nowHour === 4 && nowMin >= 28 && nowMin < 32;
    // Feedback-Sentiment-Analyse: täglich 05:30 UTC (nach Address-Scan)
    const isSentimentTick = nowHour === 5 && nowMin >= 28 && nowMin < 32;
    // Smart-Upsell-Paare: täglich 04:15 UTC (nach Geo-Clustering, vor RFM)
    const isUpsellRebuildTick = nowHour === 4 && nowMin >= 14 && nowMin < 18;
    // Referral-Belohnungen: täglich 04:45 UTC (nach RFM und Upsell)
    const isReferralRewardTick = nowHour === 4 && nowMin >= 44 && nowMin < 48;
    // Customer Value Score: täglich 03:45 UTC (nach Reorder, vor Geo-Clustering)
    const isCvsTick = nowHour === 3 && nowMin >= 44 && nowMin < 48;
    // Driver Tip Snapshots: täglich 01:30 UTC (vor Subscription-Renewal, frische Tagesdaten)
    const isTipSnapshotTick = nowHour === 1 && nowMin >= 28 && nowMin < 32;
    // Demand-Forecast: Record snapshots alle 30 Min + fill actuals täglich 02:15 UTC
    const isForecastFillTick = nowHour === 2 && nowMin >= 14 && nowMin < 18;
    // Routen-Optimierung: alle 10 Min ausstehende Batches optimieren
    const isRouteOptimizeTick = isRatingTick;
    // Wetter-Intelligence: alle 30 Min Snapshot + täglich 02:00 UTC Cleanup
    const isWeatherTick = isDemandTick;

    const [dispatchResult, kitchenResult, staleResult, etaResult, shiftResult, demandResult, alertResult, recoveryResult, ratingTokensGenerated, delayResult, scheduleResult, webhookResult, reportCacheResult, etaCalibResult, surgeResult, windowResult, missedWindows, retryResult, queueSignalResult, creditsResult, broadcastsResult, customerPushResult, incidentsCreated, driverPerfResult, complianceResult, onboardingResult, slaEscalationResult, loyaltyExpireResult, navCachePruned, noShowResult, cdesResult, digestResult, challengeResult, positioningResult, profitabilityResult, churnAnalysisResult, reEngagementResult, healthObservatoryResult, healthSnapshotsPruned, surgePredictionResult, surgeEvalResult, ratingRecencyResult, addressScanResult, commsLogsPruned, zoneAffinityResult, reviewFlagScanResult, tourAnalyticsResult, geoDemandResult, flowIntelligenceResult, flowSnapshotsPruned, fatigueResult, fatigueSnapshotsPruned, peakPatternResult, peakAlertResult, peakAlertsPruned, menuSnapshotResult, menuSnapshotsPruned, prepProfilesResult, prepObservationsPruned, shiftSuggestionsResult, shiftSuggestionsPruned, slaCompResult, driverBonusResult, digestEmailResult, driverDigestResult, reorderProfilesResult, reorderProfilesPruned, subscriptionRenewalResult, cashReconcileResult, customerPushLogsPruned, customerPushSubsPruned, geoClusterResult, pushAnalyticsResult, campaignsResult, rfmResult, rfmPruned, vouchersPruned, sentimentResult, sentimentPruned, tripCostResult] = await Promise.all([
      smartDispatchTick(),
      syncKitchenNotifications(),
      serviceSb.rpc('mark_stale_drivers_offline').then(
        ({ data }) => ({ drivers_marked_offline: (data as number | null) ?? 0 }),
        () => ({ drivers_marked_offline: 0 }),
      ),
      refreshEnRouteEtas().catch(() => ({
        batches_processed: 0, orders_updated: 0, orders_skipped: 0, errors: 1,
      })),
      autoCloseMissedShifts().catch(() => ({ missed: 0 })),
      isDemandTick
        ? snapshotAllLocations().catch(() => ({ locations: 0, snapshots: 0 }))
        : Promise.resolve(null),
      evaluateAlertsAllLocations().catch(() => ({ locations: 0, created: 0, resolved: 0 })),
      scanStaleBatches(60).catch(() => ({ scanned: 0, recovered: [] as string[] })),
      // Rating-Tokens generieren + Links versenden (alle 10 Min)
      isRatingTick ? (async () => {
        try {
          const { data: locs } = await serviceSb.from('locations').select('id').eq('active', true).limit(20);
          let totalTokens = 0;
          for (const loc of locs ?? []) {
            totalTokens += await generateMissingRatingTokens(loc.id as string);
          }
          const linkResult = await processPendingRatingLinks();
          return { tokens: totalTokens, links_sent: linkResult.sent, links_processed: linkResult.processed };
        } catch { return { tokens: 0, links_sent: 0, links_processed: 0 }; }
      })() : Promise.resolve({ tokens: 0, links_sent: 0, links_processed: 0 }),
      // Delay-Monitor: verspätete Lieferungen erkennen + Gutscheine erstellen
      runDelayMonitorAllLocations().catch(() => ({
        locations: 0, totalScanned: 0, totalFirstNotices: 0,
        totalCriticalNotices: 0, totalVouchers: 0,
      })),
      // Geplante Vorbestellungen freigeben wenn Küchen-Startzeit erreicht
      releaseScheduledOrders().catch(() => ({ released: 0, orders: [] as string[] })),
      // Webhook-Queue verarbeiten: Events an externe Systeme ausliefern
      processAllWebhooks().catch(() => ({ processed: 0, succeeded: 0, failed: 0, disabled: 0 })),
      // Report-Cache täglich um 02:00 UTC: Tages- + Wochen-Snapshot für alle aktiven Locations
      isReportTick
        ? runDailyReportCache().catch(() => ({ locations: 0, snapshots: 0, errors: 1 }))
        : Promise.resolve(null),
      // ETA-Kalibrierung täglich um 02:00 UTC: Faktoren aus letzten 30 Tagen neu berechnen
      isReportTick
        ? recomputeEtaCalibration().catch(() => ({ locations: 0, factorsUpdated: 0, errors: 1 }))
        : Promise.resolve(null),
      // Surge Pricing: Nachfragespitzen erkennen + Fahrer-Boni aktivieren (jeder Tick)
      evaluateSurgeAllLocations().catch(() => ({ locations: 0, activated: 0, deactivated: 0, active: 0 })),
      // Window Booking: fällige Lieferfenster freigeben + abgelaufene als missed markieren
      processWindowDispatchAllLocations().catch(() => ({ locations: 0, released: 0 })),
      markMissedWindows().catch(() => 0),
      // Retry-Attempts: fällige Wiederholungsversuche in Dispatch-Queue freigeben
      releaseRetryAttempts().catch(() => ({ released: 0 })),
      // Queue-Signal: Küchenauslastung → Storefront-Wartezeit-Banner (jeder Tick)
      evaluateAutoSignalAllLocations().catch(() => ({ locations: 0, upgraded: 0, downgraded: 0, errors: 0 })),
      // Credits: abgelaufene Gutschriften als 'expired' markieren (stündlich ausreichend, hier jeder Tick)
      expireStaleCredits().catch(() => ({ expired: 0 })),
      // Broadcasts: abgelaufene Nachrichten (>24h) bereinigen (stündlich ausreichend, hier jeder Tick)
      expireOldBroadcasts().catch(() => ({ deleted: 0 })),
      // Customer Push: ausstehende SMS/WhatsApp-Benachrichtigungen versenden (jeder Tick)
      processAllCustomerNotifications().catch(() => ({ processed: 0, sent: 0, failed: 0, skipped: 0 })),
      // Incidents: schlechte Bewertungen (≤2★) ohne Incident nachholen (Sicherheitsnetz)
      autoCreateIncidentsForRatings().catch(() => 0),
      // Driver-Performance-Snapshots täglich um 02:00 UTC: gestrigen Tag für alle Locations
      isReportTick
        ? snapshotDriverPerformance().catch(() => ({ locations: 0, snapshots: 0, errors: 1 }))
        : Promise.resolve(null),
      // Compliance: abgelaufene Zertifikate markieren + ablaufende zählen (stündlich ausreichend)
      isReportTick || isDemandTick
        ? evaluateComplianceAllLocations().catch(() => ({ locations: 0, alertsGenerated: 0, expiredAutoUpdated: 0, errors: 1 }))
        : Promise.resolve(null),
      // Onboarding: abgelaufene pending-Bewerbungen als 'withdrawn' markieren (alle 30 Min reicht)
      isDemandTick
        ? expireStaleApplicationsAllLocations().catch(() => ({ expired: 0 }))
        : Promise.resolve(null),
      // SLA-Eskalation: kritischer Alert wenn On-Time-Rate < 80% (alle 10 Min)
      isRatingTick
        ? runSlaEscalationAllLocations().catch(() => ({ locations_checked: 0, escalated: 0, resolved: 0, below_threshold: [] }))
        : Promise.resolve(null),
      // Loyalty-Punkte: abgelaufene Punkte verfallen lassen (täglich um 02:00 UTC)
      isReportTick
        ? processExpiredPointsAllLocations().catch(() => ({ locations: 0, totalExpired: 0 }))
        : Promise.resolve(null),
      // Nav-Cache: alte Routen-Caches löschen (alle 2 Stunden)
      pruneNavCache().catch(() => 0),
      // No-Show-Erkennung: verpasste Schichten → Event + Broadcast (alle 30 Min)
      isDemandTick
        ? detectAndHandleNoShowsAllLocations().catch(() => ({ locations: 0, total_detected: 0, broadcasts_sent: 0 }))
        : Promise.resolve(null),
      // CDES: Customer Delivery Experience Score für abgeschlossene Lieferungen berechnen (alle 30 Min)
      isDemandTick
        ? processCdesAllLocations().catch(() => ({ locations: 0, totalProcessed: 0, totalRecoveries: 0, errors: 0 }))
        : Promise.resolve(null),
      // Daily Digest: täglich um 03:00 UTC — gestrigen Tag für alle Locations
      isDigestTick
        ? generateDigestAllLocations().catch(() => ({ locations: 0, generated: 0, errors: 1 }))
        : Promise.resolve(null),
      // Challenges: Fortschritt aktualisieren + abgelaufene/neue Challenges aktivieren (alle 5 Min)
      isRatingTick
        ? checkAndAwardChallengesAllLocations().catch(() => ({ locations: 0, checked: 0, progressUpdated: 0, autoCompleted: 0 }))
        : Promise.resolve(null),
      // Fahrer-Positionierung: Vorschläge generieren (alle 10 Min)
      isRatingTick
        ? runPositioningAllLocations().catch(() => ({ locations: 0, total_created: 0, total_expired: 0 }))
        : Promise.resolve(null),
      // Profitabilitäts-Snapshot: täglich um 02:00 UTC (Vortag aggregieren)
      isReportTick
        ? snapshotProfitability().catch(() => ({ locations: 0, snapshots: 0 }))
        : Promise.resolve(null),
      // Churn-Prävention: Abwanderungsrisiko täglich um 02:00 UTC analysieren
      isChurnTick
        ? analyzeChurnAllLocations().catch(() => ({ locations: 0, totalAnalyzed: 0, totalUpserted: 0 }))
        : Promise.resolve(null),
      // Re-Engagement: Gutschriften an gefährdete Kunden täglich um 04:00 UTC
      isReEngageTick
        ? runReEngagementAllLocations().catch(() => ({ locations: 0, totalEligible: 0, totalSent: 0, totalCredits: 0 }))
        : Promise.resolve(null),
      // Health-Observatory: operationale KPI-Snapshots alle 10 Min
      isRatingTick
        ? takeHealthSnapshots().catch(() => ({ locations: 0, snapshots: 0, errors: 0 }))
        : Promise.resolve(null),
      // Health-Snapshots Cleanup: Snapshots > 7 Tage löschen (täglich 02:00 UTC)
      isReportTick
        ? pruneOldSnapshots().catch(() => 0)
        : Promise.resolve(0),
      // Surge-Vorhersage: Nachfragespitzen 30-60 Min voraus erkennen + Fahrer mobilisieren (alle 10 Min)
      isRatingTick
        ? runSurgePredictionAllLocations().catch(() => ({ locations: 0, predictions: 0, broadcasts: 0, skipped: 0 }))
        : Promise.resolve(null),
      // Surge-Evaluierung: abgelaufene Vorhersagen auf Korrektheit prüfen (alle 10 Min)
      isRatingTick
        ? evaluatePastPredictions().catch(() => ({ evaluated: 0 }))
        : Promise.resolve(null),
      // Fahrer-Rating Recency-Neuberechnung: täglich um 02:00 UTC alle aktiven Locations (Phase 106)
      isReportTick
        ? (async () => {
            try {
              const { data: locs } = await serviceSb.from('locations').select('id').eq('active', true).limit(20);
              let totalRecomputed = 0;
              let totalErrors = 0;
              for (const loc of locs ?? []) {
                const r = await batchRecomputeRatingsForLocation(loc.id as string);
                totalRecomputed += r.recomputed;
                totalErrors     += r.errors;
              }
              return { recomputed: totalRecomputed, errors: totalErrors };
            } catch { return { recomputed: 0, errors: 1 }; }
          })()
        : Promise.resolve(null),
      isAddressScanTick
        ? scanProblematicAddressesAllLocations().catch(() => ({ locations: 0, totalProblematic: 0 }))
        : Promise.resolve(null),
      // Kommunikations-Log bereinigen: Logs > 90 Tage löschen (täglich 02:00 UTC)
      isReportTick
        ? pruneOldCommsLogs(90).catch(() => 0)
        : Promise.resolve(0),
      // Zonen-Affinität: Fahrer-Zone-Stats nachtliches Reconcile (täglich 02:00 UTC, Phase 110)
      isReportTick
        ? refreshZoneAffinityAllLocations().catch(() => ({ locations: 0, driversUpdated: 0, errors: 1 }))
        : Promise.resolve(null),
      // Review-Flag-Scan: alle Fahrer täglich um 06:00 UTC auf Review-Würdigkeit prüfen (Phase 112)
      (nowHour === 6 && nowMin < 2)
        ? checkAllDrivers().catch(() => ({ locations: 0, driversChecked: 0, flagged: 0, alreadyFlagged: 0, errors: 1 }))
        : Promise.resolve(null),
      // Tour Performance Analytics: nächtlicher Backfill für abgeschlossene Touren (Phase 115)
      isReportTick
        ? scanAndRecordCompletedTours().catch(() => ({ locations: 0, toursProcessed: 0, errors: 1 }))
        : Promise.resolve(null),
      // Geo-Demand Snapshot: PLZ-Nachfrage-Dichte täglich um 02:00 UTC (Phase 116)
      isReportTick
        ? snapshotGeoDemandAllLocations().catch(() => ({ locations: 0, plzs: 0, errors: 1 }))
        : Promise.resolve(null),
      // Flow-Intelligence: Bestellfluss-Snapshot + Anomalie-Erkennung alle 5 Min (isRatingTick)
      isRatingTick
        ? runFlowIntelligenceAllLocations().catch(() => ({ locations: 0, snapshots: 0, anomalies: 0, errors: 1 }))
        : Promise.resolve(null),
      // Flow-Snapshots: alte Snapshots (>14 Tage) täglich bereinigen
      isReportTick
        ? pruneOldFlowSnapshots().catch(() => 0)
        : Promise.resolve(null),
      // Fahrer-Ermüdungsmonitor: alle Online-Fahrer alle 10 Min snapshotten (Phase 119)
      isRatingTick
        ? snapshotFatigueAllLocations().catch(() => ({ locations: 0, drivers: 0, atRisk: 0, errors: 1 }))
        : Promise.resolve(null),
      // Fatigue-Snapshots bereinigen: Snapshots > 30 Tage löschen (täglich 02:00 UTC)
      isReportTick
        ? pruneFatigueSnapshots(30).catch(() => 0)
        : Promise.resolve(null),
      // Peak-Day-Pattern-Snapshot: täglich 02:30 UTC (Phase 120)
      isPeakPatternTick
        ? snapshotPeakPatterns().catch(() => null)
        : Promise.resolve(null),
      // Peak-Alert-Analyse: täglich 06:00 UTC (Phase 120)
      isPeakAlertTick
        ? analyzePeakAllLocations().catch(() => null)
        : Promise.resolve(null),
      // Peak-Alerts bereinigen: erledigte Alerts > 30 Tage (täglich 02:00 UTC, Phase 120)
      isReportTick
        ? prunePeakAlerts().catch(() => 0)
        : Promise.resolve(null),
      // Menü-Analytics Snapshot: täglich 02:00 UTC (Phase 121)
      isReportTick
        ? snapshotMenuAllLocations().catch(() => ({ locations: 0, items_upserted: 0, orders_analyzed: 0, errors: 1 }))
        : Promise.resolve(null),
      // Menü-Snapshots bereinigen: > 90 Tage (täglich 02:00 UTC, Phase 121)
      isReportTick
        ? pruneMenuSnapshots(90).catch(() => 0)
        : Promise.resolve(null),
      // Küchen-Lernkurve: Profile neu berechnen täglich 02:00 UTC (Phase 127)
      isReportTick
        ? recomputePrepProfilesAllLocations().catch(() => ({ locations: 0, profilesUpdated: 0, errors: 1 }))
        : Promise.resolve(null),
      // Küchen-Lernkurve: alte Beobachtungen bereinigen > 90 Tage (Phase 127)
      isReportTick
        ? prunePrepObservations(90).catch(() => 0)
        : Promise.resolve(null),
      // Phase 156: Auto-Schichtvorschläge täglich 05:00 UTC generieren
      (nowHour === 5 && nowMin < 2)
        ? generateShiftSuggestionsAllLocations().catch(() => ({ locations: 0, suggestionsCreated: 0, errors: 1 }))
        : Promise.resolve(null),
      // Phase 156: Veraltete pending-Vorschläge täglich bereinigen (02:00 UTC)
      isReportTick
        ? pruneStaleSuggestions().catch(() => 0)
        : Promise.resolve(null),
      // Phase 157: SLA Auto-Kompensation alle 30 Min prüfen (isDemandTick)
      isDemandTick
        ? processAutoCompensationsAllLocations().catch(() => ({ locations: 0, compensated: 0, totalEurIssued: 0, errors: 1 }))
        : Promise.resolve(null),
      // Phase 158: Fahrer-Boni auswerten — täglich 02:00 UTC
      isReportTick
        ? evaluateBonusesAllLocations().catch(() => ({ locations: 0, bonusesCreated: 0, totalEurQueued: 0, errors: 1 }))
        : Promise.resolve(null),
      // Phase 163: Tagesbericht E-Mail an Manager — täglich 07:00 UTC
      isDigestEmailTick
        ? sendDailyDigestAllLocations().catch(() => ({ locations: 0, sent: 0, skipped: 0, failed: 0, errors: 1 }))
        : Promise.resolve(null),
      // Phase 164: Fahrer Tagesabschluss-E-Mail — täglich 20:00 UTC
      isDriverDigestTick
        ? sendDriverDailyDigestAllLocations().catch(() => ({ locations: 0, driversSent: 0, driversSkipped: 0, driversFailed: 0, errors: 1 }))
        : Promise.resolve(null),
      // Phase 166: Reorder-Profile aufbauen — täglich um 03:30 UTC
      isReorderTick
        ? buildReorderProfiles().catch(() => ({ locations: 0, profilesUpserted: 0, errors: 1 }))
        : Promise.resolve(null),
      // Phase 166: Veraltete Reorder-Profile bereinigen — täglich um 02:00 UTC
      isReportTick
        ? pruneReorderProfiles(180).catch(() => 0)
        : Promise.resolve(null),
      // Phase 168: Subscription-Renewal — täglich 01:00 UTC
      isSubscriptionRenewalTick
        ? renewExpiredSubscriptions().catch(() => ({ locations: 0, renewed: 0, errors: 1 }))
        : Promise.resolve(null),
      // Phase 169: Cash-Abgleich — täglich 23:30 UTC (Tagesabschluss)
      isCashReconcileTick
        ? reconcileCashAllLocations().catch(() => ({ locations: 0, created: 0, updated: 0, errors: 1 }))
        : Promise.resolve(null),
      // Phase 172: Customer Web Push — Logs > 30 Tage + inaktive Subs > 90 Tage (täglich 02:00 UTC)
      isReportTick
        ? pruneCustomerPushLogs(30).catch(() => 0)
        : Promise.resolve(0),
      isReportTick
        ? pruneInactiveSubscriptions(90).catch(() => 0)
        : Promise.resolve(0),
      // Phase 173: Geo-Clustering — täglich 04:00 UTC
      isGeoClusterTick
        ? computeClustersAllLocations().catch(() => ({ locations: 0, clusters_upserted: 0, orders_analyzed: 0, errors: 1 }))
        : Promise.resolve(null),
      // Phase 175: Push-Analytics — täglich 02:00 UTC + alle 30 Min Near-Real-Time
      isDemandTick
        ? computePushAnalyticsAllLocations().catch(() => ({ locations: 0, errors: 1 }))
        : Promise.resolve(null),
      // Phase 177: Push-Kampagnen — fällige Kampagnen alle 10 Min prüfen + versenden
      isRatingTick
        ? runDueCampaigns().catch(() => ({ executed: 0, totalSent: 0, errors: 1 }))
        : Promise.resolve(null),
      // Phase 178: RFM-Segmentierung — täglich 04:30 UTC
      isRfmTick
        ? buildRfmAllLocations().catch(() => ({ locations: 0, profilesUpserted: 0, errors: 1 }))
        : Promise.resolve(null),
      // Phase 178: RFM-Profile bereinigen — täglich 02:00 UTC (Profile > 30 Tage)
      isReportTick
        ? pruneStaleRfmProfiles(30).catch(() => 0)
        : Promise.resolve(0),
      // Phase 179: Abgelaufene Voucher deaktivieren — täglich 02:00 UTC (>90 Tage alt)
      isReportTick
        ? pruneExpiredVouchers().catch(() => 0)
        : Promise.resolve(0),
      // Phase 181: Feedback-Sentiment-Analyse — täglich 05:30 UTC
      isSentimentTick
        ? processAllUnanalyzedLocations().catch(() => null).then(() => ({ ok: true }))
        : Promise.resolve(null),
      // Phase 181: Alte Sentiment-Einträge bereinigen (>180 Tage) — täglich 02:00 UTC
      isReportTick
        ? pruneSentimentData(180).catch(() => 0)
        : Promise.resolve(0),
      // Phase 183: Trip-Kosten-Berechnung — täglich 02:30 UTC (nach Report-Tick, frische Batch-Daten)
      isPeakPatternTick
        ? computeTripCosts().catch(() => ({ locations: 0, computed: 0, errors: 1 }))
        : Promise.resolve(null),
      // Phase 185: Menü-Verfügbarkeits-Engine — alle 2 Min evaluieren (Queue-basiertes Auto-Disable)
      evaluateMenuAvailability().catch(() => [] as unknown[]),
      // Phase 185: 7-Tage-Deaktivierungs-Zähler — täglich 02:00 UTC aktualisieren
      isReportTick
        ? refreshDisableCounts().catch(() => null)
        : Promise.resolve(null),
    ]);

    // Phase 186: Smart Upsell — Pair-Rebuild täglich 04:15 UTC (nach Geo-Clustering)
    const upsellRebuildResult = isUpsellRebuildTick
      ? await rebuildUpsellPairs().catch(() => ({ locations: 0, pairs_upserted: 0, orders_analyzed: 0, errors: 1 }))
      : null;

    // Phase 190: Referral-Belohnungen verarbeiten + abgelaufene Konversionen bereinigen (04:45 UTC)
    const referralResult = isReferralRewardTick
      ? await processReferralRewards().catch(() => ({ locations: 0, rewarded: 0, errors: 1 }))
      : null;
    if (isReportTick) {
      expireReferralConversions().catch(() => {});
    }

    // Phase 192: Customer Value Score — täglich 03:45 UTC (nach Reorder-Profilen, vor Geo-Clustering)
    const cvsResult = isCvsTick
      ? await computeCvsAllLocations().catch(() => ({ locations: 0, scoresUpserted: 0, errors: 1 }))
      : null;
    if (isReportTick) {
      pruneCvsScores(45).catch(() => {});
    }

    // Phase 197: Driver Streak Overview — alle 30 Min (read-only Snapshot für Monitoring)
    const streakOverview = isDemandTick
      ? await buildStreakOverviewAllLocations().catch(() => ({ locations: 0, active_streakers: 0, errors: 1 }))
      : null;

    // Phase 198: Driver Tip Snapshots — täglich 01:30 UTC
    const tipSnapshotResult = isTipSnapshotTick
      ? await snapshotDriverTipsAllLocations().catch(() => ({ locations: 0, errors: 1, tipsTotal: 0, eurTotal: 0 }))
      : null;

    // Phase 201: Demand-Forecast — Snapshots alle 30 Min, Ist-Werte täglich 02:15 UTC
    const demandForecastResult = isDemandTick
      ? await recordForecastAllLocations().catch(() => ({ locations: 0, saved: 0, errors: 1 }))
      : null;
    const demandForecastFillResult = isForecastFillTick
      ? await fillActualsAllLocations().catch(() => ({ locations: 0, filled: 0, errors: 1 }))
      : null;
    if (isReportTick) {
      pruneForecastSnapshots(60).catch(() => {});
    }

    // Phase 202: Routen-Optimierung — alle 10 Min ausstehende Batches optimieren
    const routeOptResult = isRouteOptimizeTick
      ? await optimizeRoutesAllLocations().catch(() => ({ locations: 0, processed: 0, optimized: 0, totalKmSaved: 0 }))
      : null;

    // Phase 203: Wetter-Intelligence — alle 30 Min Snapshot
    const weatherResult = isWeatherTick
      ? await takeWeatherSnapshotAllLocations().catch(() => ({ locations: 0, snapshots: 0, dangerous: 0, errors: 1 }))
      : null;
    if (isReportTick) {
      pruneOldWeatherSnapshots(30).catch(() => {});
    }

    // Phase 205: Driver Composite Scores — täglich 02:00 UTC (nach Performance-Snapshots)
    const driverScoreResult = isReportTick
      ? await computeDriverScoresAllLocations('week').catch(() => ({ locations: 0, computed: 0, errors: 1 }))
      : null;

    // Phase 206: Network Health Snapshots — alle 30 Min (isDemandTick)
    const networkHealthResult = isDemandTick
      ? await snapshotNetworkHealth().catch(() => ({ locations: 0, snapshots: 0, errors: 1 }))
      : null;
    if (isReportTick) {
      pruneOldNetworkSnapshots(90).catch(() => {});
    }

    // Phase 207: Capacity Planner — täglich 02:30 UTC
    const isCapacityTick = nowHour === 2 && nowMin >= 30 && nowMin < 32;
    const capacityPlanResult = isCapacityTick
      ? await generateCapacityPlanAllLocations().catch(() => ({ locations: 0, slotsUpserted: 0, errors: 1 }))
      : null;
    if (isCapacityTick) {
      pruneCapacitySlots(14).catch(() => {});
      pruneAutoShiftDrafts(30).catch(() => {});
    }

    // Phase 211: Amendments Cleanup — täglich 02:00 UTC (Einträge > 90 Tage)
    const amendmentsPruned = isReportTick
      ? await pruneOldAmendmentsAllLocations(90).catch(() => 0)
      : 0;

    const durationMs = Date.now() - start;
    return NextResponse.json({
      ok: true,
      duration_ms: durationMs,
      scanned:    dispatchResult.scanned,
      dispatched: dispatchResult.dispatched,
      bundled:    dispatchResult.bundled,
      held:       dispatchResult.held,
      escalated:  dispatchResult.escalated,
      kitchen: {
        notified: kitchenResult.notified,
        locations: kitchenResult.locations,
      },
      stale_drivers_cleaned: staleResult.drivers_marked_offline,
      eta_refresh: {
        batches: etaResult.batches_processed,
        updated: etaResult.orders_updated,
      },
      shifts_closed: shiftResult.missed,
      alerts: {
        created:  alertResult.created,
        resolved: alertResult.resolved,
      },
      ...(demandResult ? { demand_snapshot: demandResult } : {}),
      recovery: {
        batches_scanned: recoveryResult.scanned,
        batches_recovered: recoveryResult.recovered.length,
      },
      ...(isRatingTick ? { rating: ratingTokensGenerated } : {}),
      delay_monitor: {
        scanned:          delayResult.totalScanned,
        first_notices:    delayResult.totalFirstNotices,
        critical_notices: delayResult.totalCriticalNotices,
        vouchers_created: delayResult.totalVouchers,
      },
      scheduled_releases: scheduleResult.released,
      webhooks: {
        processed: webhookResult.processed,
        succeeded: webhookResult.succeeded,
        failed:    webhookResult.failed,
      },
      ...(reportCacheResult ? { report_cache: reportCacheResult } : {}),
      ...(etaCalibResult ? { eta_calibration: etaCalibResult } : {}),
      surge: {
        locations: surgeResult.locations,
        activated: surgeResult.activated,
        deactivated: surgeResult.deactivated,
        active: surgeResult.active,
      },
      windows: {
        released: windowResult.released,
        missed_marked: missedWindows,
      },
      retry_attempts_released: retryResult.released,
      queue_signal: {
        locations: queueSignalResult.locations,
        upgraded:  queueSignalResult.upgraded,
        downgraded: queueSignalResult.downgraded,
      },
      credits_expired: creditsResult.expired,
      broadcasts_cleaned: broadcastsResult.deleted,
      customer_push: {
        processed: customerPushResult.processed,
        sent:      customerPushResult.sent,
        failed:    customerPushResult.failed,
      },
      incidents_created: incidentsCreated,
      ...(driverPerfResult ? { driver_performance_snapshots: driverPerfResult } : {}),
      ...(complianceResult ? { compliance: complianceResult } : {}),
      ...(onboardingResult ? { onboarding_expired: onboardingResult.expired } : {}),
      ...(slaEscalationResult ? { sla_escalation: { escalated: slaEscalationResult.escalated, resolved: slaEscalationResult.resolved, below_threshold: slaEscalationResult.below_threshold.length } } : {}),
      ...(loyaltyExpireResult ? { loyalty_points_expired: loyaltyExpireResult.totalExpired } : {}),
      nav_cache_pruned: navCachePruned ?? 0,
      ...(noShowResult ? { no_show_detection: { detected: noShowResult.total_detected, broadcasts_sent: noShowResult.broadcasts_sent } } : {}),
      ...(cdesResult ? { cdes: { processed: cdesResult.totalProcessed, recoveries: cdesResult.totalRecoveries } } : {}),
      ...(digestResult ? { daily_digest: { locations: digestResult.locations, generated: digestResult.generated, errors: digestResult.errors } } : {}),
      ...(challengeResult ? { challenges: { checked: challengeResult.checked, progress_updated: challengeResult.progressUpdated, auto_completed: challengeResult.autoCompleted } } : {}),
      ...(positioningResult ? { positioning: { locations: positioningResult.locations, created: positioningResult.total_created, expired: positioningResult.total_expired } } : {}),
      ...(profitabilityResult ? { profitability_snapshots: { locations: profitabilityResult.locations, snapshots: profitabilityResult.snapshots } } : {}),
      ...(churnAnalysisResult ? { churn_analysis: { locations: churnAnalysisResult.locations, analyzed: churnAnalysisResult.totalAnalyzed, upserted: churnAnalysisResult.totalUpserted } } : {}),
      ...(reEngagementResult ? { churn_re_engagement: { locations: reEngagementResult.locations, eligible: reEngagementResult.totalEligible, sent: reEngagementResult.totalSent, credits: reEngagementResult.totalCredits } } : {}),
      ...(healthObservatoryResult ? { health_observatory: { locations: healthObservatoryResult.locations, snapshots: healthObservatoryResult.snapshots, errors: healthObservatoryResult.errors } } : {}),
      ...(healthSnapshotsPruned ? { health_snapshots_pruned: healthSnapshotsPruned } : {}),
      ...(surgePredictionResult ? { surge_prediction: { predictions: surgePredictionResult.predictions, broadcasts: surgePredictionResult.broadcasts, skipped: surgePredictionResult.skipped } } : {}),
      ...(surgeEvalResult ? { surge_eval: { evaluated: surgeEvalResult.evaluated } } : {}),
      ...(ratingRecencyResult ? { rating_recency: { recomputed: ratingRecencyResult.recomputed, errors: ratingRecencyResult.errors } } : {}),
      ...(addressScanResult ? { address_intelligence: { locations: addressScanResult.locations, problematic: addressScanResult.totalProblematic } } : {}),
      ...(commsLogsPruned ? { comms_logs_pruned: commsLogsPruned } : {}),
      ...(zoneAffinityResult ? { zone_affinity: { locations: zoneAffinityResult.locations, drivers_updated: zoneAffinityResult.driversUpdated, errors: zoneAffinityResult.errors } } : {}),
      ...(reviewFlagScanResult ? { review_flag_scan: { drivers_checked: reviewFlagScanResult.driversChecked, flagged: reviewFlagScanResult.flagged, already_flagged: reviewFlagScanResult.alreadyFlagged, errors: reviewFlagScanResult.errors } } : {}),
      ...(tourAnalyticsResult ? { tour_analytics: { locations: tourAnalyticsResult.locations, tours_processed: tourAnalyticsResult.toursProcessed, errors: tourAnalyticsResult.errors } } : {}),
      ...(geoDemandResult ? { geo_demand: { locations: geoDemandResult.locations, plzs: geoDemandResult.plzs, errors: geoDemandResult.errors } } : {}),
      ...(flowIntelligenceResult ? { flow_intelligence: { locations: flowIntelligenceResult.locations, snapshots: flowIntelligenceResult.snapshots, anomalies: flowIntelligenceResult.anomalies, errors: flowIntelligenceResult.errors } } : {}),
      ...(flowSnapshotsPruned ? { flow_snapshots_pruned: flowSnapshotsPruned } : {}),
      ...(fatigueResult ? { fatigue_monitor: { locations: fatigueResult.locations, drivers: fatigueResult.drivers, at_risk: fatigueResult.atRisk, errors: fatigueResult.errors } } : {}),
      ...(fatigueSnapshotsPruned ? { fatigue_snapshots_pruned: fatigueSnapshotsPruned } : {}),
      ...(peakPatternResult ? { peak_patterns: { locations: peakPatternResult.locations, snapshots: peakPatternResult.snapshots, peak_days: peakPatternResult.peak_days, errors: peakPatternResult.errors } } : {}),
      ...(peakAlertResult ? { peak_alerts: { locations: peakAlertResult.locations, created: peakAlertResult.total_alerts_created, updated: peakAlertResult.total_alerts_updated, errors: peakAlertResult.errors } } : {}),
      ...(peakAlertsPruned ? { peak_alerts_pruned: peakAlertsPruned } : {}),
      ...(menuSnapshotResult ? { menu_analytics: { locations: menuSnapshotResult.locations, items_upserted: menuSnapshotResult.items_upserted, orders_analyzed: menuSnapshotResult.orders_analyzed, errors: menuSnapshotResult.errors } } : {}),
      ...(menuSnapshotsPruned ? { menu_snapshots_pruned: menuSnapshotsPruned } : {}),
      ...(prepProfilesResult ? { prep_learning: { locations: prepProfilesResult.locations, profiles_updated: prepProfilesResult.profilesUpdated, errors: prepProfilesResult.errors } } : {}),
      ...(prepObservationsPruned ? { prep_observations_pruned: prepObservationsPruned } : {}),
      ...(shiftSuggestionsResult ? { shift_suggestions: { locations: shiftSuggestionsResult.locations, created: shiftSuggestionsResult.suggestionsCreated, errors: shiftSuggestionsResult.errors } } : {}),
      ...(shiftSuggestionsPruned ? { shift_suggestions_pruned: shiftSuggestionsPruned } : {}),
      ...(slaCompResult ? { sla_compensation: { locations: slaCompResult.locations, compensated: slaCompResult.compensated, total_eur: slaCompResult.totalEurIssued } } : {}),
      ...(driverBonusResult ? { driver_bonuses: { locations: driverBonusResult.locations, created: driverBonusResult.bonusesCreated, total_eur: driverBonusResult.totalEurQueued } } : {}),
      ...(digestEmailResult ? { digest_email: { locations: digestEmailResult.locations, sent: digestEmailResult.sent, skipped: digestEmailResult.skipped, failed: digestEmailResult.failed } } : {}),
      ...(driverDigestResult ? { driver_digest: { locations: driverDigestResult.locations, sent: driverDigestResult.driversSent, skipped: driverDigestResult.driversSkipped, failed: driverDigestResult.driversFailed } } : {}),
      ...(reorderProfilesResult ? { reorder_profiles: { locations: reorderProfilesResult.locations, profiles_upserted: reorderProfilesResult.profilesUpserted, errors: reorderProfilesResult.errors } } : {}),
      ...(reorderProfilesPruned ? { reorder_profiles_pruned: reorderProfilesPruned } : {}),
      ...(subscriptionRenewalResult ? { subscription_renewal: { locations: subscriptionRenewalResult.locations, renewed: subscriptionRenewalResult.renewed, errors: subscriptionRenewalResult.errors } } : {}),
      ...(cashReconcileResult ? { cash_reconcile: { locations: cashReconcileResult.locations, created: cashReconcileResult.created, updated: cashReconcileResult.updated, errors: cashReconcileResult.errors } } : {}),
      ...(customerPushLogsPruned ? { customer_push_logs_pruned: customerPushLogsPruned } : {}),
      ...(customerPushSubsPruned ? { customer_push_subs_pruned: customerPushSubsPruned } : {}),
      ...(geoClusterResult ? { geo_clustering: { locations: geoClusterResult.locations, clusters_upserted: geoClusterResult.clusters_upserted, orders_analyzed: geoClusterResult.orders_analyzed, errors: geoClusterResult.errors } } : {}),
      ...(pushAnalyticsResult ? { push_analytics: { locations: pushAnalyticsResult.locations, errors: pushAnalyticsResult.errors } } : {}),
      ...(campaignsResult ? { campaigns: { executed: campaignsResult.executed, sent: campaignsResult.totalSent, errors: campaignsResult.errors } } : {}),
      ...(rfmResult ? { rfm_segmentation: { locations: rfmResult.locations, profiles_upserted: rfmResult.profilesUpserted, errors: rfmResult.errors } } : {}),
      ...(rfmPruned ? { rfm_profiles_pruned: rfmPruned } : {}),
      ...(vouchersPruned ? { vouchers_pruned: vouchersPruned } : {}),
      ...(sentimentResult ? { feedback_sentiment: { ok: true } } : {}),
      ...(sentimentPruned ? { sentiment_pruned: sentimentPruned } : {}),
      ...(tripCostResult ? { trip_costs: { locations: tripCostResult.locations, computed: tripCostResult.computed, errors: tripCostResult.errors } } : {}),
      ...(upsellRebuildResult ? { upsell_pairs: { locations: upsellRebuildResult.locations, pairs_upserted: upsellRebuildResult.pairs_upserted, orders_analyzed: upsellRebuildResult.orders_analyzed, errors: upsellRebuildResult.errors } } : {}),
      ...(referralResult ? { referral_rewards: { locations: referralResult.locations, rewarded: referralResult.rewarded, errors: referralResult.errors } } : {}),
      ...(cvsResult ? { customer_value_scores: { locations: cvsResult.locations, scores_upserted: cvsResult.scoresUpserted, errors: cvsResult.errors } } : {}),
      ...(streakOverview ? { driver_streaks: { locations: streakOverview.locations, active_streakers: streakOverview.active_streakers } } : {}),
      ...(tipSnapshotResult ? { driver_tips: { locations: tipSnapshotResult.locations, tips: tipSnapshotResult.tipsTotal, eur: tipSnapshotResult.eurTotal, errors: tipSnapshotResult.errors } } : {}),
      ...(demandForecastResult ? { demand_forecast_snapshots: { locations: demandForecastResult.locations, saved: demandForecastResult.saved, errors: demandForecastResult.errors } } : {}),
      ...(demandForecastFillResult ? { demand_forecast_actuals: { locations: demandForecastFillResult.locations, filled: demandForecastFillResult.filled, errors: demandForecastFillResult.errors } } : {}),
      ...(routeOptResult ? { route_optimization: { locations: routeOptResult.locations, optimized: routeOptResult.optimized, km_saved: routeOptResult.totalKmSaved } } : {}),
      ...(weatherResult ? { weather_intelligence: { locations: weatherResult.locations, snapshots: weatherResult.snapshots, dangerous: weatherResult.dangerous, errors: weatherResult.errors } } : {}),
      ...(driverScoreResult ? { driver_composite_scores: { locations: driverScoreResult.locations, computed: driverScoreResult.computed, errors: driverScoreResult.errors } } : {}),
      ...(networkHealthResult ? { network_health: { locations: networkHealthResult.locations, snapshots: networkHealthResult.snapshots, errors: networkHealthResult.errors } } : {}),
      ...(capacityPlanResult ? { capacity_plan: { locations: capacityPlanResult.locations, slots_upserted: capacityPlanResult.slotsUpserted, errors: capacityPlanResult.errors } } : {}),
      ...(amendmentsPruned ? { amendments_pruned: amendmentsPruned } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg, duration_ms: Date.now() - start }, { status: 500 });
  }
}
