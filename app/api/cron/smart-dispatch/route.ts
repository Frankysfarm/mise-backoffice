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
import { snapshotCarbonAllLocations, pruneCo2Snapshots } from '@/lib/delivery/carbon-footprint';
import { snapshotAllLocations as snapshotQualityScores, pruneOldScores as pruneQualityScores } from '@/lib/delivery/quality-score';
import { snapshotAllLocations as snapshotBenchmarks, pruneOldBenchmarks } from '@/lib/delivery/benchmarking';
import { evaluateIncentivesAllLocations, approveIncentivesAllLocations, pruneOldIncentiveEvents } from '@/lib/delivery/driver-incentives';
import { snapshotAllLocations as snapshotDriverRetention, pruneOldRetentionScores } from '@/lib/delivery/driver-retention';
import { snapshotAllLocations as snapshotShiftPredictions, pruneOldPredictions } from '@/lib/delivery/shift-performance-prediction';
import { snapshotAllLocations as snapshotDriverSatisfaction, pruneOldScores as pruneSatisfactionScores } from '@/lib/delivery/driver-satisfaction';
import { snapshotAllLocations as snapshotDriverWellbeing, pruneOldSnapshots as pruneWellbeingSnapshots } from '@/lib/delivery/driver-wellbeing';
import { buildAllLocations as buildCustomerCohorts, pruneOldSnapshots as pruneCohortSnapshots } from '@/lib/delivery/customer-cohorts';
import { buildAllLocations as buildCapacityForecast, pruneOldForecasts as pruneCapacityForecasts } from '@/lib/delivery/capacity-forecast';
import { settleAllLocations as settleDeliveryPromises, pruneOldPromises } from '@/lib/delivery/delivery-promise';
import { buildAllLocations as buildDriverRouteProfiles, pruneOldObservations as pruneRouteObservations } from '@/lib/delivery/driver-route-learning';
import { buildPredictionsAllLocations, settleAllLocations as settlePerformancePredictions, pruneOldPredictions as prunePerformancePredictions } from '@/lib/delivery/driver-performance-prediction';
import { generateHandoverAllLocations, pruneOldHandoverReports } from '@/lib/delivery/shift-handover';
import { aggregateFeedbackAllLocations, pruneOldFeedback } from '@/lib/delivery/driver-feedback';
import { snapshotZoneCapacityAllLocations, rebalanceAllLocations, pruneOldSnapshots as pruneZoneSnapshots } from '@/lib/delivery/zone-rebalancing';
import { snapAllLocations as snapOrderLifecycle, pruneOldLifecycleSnapshots } from '@/lib/delivery/order-lifecycle';
import { snapshotAllLocations as snapshotGeoHeatmap, pruneOldSnapshots as pruneHeatmapSnapshots } from '@/lib/delivery/geo-heatmap';
import { recordUsageAllLocations as recordRestockUsage, checkThresholdsAllLocations as checkRestockThresholds, pruneOldMaterialSnapshots } from '@/lib/delivery/restock-engine';
import { computeRampUpAllLocations, pruneOldProfiles as pruneRampUpProfiles } from '@/lib/delivery/driver-ramp-up';
import { snapshotAllLocations as snapshotPerformanceScores, pruneOldPerformanceScores } from '@/lib/delivery/performance-score';
import { scanNotificationsAllLocations, pruneOldNotifications } from '@/lib/delivery/notification-center';
import { detectSlaBreachesAllLocations, pruneOldSlaBreaches } from '@/lib/delivery/sla-breach-detector';
import { evaluateScoreTriggersAllLocations, pruneOldGrants as pruneScoreGrants } from '@/lib/delivery/driver-score-trigger';
import { rebuildZoneVehicleStatsAllLocations } from '@/lib/delivery/scoring-v2';
import { snapshotAllLocations as snapshotLocationHealthScores, pruneOldHealthScores } from '@/lib/delivery/location-health-score';
import { snapshotPunctualityAllLocations, pruneOldProfiles as prunePunctualityProfiles } from '@/lib/delivery/punctuality-coach';
import { checkAllLocations as checkItemDemandAllLocations, pruneOldAlerts as pruneItemDemandAlerts } from '@/lib/delivery/item-demand-prediction';
import { pruneSurveysAllLocations } from '@/lib/delivery/tour-terminal-survey';
import { snapshotAllLocations as snapshotBatchHealth, pruneBatchHealthSnapshots } from '@/lib/delivery/smart-batch-monitor';
import { predictAllLocations as predictDriverReturns, pruneOldPredictions as pruneReturnPredictions } from '@/lib/delivery/driver-return-prediction';
import { buildSuggestionsAllLocations as buildAssignmentSuggestions, expireOldSuggestions, autoDispatchAllLocations } from '@/lib/delivery/assignment-optimizer';
import { runRescueAllLocations, pruneOldRescueEvents } from '@/lib/delivery/order-rescue';
import { runBalancerAllLocations, pruneZoneCapacitySnapshots } from '@/lib/delivery/zone-capacity-balancer';
import { saveDriverLiveScoreSnapshotsAllLocations, pruneDriverLiveScoreSnapshots } from '@/lib/delivery/driver-performance-realtime';
import { snapshotRevenueVelocityAllLocations, pruneRevenueVelocitySnapshots } from '@/lib/delivery/revenue-velocity';
import { snapshotDriverShiftGoalsAllLocations, pruneDriverShiftGoalSnapshots } from '@/lib/delivery/driver-shift-goals';
import { predictAllLocations as predictOrderDelays, settleAllLocations as settleDelayOutcomes, pruneOldDelayPredictions } from '@/lib/delivery/order-delay-prediction';
import { alertCriticalAllLocations, pruneOldDelayAlerts } from '@/lib/delivery/delay-alert-push';
import { snapshotAllLocations as snapshotDeliveryAnalytics, pruneOldSnapshots as pruneDeliveryAnalytics } from '@/lib/delivery/delivery-analytics';
import { autoExpireAllLocations as autoExpireShiftSwaps } from '@/lib/delivery/shift-swap';
import { computeWeeklyRankingAllLocations, pruneOldRankings as pruneDriverRankings } from '@/lib/delivery/driver-ranking';
import { snapshotAllLocations as snapshotZoneRevenue, generateRecommendationsAllLocations as generateZoneRevenueRecs, pruneZoneRevenueSnapshots } from '@/lib/delivery/zone-revenue-optimizer';
import { scanAllLocations as scanGeofences, pruneGeofenceScanLogs } from '@/lib/delivery/driver-geofence';

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
    // Stündlicher Tick (jede volle Stunde)
    const isHourlyTick = nowMin < 2;

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
    // CO₂-Fußabdruck-Snapshot: täglich 05:15 UTC (nach Address-Scan, vor Sentiment)
    const isCarbonSnapshotTick = nowHour === 5 && nowMin >= 14 && nowMin < 18;
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
    // Quality-Score-Snapshot: täglich 02:45 UTC (nach Report + ETA-Kalibrierung)
    const isQualityScoreTick = nowHour === 2 && nowMin >= 44 && nowMin < 48;
    // Benchmark-Snapshot: täglich 03:00 UTC (nach Quality Score)
    const isBenchmarkTick = nowHour === 3 && nowMin >= 0 && nowMin < 4;
    // Incentive-Approve: täglich 04:00 UTC; Incentive-Evaluate: jeden Tick (Echtzeit)
    const isIncentiveApproveTick = nowHour === 4 && nowMin >= 0 && nowMin < 4;
    // Driver-Retention-Score: täglich 03:15 UTC (nach Digest, frische Daten)
    const isRetentionScoreTick = nowHour === 3 && nowMin >= 14 && nowMin < 18;
    // Schicht-Performance-Prognose: täglich 03:30 UTC (nach Retention)
    const isShiftPredictionTick = nowHour === 3 && nowMin >= 30 && nowMin < 34;
    // Fahrer-Zufriedenheits-Score: täglich 03:45 UTC (nach Shift-Prognose)
    const isSatisfactionScoreTick = nowHour === 3 && nowMin >= 45 && nowMin < 49;
    // Fahrer-Wellbeing-Index: täglich 04:00 UTC (nach Satisfaction, nutzt alle Vordaten)
    const isWellbeingTick = nowHour === 4 && nowMin < 4;
    // Kunden-Kohortenanalyse: täglich 04:15 UTC (nach Wellbeing, leseintensiv)
    const isCohortTick = nowHour === 4 && nowMin >= 15 && nowMin < 19;
    // Capacity Forecast: täglich 04:30 UTC (nach Kohortenanalyse, nutzt Vortagesdaten)
    const isCapacityForecastTick = nowHour === 4 && nowMin >= 30 && nowMin < 34;
    // Driver Route Learning: täglich 03:45 UTC (nach Retention-Score, leseintensiv)
    const isRouteLearnTick = nowHour === 3 && nowMin >= 44 && nowMin < 48;
    // Promise Settlement: jede Stunde zur vollen Stunde (Minute 0-3)
    const isPromiseSettleTick = nowMin >= 0 && nowMin < 4;
    // Phase 232: Driver Performance Prediction — täglich 04:00 UTC (nach Wellbeing, alle Daten verfügbar)
    const isPerfPredictionTick = nowHour === 4 && nowMin >= 0 && nowMin < 4;
    // Phase 232: Performance Prediction Settle — täglich 02:30 UTC (nach Tagesabschluss)
    const isPerfPredSettleTick = nowHour === 2 && nowMin >= 28 && nowMin < 32;
    // Phase 234: Shift Handover — täglich 06:00, 14:00, 22:00 UTC (8h-Schicht-Rhythmus)
    const isHandoverTick = (nowHour === 6 || nowHour === 14 || nowHour === 22) && nowMin < 2;
    // Phase 235: Driver Feedback Aggregation — täglich 04:30 UTC
    const isFeedbackAggregateTick = nowHour === 4 && nowMin >= 28 && nowMin < 32;
    // Phase 242: Order Lifecycle Snap — täglich 02:15 UTC (nach Report-Cache)
    const isLifecycleSnapTick = nowHour === 2 && nowMin >= 14 && nowMin < 18;
    // Phase 248: Restock Usage Recording — täglich 01:15 UTC (Verbrauch des Vortags erfassen)
    const isRestockUsageTick = nowHour === 1 && nowMin >= 14 && nowMin < 18;
    // Phase 248: Restock Threshold Check — täglich 01:30 UTC (nach Usage Recording)
    const isRestockCheckTick = nowHour === 1 && nowMin >= 28 && nowMin < 32;
    // Phase 250: Driver Ramp-Up Intelligence — täglich 02:45 UTC (nach Performance-Snapshots)
    const isRampUpTick = nowHour === 2 && nowMin >= 44 && nowMin < 48;
    // Phase 250: Delivery Performance Score — täglich 03:05 UTC (nach Benchmark, frische Profitabilitätsdaten)
    const isPerfScoreTick = nowHour === 3 && nowMin >= 5 && nowMin < 9;
    // Phase 258: Score-Bonus-Trigger — täglich 03:10 UTC (5 Min nach Driver Score Compute)
    const isScoreTriggerTick = nowHour === 3 && nowMin >= 10 && nowMin < 14;
    // Phase 263: Zone×Fahrzeug-Statistik für ML-Scoring V2 — täglich 04:35 UTC (nach Upsell-Rebuild)
    const isZoneVehicleStatsTick = nowHour === 4 && nowMin >= 34 && nowMin < 38;
    // Phase 264: Location-Gesundheits-Score — täglich 03:15 UTC (nach Performance Score bei 03:05)
    const isLocationHealthTick = nowHour === 3 && nowMin >= 15 && nowMin < 19;
    // Phase 268: Fahrer-Pünktlichkeits-Coach — täglich 04:50 UTC (nach allen Driver-Analyse-Ticks)
    const isPunctualityCoachTick = nowHour === 4 && nowMin >= 50 && nowMin < 54;
    // Phase 270: Item Demand Prediction — täglich 05:00 UTC
    const isItemDemandTick = nowHour === 5 && nowMin >= 0 && nowMin < 4;
    // Phase 272: Tour-Terminal-Survey Prune — täglich 05:05 UTC (nach Item-Demand)
    const isSurveyPruneTick = nowHour === 5 && nowMin >= 5 && nowMin < 9;
    // Phase 273: Batch-Monitor Prune — täglich 05:10 UTC
    const isBatchMonitorPruneTick = nowHour === 5 && nowMin >= 10 && nowMin < 14;
    // Phase 274: Return-Prediction Prune — täglich 05:15 UTC
    const isReturnPredictionPruneTick = nowHour === 5 && nowMin >= 15 && nowMin < 19;
    // Phase 312: Revenue Velocity Snapshot — alle 10 Min (gleicher Takt wie Rating-Tick)
    const isRevenueVelocityTick = isRatingTick;
    // Phase 314: Fahrer-Schichtziel-Snapshot — stündlich (volle Stunde)
    const isDriverShiftGoalTick = isHourlyTick;
    // Phase 314: Fahrer-Schichtziel-Prune — täglich 05:30 UTC
    const isDriverShiftGoalPruneTick = nowHour === 5 && nowMin >= 28 && nowMin < 32;
    // Phase 316: Order Delay Prediction — jeden Tick; settle täglich 03:00 UTC; prune täglich 05:35 UTC
    const isDelayPredictionSettleTick = nowHour === 3 && nowMin >= 0 && nowMin < 4;
    const isDelayPredictionPruneTick  = nowHour === 5 && nowMin >= 34 && nowMin < 38;
    // Phase 318: Delay Alert Push — jeden Tick (proaktiver Kunden-Push bei critical risk); prune täglich 05:40 UTC
    const isDelayAlertPruneTick = nowHour === 5 && nowMin >= 39 && nowMin < 43;
    // Phase 320: Delivery Analytics Snapshot — täglich 02:05 UTC (nach Report-Cache); prune täglich 05:45 UTC
    const isDeliveryAnalyticsTick = nowHour === 2 && nowMin >= 5 && nowMin < 9;
    const isDeliveryAnalyticsPruneTick = nowHour === 5 && nowMin >= 44 && nowMin < 48;

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

    // Phase 212: CO₂-Fußabdruck-Snapshot — täglich 05:15 UTC
    const carbonSnapshotResult = isCarbonSnapshotTick
      ? await snapshotCarbonAllLocations().catch(() => null)
      : null;
    // Prune CO₂-Snapshots älter als 90 Tage — täglich 02:00 UTC
    const co2SnapshotsPruned = isReportTick
      ? await pruneCo2Snapshots(90).catch(() => 0)
      : 0;

    // Phase 214: Quality Score Snapshot — täglich 02:45 UTC
    const qualityScoreResult = isQualityScoreTick
      ? await snapshotQualityScores().catch(() => ({ locations: 0, snapshots: 0, errors: 1 }))
      : null;
    const qualityScoresPruned = isReportTick
      ? await pruneQualityScores(90).catch(() => 0)
      : 0;

    // Phase 215: Benchmark Snapshot — täglich 03:00 UTC (nach Quality Score)
    const benchmarkResult = isBenchmarkTick
      ? await snapshotBenchmarks().catch(() => ({ locations: 0, snapshots: 0, errors: 1 }))
      : null;
    const benchmarksPruned = isReportTick
      ? await pruneOldBenchmarks(90).catch(() => 0)
      : 0;

    // Phase 221: Incentive Evaluation — jeden Tick (Echtzeit, letzte 5 Min)
    const incentiveEvalResult = await evaluateIncentivesAllLocations()
      .catch(() => ({ locations: 0, evaluated: 0, earned: 0, errors: 1 }));
    // Approve pending incentives — täglich 04:00 UTC
    const incentiveApproved = isIncentiveApproveTick
      ? await approveIncentivesAllLocations().catch(() => 0)
      : 0;
    // Prune old incentive events — täglich 02:00 UTC
    const incentiveEventsPruned = isReportTick
      ? await pruneOldIncentiveEvents(90).catch(() => 0)
      : 0;

    // Phase 223: Driver Retention Score — täglich 03:15 UTC
    const retentionResult = isRetentionScoreTick
      ? await snapshotDriverRetention().catch(() => ({ locations: 0, scored: 0, errors: 1 }))
      : null;
    // Retention Scores bereinigen (>90 Tage) — täglich 02:00 UTC
    const retentionScoresPruned = isReportTick
      ? await pruneOldRetentionScores(90).catch(() => 0)
      : 0;

    // Phase 224: Schicht-Performance-Prognose — täglich 03:30 UTC
    const shiftPredictionResult = isShiftPredictionTick
      ? await snapshotShiftPredictions().catch(() => ({ locations: 0, slotsUpserted: 0, errors: 1 }))
      : null;
    const shiftPredictionsPruned = isReportTick
      ? await pruneOldPredictions(90).catch(() => 0)
      : 0;

    // Phase 225: Fahrer-Zufriedenheits-Score — täglich 03:45 UTC
    const satisfactionResult = isSatisfactionScoreTick
      ? await snapshotDriverSatisfaction().catch(() => ({ locations: 0, scored: 0, errors: 1 }))
      : null;
    const satisfactionScoresPruned = isReportTick
      ? await pruneSatisfactionScores(90).catch(() => 0)
      : 0;

    // Phase 226: Fahrer-Wellbeing-Index — täglich 04:00 UTC
    const wellbeingResult = isWellbeingTick
      ? await snapshotDriverWellbeing().catch(() => ({ locations: 0, scored: 0, errors: 1 }))
      : null;
    const wellbeingSnapshotsPruned = isReportTick
      ? await pruneWellbeingSnapshots(90).catch(() => 0)
      : 0;

    // Phase 227: Kunden-Kohortenanalyse — täglich 04:15 UTC
    const cohortResult = isCohortTick
      ? await buildCustomerCohorts().catch(() => ({ locations: 0, cohortsBuilt: 0, snapshotsUpserted: 0, errors: 1 }))
      : null;
    const cohortSnapshotsPruned = isReportTick
      ? await pruneCohortSnapshots(730).catch(() => 0)
      : 0;

    // Phase 228: Smart Capacity Forecast — täglich 04:30 UTC
    const capacityForecastResult = isCapacityForecastTick
      ? await buildCapacityForecast().catch(() => ({ locations: 0, daysForecasted: 0, upserted: 0, errors: 1 }))
      : null;
    const capacityForecastsPruned = isReportTick
      ? await pruneCapacityForecasts(30).catch(() => 0)
      : 0;

    // Phase 229: Delivery Promise Settlement — jede Stunde (Minute 0-3)
    const promiseSettleResult = isPromiseSettleTick
      ? await settleDeliveryPromises().catch(() => ({ locations: 0, settled: 0, errors: 1 }))
      : null;
    const promisesPruned = isReportTick
      ? await pruneOldPromises(90).catch(() => ({ pruned: 0 }))
      : null;

    // Phase 231: Driver Route Learning — täglich 03:45 UTC
    const routeLearnResult = isRouteLearnTick
      ? await buildDriverRouteProfiles().catch(() => ({ locations: 0, profilesUpserted: 0, errors: 1 }))
      : null;
    const routeObsPruned = isReportTick
      ? await pruneRouteObservations(120).catch(() => ({ pruned: 0 }))
      : null;

    // Phase 232: Driver Performance Prediction — täglich 04:00 UTC
    const perfPredResult = isPerfPredictionTick
      ? await buildPredictionsAllLocations().catch(() => ({ locations: 0, totalPredicted: 0, totalErrors: 1 }))
      : null;
    const perfPredSettled = isPerfPredSettleTick
      ? await settlePerformancePredictions().catch(() => ({ locations: 0, settled: 0, errors: 0 }))
      : null;
    const perfPredPruned = isReportTick
      ? await prunePerformancePredictions(90).catch(() => ({ pruned: 0 }))
      : null;

    // Phase 234: Shift Handover — 3× täglich (06:00, 14:00, 22:00 UTC)
    const handoverResult = isHandoverTick
      ? await generateHandoverAllLocations(8).catch(() => ({ locations: 0, reports: 0, errors: 1 }))
      : null;
    const handoverPruned = isReportTick
      ? await pruneOldHandoverReports(90).catch(() => ({ pruned: 0 }))
      : null;

    // Phase 235: Driver Feedback Aggregation — täglich 04:30 UTC
    const feedbackAggResult = isFeedbackAggregateTick
      ? await aggregateFeedbackAllLocations().catch(() => ({ locations: 0, errors: 1 }))
      : null;
    const feedbackPruned = isReportTick
      ? await pruneOldFeedback(90).catch(() => ({ pruned: 0 }))
      : null;

    // Phase 237: Zone Rebalancing — Snapshot alle 10 Min, Vorschläge alle 10 Min, Prune täglich 02:05 UTC
    const zoneSnapResult = await snapshotZoneCapacityAllLocations().catch(() => ({ locations: 0, snapshots: 0, errors: 1 }));
    const zoneRebalResult = await rebalanceAllLocations().catch(() => ({ locations: 0, suggested: 0, errors: 1 }));
    const zoneSnapshotsPruned = isReportTick
      ? await pruneZoneSnapshots(30).catch(() => ({ pruned: 0 }))
      : null;

    // Phase 242: Order Lifecycle Funnel Snap — täglich 02:15 UTC
    const lifecycleSnapResult = isLifecycleSnapTick
      ? await snapOrderLifecycle().catch(() => ({ locations: 0, snapped: 0 }))
      : null;
    const lifecycleSnapshotsPruned = isReportTick
      ? await pruneOldLifecycleSnapshots(60).catch(() => 0)
      : 0;

    // Phase 244: Geo-Heatmap Pro — alle 30 Min (isDemandTick), Prune täglich 02:00 UTC
    const heatmapSnapResult = isDemandTick
      ? await snapshotGeoHeatmap().catch(() => ({ locations: 0, snapped: 0, cells: 0, errors: 1 }))
      : null;
    const heatmapSnapshotsPruned = isReportTick
      ? await pruneHeatmapSnapshots(60).catch(() => 0)
      : 0;

    // Phase 248: Restock-Engine — Verbrauch täglich 01:15 UTC, Threshold-Check 01:30 UTC
    const restockUsageResult = isRestockUsageTick
      ? await recordRestockUsage().catch(() => ({ locations: 0, snapshots: 0, errors: 1 }))
      : null;
    const restockCheckResult = isRestockCheckTick
      ? await checkRestockThresholds().catch(() => ({ locations: 0, alerts_created: 0, alerts_resolved: 0, errors: 1 }))
      : null;
    const materialSnapshotsPruned = isReportTick
      ? await pruneOldMaterialSnapshots(90).catch(() => ({ pruned: 0 }))
      : null;

    // Phase 250: Driver Ramp-Up Intelligence — täglich 02:45 UTC
    const rampUpResult = isRampUpTick
      ? await computeRampUpAllLocations().catch(() => ({ total: 0, computed: 0, graduated: 0, errors: 1 }))
      : null;
    const rampUpPruned = isReportTick
      ? await pruneRampUpProfiles(90).catch(() => ({ pruned: 0 }))
      : null;

    // Phase 250: Delivery Performance Score — täglich 03:05 UTC
    const perfScoreResult = isPerfScoreTick
      ? await snapshotPerformanceScores().catch(() => ({ locations: 0, snapshots: 0, errors: 1 }))
      : null;
    const perfScoresPruned = isReportTick
      ? await pruneOldPerformanceScores(90).catch(() => ({ pruned: 0 }))
      : null;

    // Phase 254: Notification Center — jeden Tick scannen
    const notifScanResult = await scanNotificationsAllLocations().catch(
      () => ({ locations: 0, totalCreated: 0, totalSkipped: 0, errors: 1 }),
    );
    const notifPruned = isReportTick
      ? await pruneOldNotifications(30).catch(() => ({ pruned: 0 }))
      : null;

    // Phase 256: SLA Breach Detector — jeden Tick (ETA+10min Überschreitung → Eskalation)
    const slaBreachResult = await detectSlaBreachesAllLocations().catch(
      () => ({ locations: 0, totalDetected: 0, totalResolved: 0, errors: 1 }),
    );
    const slaBreachesPruned = isReportTick
      ? await pruneOldSlaBreaches(30).catch(() => ({ pruned: 0 }))
      : null;

    // Phase 258: Score-Bonus-Trigger — täglich 03:10 UTC (nach Driver Score Compute)
    const scoreTriggerResult = isScoreTriggerTick
      ? await evaluateScoreTriggersAllLocations().catch(() => ({ locations: 0, grantsCreated: 0, errors: 1 }))
      : null;
    const scoreGrantsPruned = isReportTick
      ? await pruneScoreGrants(90).catch(() => ({ deleted: 0 }))
      : null;

    // Phase 263: Zone×Fahrzeug-Statistik für ML-Scoring V2 — täglich 04:35 UTC
    const zoneVehicleStatsResult = isZoneVehicleStatsTick
      ? await rebuildZoneVehicleStatsAllLocations().catch(() => ({ locations: 0, totalRows: 0 }))
      : null;

    // Phase 264: Location-Gesundheits-Score — täglich 03:15 UTC
    const locationHealthResult = isLocationHealthTick
      ? await snapshotLocationHealthScores().catch(() => ({ locations: 0, snapshots: 0, errors: 1 }))
      : null;
    const healthScoresPruned = isReportTick
      ? await pruneOldHealthScores(90).catch(() => ({ pruned: 0 }))
      : null;

    // Phase 268: Fahrer-Pünktlichkeits-Coach — täglich 04:50 UTC
    const punctualityCoachResult = isPunctualityCoachTick
      ? await snapshotPunctualityAllLocations().catch(() => ({ locations: 0, processed: 0, saved: 0, errors: 1 }))
      : null;
    const punctualityProfilesPruned = isReportTick
      ? await prunePunctualityProfiles(90).catch(() => ({ pruned: 0 }))
      : null;

    // Phase 270: Item Demand Prediction — täglich 05:00 UTC
    const itemDemandResult = isItemDemandTick
      ? await checkItemDemandAllLocations().catch(() => ({ locations: 0, itemsChecked: 0, alertsCreated: 0, alertsResolved: 0, errors: 1 }))
      : null;
    const itemDemandAlertsPruned = isReportTick
      ? await pruneItemDemandAlerts(90).catch(() => ({ pruned: 0 }))
      : null;

    // Phase 272: Tour-Terminal-Survey Prune — täglich 05:05 UTC
    const surveyPruneResult = isSurveyPruneTick
      ? await pruneSurveysAllLocations(90).catch(() => ({ pruned: 0 }))
      : null;

    // Phase 273: Batch-Monitor Snapshot — jeden Tick (Live-Monitoring), Prune täglich 05:10 UTC
    const batchMonitorResult = await snapshotBatchHealth().catch(() => ({ locations: 0, saved: 0, errors: 0 }));
    const batchHealthPruned = isBatchMonitorPruneTick
      ? await pruneBatchHealthSnapshots(14).catch(() => 0)
      : null;

    // Phase 274: Fahrer-Rückkehr-Vorhersage — jeden Tick (Live-Predictions), Prune täglich 05:15 UTC
    const returnPredictionResult = await predictDriverReturns().catch(() => ({ locations: 0, predicted: 0, errors: 0 }));
    const returnPredictionsPruned = isReturnPredictionPruneTick
      ? await pruneReturnPredictions(3).catch(() => ({ pruned: 0 }))
      : null;

    // Phase 276: Zuweisung-Optimizer — jeden Tick neu generieren (nutzt Return-Predictions), Expire stündlich
    const assignmentResult = await buildAssignmentSuggestions().catch(() => []);
    const assignmentExpired = isHourlyTick
      ? await expireOldSuggestions(1).catch(() => 0)
      : null;

    // Phase 277: Auto-Dispatch — nach Suggestion-Build prüfen ob Score ≥ 85 + idle Fahrer
    const autoDispatchResult = await autoDispatchAllLocations().catch(() => []);

    // Phase 306: Order Rescue Engine — proaktive Stornierungsprävention (jeden Tick)
    // runRescueAllLocations() ruft intern trackOutcomes() je Location auf
    const rescueResult = await runRescueAllLocations().catch(() => ({ locations: 0, rescued: 0 }));
    // Prune alter Rescue-Events täglich 05:20 UTC
    const isRescuePruneTick = nowHour === 5 && nowMin >= 20 && nowMin < 24;
    const rescueEventsPruned = isRescuePruneTick
      ? await pruneOldRescueEvents(30).catch(() => 0)
      : null;

    // Phase 307: Zone Capacity Balancer — Zonen-Kapazitäts-Snapshot + Rebalancing-Empfehlungen
    const balancerResult = await runBalancerAllLocations().catch(() => ({ locations: 0, snapshots: 0, suggestions: 0, errors: 0 }));
    // Prune alte Zonen-Snapshots täglich 05:30 UTC
    const isBalancerPruneTick = nowHour === 5 && nowMin >= 30 && nowMin < 34;
    const balancerSnapshotsPruned = isBalancerPruneTick
      ? await pruneZoneCapacitySnapshots(7).catch(() => ({ pruned: 0 }))
      : null;

    // Phase 310: Fahrer-Performance-Echtzeit-Snapshots — alle 10 Min (isRatingTick)
    const liveScoreSnapshotResult = isRatingTick
      ? await saveDriverLiveScoreSnapshotsAllLocations().catch(() => ({ locations: 0, snapshots: 0 }))
      : null;
    if (isReportTick) {
      pruneDriverLiveScoreSnapshots().catch(() => {});
    }

    // Phase 312: Revenue Velocity Snapshots — alle 10 Min
    const revenueVelocityResult = isRevenueVelocityTick
      ? await snapshotRevenueVelocityAllLocations().catch(() => ({ locations: 0, snapshots: 0, errors: 0 }))
      : null;
    if (isReportTick) {
      pruneRevenueVelocitySnapshots(30).catch(() => {});
    }

    // Phase 314: Fahrer-Schichtziel-Snapshots — stündlich
    const driverShiftGoalResult = isDriverShiftGoalTick
      ? await snapshotDriverShiftGoalsAllLocations().catch(() => ({ locations: 0, saved: 0, errors: 0 }))
      : null;
    if (isDriverShiftGoalPruneTick) {
      pruneDriverShiftGoalSnapshots(7).catch(() => {});
    }

    // Phase 316: Order Delay Prediction — jeden Tick (pending orders)
    const delayPredictionResult = await predictOrderDelays().catch(() => ({ locations: 0, predicted: 0, errors: 0 }));
    if (isDelayPredictionSettleTick) {
      settleDelayOutcomes().catch(() => {});
    }
    if (isDelayPredictionPruneTick) {
      pruneOldDelayPredictions(30).catch(() => {});
    }

    // Phase 318: Delay Alert Push — jeden Tick (critical risk → Kunden-Push)
    const delayAlertResult = await alertCriticalAllLocations().catch(() => ({ locations: 0, alerted: 0, errors: 0 }));
    if (isDelayAlertPruneTick) {
      pruneOldDelayAlerts(30).catch(() => {});
    }

    // Phase 320: Delivery Analytics Snapshot — täglich 02:05 UTC
    const deliveryAnalyticsResult = isDeliveryAnalyticsTick
      ? await snapshotDeliveryAnalytics().catch(() => ({ locations: 0, snapshots: 0, errors: 1 }))
      : null;
    if (isDeliveryAnalyticsPruneTick) {
      pruneDeliveryAnalytics(90).catch(() => {});
    }

    // Phase 324: Shift-Swap — abgelaufene Anfragen schließen (stündlich)
    const shiftSwapExpireResult = isHourlyTick
      ? await autoExpireShiftSwaps().catch(() => ({ locations: 0, expired: 0 }))
      : null;

    // Phase 329: Wöchentliches Fahrer-Ranking (täglich 03:00 UTC)
    const isRankingTick = nowHour === 3 && nowMin < 2;
    const driverRankingResult = isRankingTick
      ? await computeWeeklyRankingAllLocations().catch(() => ({ locations: 0, computed: 0, rewardTriggered: 0, errors: 0 }))
      : null;
    const rankingsPruned = isRankingTick
      ? await pruneDriverRankings(90).catch(() => ({ pruned: 0 }))
      : null;

    // Phase 331: Zonen-Umsatz-Snapshot (täglich 02:45 UTC) + Empfehlungen (03:10 UTC)
    const isZoneRevSnapTick = nowHour === 2 && nowMin >= 45 && nowMin < 47;
    const isZoneRevRecsTick = nowHour === 3 && nowMin >= 10 && nowMin < 12;
    const zoneRevenueSnapResult = isZoneRevSnapTick
      ? await snapshotZoneRevenue().catch(() => ({ locations: 0, snapshots: 0, errors: 1 }))
      : null;
    const zoneRevenueRecsResult = isZoneRevRecsTick
      ? await generateZoneRevenueRecs().catch(() => ({ locations: 0, recs: 0, errors: 1 }))
      : null;
    const zoneRevenuePruned = isZoneRevSnapTick
      ? await pruneZoneRevenueSnapshots(90).catch(() => ({ pruned: 0 }))
      : null;

    // Phase 333: Driver Geofence Engine — jeden Tick (Position → Push bei Annäherung)
    const geofenceScanResult = await scanGeofences().catch(() => ({ locations: 0, driversScanned: 0, ring1Fired: 0, ring2Fired: 0, errors: 0 }));
    // Geofence-Log Prune: täglich 05:50 UTC
    const isGeofencePruneTick = nowHour === 5 && nowMin >= 50 && nowMin < 54;
    const geofenceLogsPruned = isGeofencePruneTick
      ? await pruneGeofenceScanLogs(7).catch(() => ({ pruned: 0 }))
      : null;

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
      ...(carbonSnapshotResult ? { carbon_footprint: { locations: carbonSnapshotResult.locations, snapshots: carbonSnapshotResult.snapshots, errors: carbonSnapshotResult.errors } } : {}),
      ...(co2SnapshotsPruned ? { co2_snapshots_pruned: co2SnapshotsPruned } : {}),
      ...(qualityScoreResult ? { quality_scores: { locations: qualityScoreResult.locations, snapshots: qualityScoreResult.snapshots, errors: qualityScoreResult.errors } } : {}),
      ...(qualityScoresPruned ? { quality_scores_pruned: qualityScoresPruned } : {}),
      ...(benchmarkResult ? { benchmarks: { locations: benchmarkResult.locations, snapshots: benchmarkResult.snapshots, errors: benchmarkResult.errors } } : {}),
      ...(benchmarksPruned ? { benchmarks_pruned: benchmarksPruned } : {}),
      ...(incentiveEvalResult.earned > 0 ? { incentives: { evaluated: incentiveEvalResult.evaluated, earned: incentiveEvalResult.earned, errors: incentiveEvalResult.errors } } : {}),
      ...(incentiveApproved ? { incentives_approved: incentiveApproved } : {}),
      ...(incentiveEventsPruned ? { incentive_events_pruned: incentiveEventsPruned } : {}),
      ...(retentionResult ? { driver_retention: { locations: retentionResult.locations, scored: retentionResult.scored, errors: retentionResult.errors } } : {}),
      ...(retentionScoresPruned ? { retention_scores_pruned: retentionScoresPruned } : {}),
      ...(shiftPredictionResult ? { shift_predictions: { locations: shiftPredictionResult.locations, slots: shiftPredictionResult.slotsUpserted, errors: shiftPredictionResult.errors } } : {}),
      ...(shiftPredictionsPruned ? { shift_predictions_pruned: shiftPredictionsPruned } : {}),
      ...(satisfactionResult ? { driver_satisfaction: { locations: satisfactionResult.locations, scored: satisfactionResult.scored, errors: satisfactionResult.errors } } : {}),
      ...(satisfactionScoresPruned ? { satisfaction_scores_pruned: satisfactionScoresPruned } : {}),
      ...(wellbeingResult ? { driver_wellbeing: { locations: wellbeingResult.locations, scored: wellbeingResult.scored, errors: wellbeingResult.errors } } : {}),
      ...(wellbeingSnapshotsPruned ? { wellbeing_snapshots_pruned: wellbeingSnapshotsPruned } : {}),
      ...(cohortResult ? { customer_cohorts: { locations: cohortResult.locations, cohorts_built: cohortResult.cohortsBuilt, snapshots_upserted: cohortResult.snapshotsUpserted, errors: cohortResult.errors } } : {}),
      ...(cohortSnapshotsPruned ? { cohort_snapshots_pruned: cohortSnapshotsPruned } : {}),
      ...(promiseSettleResult ? { delivery_promise_settle: { locations: promiseSettleResult.locations, settled: promiseSettleResult.settled, errors: promiseSettleResult.errors } } : {}),
      ...(promisesPruned ? { delivery_promises_pruned: promisesPruned.pruned } : {}),
      ...(routeLearnResult ? { driver_route_learning: { locations: routeLearnResult.locations, profiles_upserted: routeLearnResult.profilesUpserted, errors: routeLearnResult.errors } } : {}),
      ...(routeObsPruned ? { route_observations_pruned: routeObsPruned.pruned } : {}),
      ...(perfPredResult ? { driver_perf_prediction: { locations: perfPredResult.locations, predicted: perfPredResult.totalPredicted, errors: perfPredResult.totalErrors } } : {}),
      ...(perfPredSettled ? { driver_perf_settled: { locations: perfPredSettled.locations, settled: perfPredSettled.settled, errors: perfPredSettled.errors } } : {}),
      ...(perfPredPruned ? { driver_perf_pred_pruned: perfPredPruned.pruned } : {}),
      ...(handoverResult ? { shift_handover: { locations: handoverResult.locations, reports: handoverResult.reports, errors: handoverResult.errors } } : {}),
      ...(handoverPruned ? { handover_reports_pruned: handoverPruned.pruned } : {}),
      ...(feedbackAggResult ? { driver_feedback_aggregate: { locations: feedbackAggResult.locations, errors: feedbackAggResult.errors } } : {}),
      ...(feedbackPruned ? { driver_feedback_pruned: feedbackPruned.pruned } : {}),
      ...(zoneSnapResult.snapshots > 0 ? { zone_capacity_snapshots: { locations: zoneSnapResult.locations, snapshots: zoneSnapResult.snapshots, errors: zoneSnapResult.errors } } : {}),
      ...(zoneRebalResult.suggested > 0 ? { zone_rebalancing: { locations: zoneRebalResult.locations, suggested: zoneRebalResult.suggested, errors: zoneRebalResult.errors } } : {}),
      ...(zoneSnapshotsPruned ? { zone_snapshots_pruned: zoneSnapshotsPruned.pruned } : {}),
      ...(lifecycleSnapResult ? { order_lifecycle: { locations: lifecycleSnapResult.locations, snapped: lifecycleSnapResult.snapped } } : {}),
      ...(lifecycleSnapshotsPruned ? { lifecycle_snapshots_pruned: lifecycleSnapshotsPruned } : {}),
      ...(heatmapSnapResult ? { geo_heatmap: { locations: heatmapSnapResult.locations, snapped: heatmapSnapResult.snapped, cells: heatmapSnapResult.cells } } : {}),
      ...(heatmapSnapshotsPruned ? { heatmap_snapshots_pruned: heatmapSnapshotsPruned } : {}),
      ...(restockUsageResult ? { restock_usage: { locations: restockUsageResult.locations, snapshots: restockUsageResult.snapshots, errors: restockUsageResult.errors } } : {}),
      ...(restockCheckResult ? { restock_alerts: { locations: restockCheckResult.locations, created: restockCheckResult.alerts_created, resolved: restockCheckResult.alerts_resolved } } : {}),
      ...(materialSnapshotsPruned ? { material_snapshots_pruned: materialSnapshotsPruned.pruned } : {}),
      ...(rampUpResult ? { ramp_up: { locations: rampUpResult.total, computed: rampUpResult.computed, graduated: rampUpResult.graduated, errors: rampUpResult.errors } } : {}),
      ...(rampUpPruned ? { ramp_up_profiles_pruned: rampUpPruned.pruned } : {}),
      ...(perfScoreResult ? { performance_scores: { locations: perfScoreResult.locations, snapshots: perfScoreResult.snapshots, errors: perfScoreResult.errors } } : {}),
      ...(perfScoresPruned ? { performance_scores_pruned: perfScoresPruned.pruned } : {}),
      notification_center: { locations: notifScanResult.locations, created: notifScanResult.totalCreated, errors: notifScanResult.errors },
      ...(notifPruned ? { notifications_pruned: notifPruned.pruned } : {}),
      sla_breach_detector: { locations: slaBreachResult.locations, detected: slaBreachResult.totalDetected, resolved: slaBreachResult.totalResolved, errors: slaBreachResult.errors },
      ...(slaBreachesPruned ? { sla_breaches_pruned: slaBreachesPruned.pruned } : {}),
      ...(scoreTriggerResult ? { score_bonus_triggers: { locations: scoreTriggerResult.locations, grants_created: scoreTriggerResult.grantsCreated, errors: scoreTriggerResult.errors } } : {}),
      ...(scoreGrantsPruned ? { score_grants_pruned: scoreGrantsPruned.deleted } : {}),
      ...(locationHealthResult ? { location_health_scores: { locations: locationHealthResult.locations, snapshots: locationHealthResult.snapshots, errors: locationHealthResult.errors } } : {}),
      ...(healthScoresPruned ? { health_scores_pruned: healthScoresPruned.pruned } : {}),
      ...(punctualityCoachResult ? { punctuality_coach: { locations: punctualityCoachResult.locations, processed: punctualityCoachResult.processed, saved: punctualityCoachResult.saved, errors: punctualityCoachResult.errors } } : {}),
      ...(punctualityProfilesPruned ? { punctuality_profiles_pruned: punctualityProfilesPruned.pruned } : {}),
      ...(itemDemandResult ? { item_demand: { locations: itemDemandResult.locations, items_checked: itemDemandResult.itemsChecked, alerts_created: itemDemandResult.alertsCreated, alerts_resolved: itemDemandResult.alertsResolved, errors: itemDemandResult.errors } } : {}),
      ...(itemDemandAlertsPruned ? { item_demand_alerts_pruned: itemDemandAlertsPruned.pruned } : {}),
      ...(surveyPruneResult ? { tour_survey_pruned: surveyPruneResult.pruned } : {}),
      ...(batchMonitorResult.saved > 0 ? { batch_monitor: { locations: batchMonitorResult.locations, saved: batchMonitorResult.saved, errors: batchMonitorResult.errors } } : {}),
      ...(batchHealthPruned ? { batch_health_pruned: batchHealthPruned } : {}),
      ...(returnPredictionResult.predicted > 0 ? { return_predictions: { locations: returnPredictionResult.locations, predicted: returnPredictionResult.predicted, errors: returnPredictionResult.errors } } : {}),
      ...(returnPredictionsPruned ? { return_predictions_pruned: returnPredictionsPruned.pruned } : {}),
      ...(assignmentResult.length > 0 ? { assignment_optimizer: { locations: assignmentResult.length, suggestions: assignmentResult.reduce((s, r) => s + r.suggestionsCreated, 0) } } : {}),
      ...(assignmentExpired != null ? { assignment_expired: assignmentExpired } : {}),
      ...(autoDispatchResult.some((r) => r.dispatched > 0) ? { auto_dispatch: { locations: autoDispatchResult.length, dispatched: autoDispatchResult.reduce((s, r) => s + r.dispatched, 0), errors: autoDispatchResult.reduce((s, r) => s + r.errors, 0) } } : {}),
      ...(rescueResult.rescued > 0 ? { order_rescue: { locations: rescueResult.locations, rescued: rescueResult.rescued } } : {}),
      ...(rescueEventsPruned ? { rescue_events_pruned: rescueEventsPruned } : {}),
      ...(balancerResult.suggestions > 0 ? { zone_balancer: { locations: balancerResult.locations, snapshots: balancerResult.snapshots, suggestions: balancerResult.suggestions } } : {}),
      ...(balancerSnapshotsPruned ? { zone_snapshots_pruned: balancerSnapshotsPruned.pruned } : {}),
      ...(liveScoreSnapshotResult?.snapshots ? { driver_live_scores: { locations: liveScoreSnapshotResult.locations, snapshots: liveScoreSnapshotResult.snapshots } } : {}),
      ...(revenueVelocityResult?.snapshots ? { revenue_velocity: { locations: revenueVelocityResult.locations, snapshots: revenueVelocityResult.snapshots, errors: revenueVelocityResult.errors } } : {}),
      ...(driverShiftGoalResult?.saved ? { driver_shift_goals: { locations: driverShiftGoalResult.locations, saved: driverShiftGoalResult.saved, errors: driverShiftGoalResult.errors } } : {}),
      ...(delayPredictionResult.predicted > 0 ? { order_delay_predictions: { locations: delayPredictionResult.locations, predicted: delayPredictionResult.predicted, errors: delayPredictionResult.errors } } : {}),
      ...(delayAlertResult.alerted > 0 ? { delay_alert_push: { locations: delayAlertResult.locations, alerted: delayAlertResult.alerted, errors: delayAlertResult.errors } } : {}),
      ...(deliveryAnalyticsResult ? { delivery_analytics: { locations: deliveryAnalyticsResult.locations, snapshots: deliveryAnalyticsResult.snapshots, errors: deliveryAnalyticsResult.errors } } : {}),
      ...(shiftSwapExpireResult?.expired ? { shift_swap_expired: shiftSwapExpireResult.expired } : {}),
      ...(driverRankingResult ? { driver_weekly_ranking: { locations: driverRankingResult.locations, computed: driverRankingResult.computed, rewards: driverRankingResult.rewardTriggered } } : {}),
      ...(rankingsPruned ? { rankings_pruned: rankingsPruned.pruned } : {}),
      ...(zoneRevenueSnapResult ? { zone_revenue_snapshots: { locations: zoneRevenueSnapResult.locations, snapshots: zoneRevenueSnapResult.snapshots, errors: zoneRevenueSnapResult.errors } } : {}),
      ...(zoneRevenueRecsResult ? { zone_revenue_recommendations: { locations: zoneRevenueRecsResult.locations, recs: zoneRevenueRecsResult.recs, errors: zoneRevenueRecsResult.errors } } : {}),
      ...(zoneRevenuePruned ? { zone_revenue_pruned: zoneRevenuePruned.pruned } : {}),
      ...(geofenceScanResult.driversScanned > 0 ? { geofence_scan: { locations: geofenceScanResult.locations, drivers: geofenceScanResult.driversScanned, ring1: geofenceScanResult.ring1Fired, ring2: geofenceScanResult.ring2Fired } } : {}),
      ...(geofenceLogsPruned ? { geofence_logs_pruned: geofenceLogsPruned.pruned } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg, duration_ms: Date.now() - start }, { status: 500 });
  }
}
