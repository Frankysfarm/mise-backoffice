import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const source = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('batch completion reconcile', () => {
  it('dispatch tick reconciles in_progress batches whose stops are all done', () => {
    const engine = source('lib/delivery/dispatch-engine.ts');
    expect(engine).toContain('reconcileCompletedBatches');
    const fnBlock = engine.slice(engine.indexOf('async function reconcileCompletedBatches'));
    expect(fnBlock).toContain("eq('state', 'in_progress')");
    expect(fnBlock).toContain("state: 'completed'");
    // Tick muss den Reconcile aufrufen
    const tickBlock = engine.slice(engine.indexOf('export async function smartDispatchTick'));
    expect(tickBlock).toContain('reconcileCompletedBatches(');
  });
});
