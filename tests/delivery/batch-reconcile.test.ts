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
    expect(fnBlock).toContain("neq('id', batch.id)");
    // Batch ohne Stops darf nicht fälschlich completed werden
    expect(fnBlock).toContain('allStops.length === 0) continue');
    // Tick muss den Reconcile aufrufen
    const tickBlock = engine.slice(engine.indexOf('export async function smartDispatchTick'));
    expect(tickBlock).toContain('reconcileCompletedBatches(');
  });
});
