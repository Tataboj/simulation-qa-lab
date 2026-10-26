import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reportFor,buildExport} from '../app/evidence_export.js';
import {issueFromRun,makeIssueZip} from '../app/issue_report.js';
const load = n=>JSON.parse(readFileSync(new URL(`../public/data/${n}.json`, import.meta.url),'utf8'));
const names=['sequence_clean','sequence_fault'];

for(const variant of names){
 test(`VP-08.1 ${variant}: no unrelated speed rule in JSON or XLSX`,async()=>{
  const run=load(variant);
  assert.equal(run.qa.rule_max_speed_kmh,undefined);
  const report=reportFor(run,variant);
  assert.equal(report.qa_result.rule_max_speed_kmh,undefined);
  const json=JSON.parse(await buildExport(run,variant,'json').blob.text());
  assert.equal(Object.hasOwn(json.qa_result,'rule_max_speed_kmh'),false);
  assert.deepEqual(json.telemetry,run.events);
  assert.deepEqual(json.scenario_events,run.scenario_events);
  const wb=new TextDecoder().decode(new Uint8Array(await buildExport(run,variant,'xlsx').blob.arrayBuffer()));
  assert.doesNotMatch(wb,/Scenario Speed Limit \(km\/h\)/);
  assert.match(wb,/OBJECTIVE_STARTED/);
  assert.match(wb,/OBJECTIVE_COMPLETED/);
 });
}
test('VP-08.1 event-order finding explicitly preserves authoritative start, completion, violation times',async()=>{
 const run=load('sequence_fault');const finding=run.qa.findings[0];
 assert.equal(finding.objective_start_t,45);
 assert.equal(finding.objective_completed_t,35);
 assert.equal(finding.violation_t,35);
 for(const forbidden of ['expected_t','start_t','end_t'])assert.equal(Object.hasOwn(finding,forbidden),false);
 assert.equal(finding.objective_start_t,run.scenario_events.find(e=>e.event_type==='OBJECTIVE_STARTED').t);
 assert.equal(finding.objective_completed_t,run.scenario_events.find(e=>e.event_type==='OBJECTIVE_COMPLETED').t);
 const issue=issueFromRun(run,'sequence_fault');
 assert.match(issue.summary,/00:35/);assert.match(issue.body,/START 45s; COMPLETE 35s/);
 const exported=JSON.parse(await buildExport(run,'sequence_fault','json').blob.text());
 assert.deepEqual(exported.findings[0],finding);
 // ZIP packaging must inherit the same structured findings, no stale aliases.
 const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+XJuIXAAAAABJRU5ErkJggg==','base64'));
 const bundle=await makeIssueZip(run,'sequence_fault',png,{},new Date('2026-10-25T10:00:01'),png);
 const raw=JSON.parse(bundle.files.find(([n])=>n.endsWith('_raw_evidence.json'))[1]);
 assert.deepEqual(raw.findings[0],finding);
 assert.equal(raw.qa_result.rule_max_speed_kmh,undefined);
});
test('VP-08.1 movement limit still exported as numeric 90 km/h',async()=>{
 for(const variant of ['clean','fault']){
  const run=load(variant);
  assert.equal(run.qa.rule_max_speed_kmh,90);
  const json=JSON.parse(await buildExport(run,variant,'json').blob.text());
  assert.equal(json.qa_result.rule_max_speed_kmh,90);
  const xlsx=new TextDecoder().decode(new Uint8Array(await buildExport(run,variant,'xlsx').blob.arrayBuffer()));
  assert.match(xlsx,/Scenario Speed Limit \(km\/h\)/);
 }
});
