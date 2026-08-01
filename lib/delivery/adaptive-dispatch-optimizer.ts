/** Pure, deterministic planning policy. It has no write, network, or LLM seam. */
export const ADAPTIVE_DISPATCH_VERSION = 'adaptive-set-packing-v1';

export type Point = { lat: number; lng: number };
export type AdaptiveOrder = {
  id: string; pickup: Point; dropoff: Point; deadlineAt: string;
  serviceMinutes: number; routeFeasible: boolean;
};
export type AdaptiveDriver = {
  id: string; online: boolean; sessionActive: boolean; gps: Point | null;
  gpsAgeSeconds: number; gpsAccuracyM: number; capacity: number; load: number;
  radiusKm: number; routeFeasible: boolean; batteryPct: number | null;
  network: 'good' | 'poor' | 'offline'; assignmentsLastHour: number;
};
export type BundleEstimate = {
  driverId: string; orderIds: string[]; etaMinutes: number;
  detourMinutes: number; routeFeasible: boolean;
};
export type AdaptiveConfig = {
  maxGpsAgeSeconds: number; maxGpsAccuracyM: number; deadlineSafetyMinutes: number;
  maxDetourMinutes: number; etaWeight: number; detourWeight: number;
  loadWeight: number; fairnessWeight: number; lowBatteryPenalty: number;
  poorNetworkPenalty: number; maxEnumeratedBundleSize: number;
  maxOptions: number; maxSearchNodes: number;
};
export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveConfig = {
  maxGpsAgeSeconds: 180, maxGpsAccuracyM: 200, deadlineSafetyMinutes: 3,
  maxDetourMinutes: 15, etaWeight: 1, detourWeight: 1.5, loadWeight: 4,
  fairnessWeight: 0.5, lowBatteryPenalty: 8, poorNetworkPenalty: 4,
  maxEnumeratedBundleSize: 6, maxOptions: 500, maxSearchNodes: 100000,
};
export type HardReason = 'OFFLINE'|'SESSION_INACTIVE'|'GPS_MISSING'|'GPS_STALE'|
  'GPS_UNTRUSTED'|'CAPACITY'|'RADIUS'|'DEADLINE'|'ROUTE_INFEASIBLE'|'NETWORK_OFFLINE';
export type CandidateTrace = {
  driverId: string; orderIds: string[]; eligible: boolean; hardReasons: HardReason[];
  score: number | null; factors: Record<string, number> | null;
};
export type AdaptivePlan = {
  algorithmVersion: typeof ADAPTIVE_DISPATCH_VERSION; evaluatedAt: string;
  assignments: { driverId: string; orderIds: string[]; score: number }[];
  unassignedOrderIds: string[]; fallback: 'GLOBAL_BUNDLES'|'GLOBAL_SINGLES'|'HOLD';
  objective: { assignedOrders: number; totalScore: number; signature: string };
  trace: CandidateTrace[];
};

const rad = (n: number) => n * Math.PI / 180;
function km(a: Point, b: Point) {
  const dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng);
  const x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
function combinations<T>(xs: readonly T[], max: number): T[][] {
  const out:T[][]=[];
  const walk=(start:number,chosen:T[])=>{ if(chosen.length) out.push([...chosen]);
    if(chosen.length===max)return; for(let i=start;i<xs.length;i++) walk(i+1,[...chosen,xs[i]]); };
  walk(0,[]); return out;
}
function key(driverId:string, ids:string[]) { return `${driverId}|${[...ids].sort().join(',')}`; }

