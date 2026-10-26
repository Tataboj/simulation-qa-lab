/** VP-08: cross-boundary acceptance (fixture -> QA -> tracker -> export ZIP).
 *  The 1px PNG is ONLY a structural test input, never a captured real map screenshot.
 *  Actual WebGL/canvas evidence and the Windows Save As dialog remain manual checks.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reportFor, buildExport} from '../app/evidence_export.js';
import {issueFromRun, makeIssueZip} from '../app/issue_report.js';
import {SCENARIOS, optionLabel, reproductionSteps} from '../app/scenario_catalog.js';

const load = key => JSON.parse(readFileSync(new URL(`../public/data/${key}.json`,import.meta.url), 'utf8'));
const cases = [
  {domain:'movement',clean:'clean',fault:'fault',rule:'POSITION_JUMP',entity:'ECHO-BRAVO',time:65},
  {domain:'checkpoint',clean:'checkpoint_clean',fault:'checkpoint_fault',rule:'CHECKPOINT_EVENT_MISSING',entity:'ECHO-ALPHA',time:58},
  {domain:'sequence',clean:'sequence_clean',fault:'sequence_fault',rule:'EVENT_ORDER_VIOLATION',entity:'ECHO-ALPHA',time:35}
];
const marker=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+XJuIXAAAAABJRU5ErkJggg==','base64'));
const stamp=new Date(2026,9,24,10,11,12);

for(const c of cases){
 test(`VP08 ${c.domain}: PASS baseline cannot become issue; FAIL finding is exact`,()=>{
  const ref=load(c.clean), fault=load(c.fault),catalog=SCENARIOS[c.domain];
  assert.equal(ref.scenario_id,catalog.id);assert.equal(fault.scenario_id,catalog.id);
  assert.equal(ref.qa.status,'PASS');assert.equal(ref.qa.findings.length,0);
  assert.equal(fault.qa.status,'FAIL');assert.equal(fault.qa.findings.length,1);
  assert.equal(fault.qa.findings[0].rule,c.rule);
  assert.equal(fault.qa.findings[0].entity_id,c.entity);
  assert.equal(ref.events.length,242);assert.equal(fault.events.length,242);
  assert.throws(()=>issueFromRun(ref,c.clean),/No failing simulated issue/);
  assert.ok(reproductionSteps(catalog.id,c.fault).includes(`In TEST DOMAIN choose ${optionLabel(c.domain)}`));
  assert.ok(reportFor(ref,c.clean).findings.length===0);
  assert.ok(reportFor(fault,c.fault).findings.length===1);
 });
 test(`VP08 ${c.domain}: issue ticket, source-safe exports, 7-file timestamped ZIP`,async()=>{
  const run=load(c.fault), issue=issueFromRun(run,c.fault,{host:'localhost:5173',userAgent:'E2E-test'});
  assert.match(issue.summary,new RegExp(c.entity));
  assert.match(issue.body,/EXPECTED RESULT/);
  assert.match(issue.body,/ACTUAL RESULT/);
  assert.match(issue.body,/STEPS TO REPRODUCE/);
  assert.match(issue.body,/synthetic|fictional/i);
  const json=JSON.parse(await buildExport(run,c.fault,'json').blob.text());
  assert.equal(json.status,'FAIL');
  assert.deepEqual(json.telemetry,run.events);
  assert.deepEqual(json.scenario_events,run.scenario_events||[]);
  assert.equal(json.findings[0].rule,c.rule);
  const csv=await buildExport(run,c.fault,'csv').blob.text();
  assert.match(csv,/"entity_id"/);assert.match(csv,new RegExp(c.rule));
  const markdown=await buildExport(run,c.fault,'md').blob.text();
  assert.match(markdown,new RegExp(c.rule));
  const xlsx=await buildExport(run,c.fault,'xlsx').blob.arrayBuffer();
  assert.deepEqual(Array.from(new Uint8Array(xlsx).slice(0,4)),[80,75,3,4]);
  const archive=await makeIssueZip(run,c.fault,marker,{},stamp,marker);
  assert.match(archive.filename,/241026_101112_issue_bundle\.zip$/);
  assert.equal(archive.files.length,7);
  for(const suffix of ['_summary.txt','_description.txt','_raw_telemetry.xlsx','_raw_evidence.json','_map_evidence.png','_ui_context.png','_HOW_TO_FILE.txt']) {
   assert.equal(archive.files.filter(([name])=>name.endsWith(suffix)).length,1,suffix);
  }
  for (const [name] of archive.files)assert.ok(name.includes('241026_101112'),name);
  assert.deepEqual(JSON.parse(archive.files.find(([name])=>name.endsWith('_raw_evidence.json'))[1]).telemetry,run.events);
  const zip = new Uint8Array(await archive.blob.arrayBuffer());
  assert.deepEqual(Array.from(zip.slice(0,4)),[80,75,3,4]);
 });
}

test('VP08 scenario pairs checkpoint/event order alter source event log, never teleport unit records',()=>{
  for(const [a,b] of [['checkpoint_clean','checkpoint_fault'],['sequence_clean','sequence_fault']]){
   const clean=load(a),fault=load(b);
   assert.deepEqual(clean.events,fault.events);
   assert.notDeepEqual(clean.scenario_events,fault.scenario_events);
  }
});
