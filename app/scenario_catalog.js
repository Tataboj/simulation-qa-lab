/** Single source of public scenario labels and reproducible UI instructions. */
export const SCENARIOS = Object.freeze({
  movement: Object.freeze({id:'ECHO-01', label:'Movement validation', subtitle:'Convoy telemetry validation', finding:'POSITION_JUMP', inspectTime:'01:05'}),
  checkpoint: Object.freeze({id:'ECHO-CP01', label:'Checkpoint triggers', subtitle:'Checkpoint event validation', finding:'CHECKPOINT_EVENT_MISSING', inspectTime:'00:58'}),
  sequence: Object.freeze({id:'ECHO-EV01', label:'Event ordering', subtitle:'Objective event-order validation', finding:'EVENT_ORDER_VIOLATION', inspectTime:'00:35'})
});
export function optionLabel(domain) {
  if(!Object.hasOwn(SCENARIOS,domain)) throw new Error(`Unknown QA domain: ${domain}`);
  const s=SCENARIOS[domain]; return `${s.label} · ${s.id}`;
}
export function scenarioForId(id){
  const found=Object.values(SCENARIOS).find(s=>s.id===id);
  if(!found)throw new Error(`Unknown fictional exercise: ${id}`);
  return found;
}
export function reproductionSteps(id,variant){
  const s=scenarioForId(id);
  const steps=['Open Simulation QA Lab',`In TEST DOMAIN choose ${optionLabel(Object.keys(SCENARIOS).find(k=>SCENARIOS[k]===s))}`,`Select ${variant.includes('fault')?'Injected fault':'Reference run'}`];
  if(s.id==='ECHO-EV01')return [...steps,'Go to T+00:35 using the replay timeline','Inspect ECHO-ALPHA and the original objective event log'];
  if(s.id==='ECHO-CP01')return [...steps,'Go to T+00:58 using the replay timeline','Inspect ECHO-ALPHA, CP-ALPHA and the original event log'];
  return [...steps,'Go to T+01:05 using the replay timeline','Inspect ECHO-BRAVO and the original telemetry transition'];
}
