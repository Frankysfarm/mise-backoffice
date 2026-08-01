import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const client = readFileSync('app/fahrer/app/client.tsx', 'utf8');
const appStart = client.indexOf('export function FahrerApp(');
const appEnd = client.indexOf('/* ---------- SchichtStats ---------- */');

assert.ok(appStart >= 0 && appEnd > appStart, 'FahrerApp production render boundary exists');
const productionApp = client.slice(appStart, appEnd);

assert.equal(
  (productionApp.match(/<DeliveryView\b/g) ?? []).length,
  1,
  'exactly one canonical delivery lifecycle is mounted',
);
assert.doesNotMatch(productionApp, /\{false\s*&&/, 'dead JSX feature blocks must be physically removed');
assert.doesNotMatch(
  productionApp,
  /<(?:Tour|Fahrer|Smart|Stop|Navi)[A-Za-z0-9]*(?:Nav|Navigator|Navigation|StoppKommando)[A-Za-z0-9]*\b/,
  'no alternate navigation or stop-lifecycle component may be mounted',
);
assert.doesNotMatch(
  productionApp,
  /on(?:MarkDelivered|StopComplete)=/,
  'legacy delivery completion callbacks must not be wired',
);
assert.doesNotMatch(
  productionApp,
  /https?:\/\/(?:www\.)?(?:google\.[^/]+\/maps|maps\.google|waze\.)|maps:\/\//i,
  'FahrerApp must not build navigation links outside DeliveryView',
);
assert.match(
  productionApp,
  /stops=\{\[\.\.\.activeBatch\.stops\]\.sort\(/,
  'canonical DeliveryView receives explicitly ordered stops',
);
assert.doesNotMatch(
  client,
  /^import .* from ['"]\.\/(?:phase\d+|.*(?:nav|navigator|navigation|stopp-kommando))/m,
  'historical navigation modules must not remain in the reachable import graph',
);
assert.doesNotMatch(
  client,
  /^export \{.*\} from ['"]\.\//m,
  'client module must not retain historical re-export edges',
);

console.log('driver UI canonical lifecycle contract tests passed');