export function optimizeAdaptiveDispatch(input: {
  orders: readonly AdaptiveOrder[]; drivers: readonly AdaptiveDriver[];
  estimates: readonly BundleEstimate[]; evaluatedAt: string;
  config?: Partial<AdaptiveConfig>;
}): AdaptivePlan {
  const now=Date.parse(input.evaluatedAt); if(!Number.isFinite(now)) throw new Error('INVALID_EVALUATED_AT');
  const c={...DEFAULT_ADAPTIVE_CONFIG,...input.config};
  const orders=[...input.orders].sort((a,b)=>a.id.localeCompare(b.id));
  const drivers=[...input.drivers].sort((a,b)=>a.id.localeCompare(b.id));
  const estimates=new Map(input.estimates.map(e=>[key(e.driverId,e.orderIds),e]));
  const trace:CandidateTrace[]=[];
  for(const d of drivers) {
    const free=Math.max(0,Math.floor(d.capacity-d.load));
    const max=Math.min(free,c.maxEnumeratedBundleSize,orders.length);
    // Even a zero-capacity driver gets deterministic singleton audit rows;
    // otherwise hard-filter diagnostics would disappear from the trace.
    const bundles=max>0?combinations(orders,max):orders.map(order=>[order]);
    for(const bundle of bundles) {
      if(trace.length>=c.maxOptions) throw new Error('OPTION_LIMIT_EXCEEDED');
      const ids=bundle.map(o=>o.id); const reasons:HardReason[]=[];
      if(!d.online) reasons.push('OFFLINE'); if(!d.sessionActive) reasons.push('SESSION_INACTIVE');
      if(!d.gps) reasons.push('GPS_MISSING');
      if(d.gpsAgeSeconds>c.maxGpsAgeSeconds) reasons.push('GPS_STALE');
      if(d.gpsAccuracyM>c.maxGpsAccuracyM) reasons.push('GPS_UNTRUSTED');
      if(ids.length>free) reasons.push('CAPACITY'); if(d.network==='offline') reasons.push('NETWORK_OFFLINE');
      if(!d.routeFeasible||bundle.some(o=>!o.routeFeasible)) reasons.push('ROUTE_INFEASIBLE');
      if(d.gps&&bundle.some(o=>km(d.gps!,o.pickup)>d.radiusKm)) reasons.push('RADIUS');
      const e=estimates.get(key(d.id,ids));
      if(!e||!e.routeFeasible||e.detourMinutes>c.maxDetourMinutes) reasons.push('ROUTE_INFEASIBLE');
      if(e&&bundle.some(o=>Date.parse(o.deadlineAt)-now < (e.etaMinutes+c.deadlineSafetyMinutes)*60000)) reasons.push('DEADLINE');
      const hard=[...new Set(reasons)];
      if(hard.length||!e) { trace.push({driverId:d.id,orderIds:ids,eligible:false,hardReasons:hard,score:null,factors:null}); continue; }
      const factors={eta:e.etaMinutes*c.etaWeight,detour:e.detourMinutes*c.detourWeight,
        load:(d.load/d.capacity)*c.loadWeight,fairness:d.assignmentsLastHour*c.fairnessWeight,
        battery:d.batteryPct!==null&&d.batteryPct<20?c.lowBatteryPenalty:0,
        network:d.network==='poor'?c.poorNetworkPenalty:0};
      const score=Object.values(factors).reduce((a,b)=>a+b,0);
      trace.push({driverId:d.id,orderIds:ids,eligible:true,hardReasons:[],score,factors});
    }
  }
  const options=trace.filter(t=>t.eligible&&t.score!==null).sort((a,b)=>
    a.driverId.localeCompare(b.driverId)||a.orderIds.join(',').localeCompare(b.orderIds.join(',')));
  let best:CandidateTrace[]=[]; let bestCount=-1,bestScore=Infinity,bestSig='';
  let searchNodes=0;
  const search=(i:number,picked:CandidateTrace[],usedD:Set<string>,usedO:Set<string>)=>{
    if(++searchNodes>c.maxSearchNodes) throw new Error('SEARCH_NODE_LIMIT_EXCEEDED');
    if(i===options.length){const count=usedO.size,score=picked.reduce((n,o)=>n+o.score!,0);
      const sig=picked.map(o=>key(o.driverId,o.orderIds)).sort().join(';');
      if(count>bestCount||(count===bestCount&&(score<bestScore-1e-9||(Math.abs(score-bestScore)<=1e-9&&(bestSig===''||sig<bestSig)))))
        {best=[...picked];bestCount=count;bestScore=score;bestSig=sig;} return;}
    search(i+1,picked,usedD,usedO); const o=options[i];
    if(!usedD.has(o.driverId)&&o.orderIds.every(id=>!usedO.has(id))){
      const nd=new Set(usedD).add(o.driverId),no=new Set(usedO);o.orderIds.forEach(id=>no.add(id));
      search(i+1,[...picked,o],nd,no);}
  };
  search(0,[],new Set(),new Set());
  const assigned=new Set(best.flatMap(o=>o.orderIds));
  return {algorithmVersion:ADAPTIVE_DISPATCH_VERSION,evaluatedAt:new Date(now).toISOString(),
    assignments:best.sort((a,b)=>a.driverId.localeCompare(b.driverId)).map(o=>({driverId:o.driverId,orderIds:o.orderIds,score:o.score!})),
    unassignedOrderIds:orders.map(o=>o.id).filter(id=>!assigned.has(id)),
    fallback:best.some(o=>o.orderIds.length>1)?'GLOBAL_BUNDLES':best.length?'GLOBAL_SINGLES':'HOLD',
    objective:{assignedOrders:assigned.size,totalScore:bestScore===Infinity?0:bestScore,signature:bestSig},trace};
}
