import type { RoutePlanDecision } from './route-batching-hold';

export type RouteAppendMode = 'off' | 'shadow' | 'active';

export type RouteAppendCandidate = {
  driverId: string;
  batchId: string;
  expectedDriverVersion: number;
  expectedRouteVersion: number;
  decision: RoutePlanDecision;
  input: Record<string, unknown>;
};

export type RouteAppendAttempt = {
  ok: boolean;
  reason_code?: string;
  batch_id?: string;
  correlation_id?: string;
};

export type RouteAppendDependencies = {
  loadCandidates(): Promise<RouteAppendCandidate[]>;
  append(candidate: RouteAppendCandidate, attempt: number): Promise<RouteAppendAttempt>;
  audit(event: {
    mode: RouteAppendMode;
    winnerDriverId: string | null;
    reasonCode: string;
    candidates: Array<{
      driverId: string;
      batchId: string;
      compatible: boolean;
      reasonCode: string;
      totalMinutes: number | null;
      addedMinutes: number | null;
      matrixFallbackUsed: boolean;
    }>;
  }): Promise<void>;
};

const RETRYABLE = new Set([
  'DRIVER_VERSION_OR_CAPACITY_CONFLICT',
  'BATCH_ROUTE_VERSION_CONFLICT',
  'ORDER_VERSION_OR_STORE_CONFLICT',
]);

function rank(candidates: RouteAppendCandidate[]): RouteAppendCandidate[] {
  return [...candidates].sort((a, b) =>
    Number(!a.decision.compatible) - Number(!b.decision.compatible) ||
    (a.decision.totalMinutes ?? Number.POSITIVE_INFINITY) -
      (b.decision.totalMinutes ?? Number.POSITIVE_INFINITY) ||
    a.driverId.localeCompare(b.driverId) ||
    a.batchId.localeCompare(b.batchId));
}

function evidence(candidates: RouteAppendCandidate[]) {
  return candidates.map((candidate) => ({
    driverId: candidate.driverId,
    batchId: candidate.batchId,
    compatible: candidate.decision.compatible,
    reasonCode: candidate.decision.reasonCode,
    totalMinutes: candidate.decision.totalMinutes,
    addedMinutes: candidate.decision.addedMinutes,
    matrixFallbackUsed: candidate.decision.matrixFallbackUsed,
  }));
}

/**
 * The orchestration boundary is deliberately side-effect explicit. In shadow
 * mode only loadCandidates/evaluate and the separate decision audit are
 * reachable; append is unreachable by construction.
 */
export async function executeRouteAppendDispatch(
  mode: RouteAppendMode,
  dependencies: RouteAppendDependencies,
): Promise<{ outcome: 'not_applicable' | 'shadow' | 'appended' | 'conflict'; result?: RouteAppendAttempt }> {
  if (mode === 'off') return { outcome: 'not_applicable' };
  for (let attempt = 0; attempt < 2; attempt++) {
    const candidates = rank(await dependencies.loadCandidates());
    const winner = candidates.find((candidate) => candidate.decision.compatible) ?? null;
    if (mode === 'shadow') {
      await dependencies.audit({
        mode,
        winnerDriverId: winner?.driverId ?? null,
        reasonCode: winner ? 'T08_SHADOW_INSERTION_FEASIBLE' : 'T08_SHADOW_NO_FEASIBLE_ROUTE',
        candidates: evidence(candidates),
      });
      return { outcome: 'shadow' };
    }
    if (!winner) {
      await dependencies.audit({
        mode,
        winnerDriverId: null,
        reasonCode: 'T08_NO_FEASIBLE_ROUTE',
        candidates: evidence(candidates),
      });
      return { outcome: 'not_applicable' };
    }
    const result = await dependencies.append(winner, attempt);
    await dependencies.audit({
      mode,
      winnerDriverId: winner.driverId,
      reasonCode: result.ok
        ? 'T08_ROUTE_APPEND_COMMITTED'
        : `T08_ROUTE_APPEND_${result.reason_code ?? 'REJECTED'}`,
      candidates: evidence(candidates),
    });
    if (result.ok) return { outcome: 'appended', result };
    if (!RETRYABLE.has(result.reason_code ?? '') || attempt === 1) {
      return { outcome: 'conflict', result };
    }
  }
  return { outcome: 'conflict' };
}
