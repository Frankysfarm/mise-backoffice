import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const source = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('batch completion reconcile', () => {
  it('dispatch tick reconciles stuck batches whose stops are all done', () => {
    const engine = source('lib/delivery/dispatch-engine.ts');
    expect(engine).toContain('reconcileCompletedBatches');
    const fnBlock = engine.slice(engine.indexOf('async function reconcileCompletedBatches'));
    // Alle hängenden Zustände abdecken, nicht nur in_progress
    expect(fnBlock).toContain("['in_progress', 'picked_up', 'at_restaurant', 'assigned']");
    expect(fnBlock).toContain("state: 'completed'");
    // driver_status muss geleert werden (sonst bleibt der Fahrer im busy-Filter)
    expect(fnBlock).toContain('aktueller_batch_id: null');
    // Fahrer wird nur auf idle gesetzt, wenn keine andere aktive Tour existiert
    expect(engine).toContain("neq('id', finishedBatchId)");
    expect(fnBlock).toContain('releaseDriverIfNoOtherBatch(');
    // Stop- und orderlose Crash-Artefakte werden nach Schonfrist storniert,
    // verknüpfte Orders aber nie blind angefasst.
    expect(fnBlock).toContain('ageMs >= 5 * 60_000');
    expect(fnBlock).toContain("eq('mise_batch_id', batch.id)");
    expect(fnBlock).toContain("state: 'cancelled'");
    // Tick muss den Reconcile aufrufen
    const tickBlock = engine.slice(engine.indexOf('export async function smartDispatchTick'));
    expect(tickBlock).toContain('reconcileCompletedBatches(');
  });

  it('does not rank a driver who already carries an in-progress tour as free', () => {
    const engine = source('lib/delivery/dispatch-engine.ts');
    const load = engine.slice(engine.indexOf('async function loadActiveDrivers'));
    expect(load).toContain("['pending_acceptance', 'assigned', 'at_restaurant', 'picked_up', 'in_progress']");
    expect(load).toContain("driver.active_batch_state");
    expect(load).toContain("!['picked_up', 'in_progress'].includes");
    expect(load).not.toContain("['pending_acceptance', 'assigned', 'at_restaurant', 'on_route']");
  });

  it('tries the next ranked driver when the first atomic claim is rejected', () => {
    const engine = source('lib/delivery/dispatch-engine.ts');
    const dispatch = engine.slice(engine.indexOf('export async function dispatchSingleOrder'));
    expect(dispatch).toContain('for (const candidate of ranked)');
    expect(dispatch).toContain('lastClaimError');
    expect(dispatch).toContain('best = candidate');
    expect(dispatch.indexOf('return held(`Atomare Zuweisung fehlgeschlagen:')).toBeGreaterThan(
      dispatch.indexOf('for (const candidate of ranked)'),
    );
  });
});
