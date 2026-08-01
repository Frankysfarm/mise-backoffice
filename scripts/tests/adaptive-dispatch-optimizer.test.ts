import assert from 'node:assert/strict';
import { optimizeAdaptiveDispatch, type AdaptiveDriver, type AdaptiveOrder } from '../../lib/delivery/adaptive-dispatch-optimizer';
const at='2026-08-01T10:00:00.000Z';
const orders:AdaptiveOrder[]=['a','b','c'].map((id,i)=>({id,pickup:{lat:50,lng:6+i*.001},dropoff:{lat:50.01,lng:6+i*.001},deadlineAt:'2026-08-01T11:00:00.000Z',serviceMinutes:3,routeFeasible:true}));
const base:AdaptiveDriver={id:'d1',online:true,sessionActive:true,gps:{lat:50,lng:6},gpsAgeSeconds:10,gpsAccuracyM:5,capacity:2,load:0,radiusKm:20,routeFeasible:true,batteryPct:80,network:'good',assignmentsLastHour:0};
const drivers=[base,{...base,id:'d2',capacity:1}];
const estimate=(driverId:string,orderIds:string[],etaMinutes:number,detourMinutes=1)=>({driverId,orderIds,etaMinutes,detourMinutes,routeFeasible:true});
const estimates=[estimate('d1',['a'],8),estimate('d1',['b'],8),estimate('d1',['c'],8),estimate('d1',['a','b'],12),estimate('d1',['a','c'],13),estimate('d1',['b','c'],12),estimate('d2',['a'],9),estimate('d2',['b'],9),estimate('d2',['c'],9)];
const plan=optimizeAdaptiveDispatch({orders,drivers,estimates,evaluatedAt:at});
assert.equal(plan.objective.assignedOrders,3);assert.equal(plan.fallback,'GLOBAL_BUNDLES');
assert.deepEqual(plan.assignments.find(x=>x.driverId==='d1')?.orderIds,['a','b']);
assert.deepEqual(plan.assignments.find(x=>x.driverId==='d2')?.orderIds,['c']);

// Greedy d1->a would strand one order; global packing chooses d1 bundle + d2 single.
assert.equal(new Set(plan.assignments.flatMap(x=>x.orderIds)).size,3);
assert.deepEqual(optimizeAdaptiveDispatch({orders,drivers:drivers.slice().reverse(),estimates:estimates.slice().reverse(),evaluatedAt:at}),plan,'input order must not affect replay');

const filtered=optimizeAdaptiveDispatch({orders:[orders[0]],drivers:[{...base,online:false,sessionActive:false,gpsAgeSeconds:999,gpsAccuracyM:999,load:2,network:'offline'}],estimates:[estimate('d1',['a'],5)],evaluatedAt:at});
assert.equal(filtered.fallback,'HOLD');
const reasons=filtered.trace[0].hardReasons;
for(const r of ['OFFLINE','SESSION_INACTIVE','GPS_STALE','GPS_UNTRUSTED','CAPACITY','NETWORK_OFFLINE'] as const) assert.ok(reasons.includes(r));

const deadline=optimizeAdaptiveDispatch({orders:[{...orders[0],deadlineAt:'2026-08-01T10:05:00.000Z'}],drivers:[base],estimates:[estimate('d1',['a'],10)],evaluatedAt:at});
assert.ok(deadline.trace[0].hardReasons.includes('DEADLINE'));
const infeasible=optimizeAdaptiveDispatch({orders:[orders[0]],drivers:[base],estimates:[{...estimate('d1',['a'],5),routeFeasible:false}],evaluatedAt:at});
assert.ok(infeasible.trace[0].hardReasons.includes('ROUTE_INFEASIBLE'));

const tie=optimizeAdaptiveDispatch({orders:[orders[0]],drivers:[{...base,id:'z'},{...base,id:'a'}],estimates:[estimate('z',['a'],5),estimate('a',['a'],5)],evaluatedAt:at});
assert.equal(tie.assignments[0].driverId,'a');
const soft=optimizeAdaptiveDispatch({orders:[orders[0]],drivers:[base,{...base,id:'d2',batteryPct:10,network:'poor'}],estimates:[estimate('d1',['a'],6),estimate('d2',['a'],5)],evaluatedAt:at});
assert.equal(soft.assignments[0].driverId,'d1','battery/network soft penalties participate in score');
assert.ok(soft.trace.every(t=>t.eligible?t.factors!==null:t.score===null));
console.log('adaptive dispatch optimizer tests: PASS');
