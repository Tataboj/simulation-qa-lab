import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {reproductionSteps,optionLabel,SCENARIOS,scenarioForId} from '../app/scenario_catalog.js';
import {reportFor} from '../app/evidence_export.js';
const load=name=>JSON.parse(readFileSync(new URL(`../public/data/${name}.json`,import.meta.url),'utf8'));
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('three scenario selectors and their ID/labels have a single catalog',()=>{
 assert.deepEqual(Object.keys(SCENARIOS),['movement','checkpoint','sequence']);
 for(const [domain,s] of Object.entries(SCENARIOS)){
  assert.equal(scenarioForId(s.id),s);
  assert.equal(optionLabel(domain),`${s.label} · ${s.id}`);
  assert.ok(s.subtitle && s.finding && s.inspectTime);
 }
 assert.throws(()=>scenarioForId('UNKNOWN'));
});
test('copyable reproduction instructions exactly match live domain option labels',()=>{
 for(const [domain,clean,fault] of [['movement','clean','fault'],['checkpoint','checkpoint_clean','checkpoint_fault'],['sequence','sequence_clean','sequence_fault']]){
  const label=optionLabel(domain);
  for(const [filename,variant] of [[clean,'clean'],[fault,'fault']]){
   const report=reportFor(load(filename),variant);
   assert.equal(report.exercise,SCENARIOS[domain].id);
   assert.equal(report.steps[1],`In TEST DOMAIN choose ${label}`);
   assert.match(report.steps[2],/Select (Injected fault|Reference run)/);
  }
 }
 assert.doesNotMatch(reproductionSteps('ECHO-EV01','fault').join(' '),/Event sequence/);
});
test('header and left mission card reflect current QA domain, never stale fixed ECHO-01',()=>{
 const html=read('index.html'),main=read('app/main.js');
 for(const tag of ['brandExercise','missionScenario','missionSubtitle','qaDomain'])assert.match(html,new RegExp(`id="${tag}"`));
 for(const tag of ['brandExercise','missionScenario','missionSubtitle'])assert.match(main,new RegExp(`\\$\\('${tag}'\\)`));
 assert.match(main,/optionLabel\(key\)/);
 assert.match(main,/scenario_id!==meta\.id/);
 assert.match(main,/\$\('qaDomain'\)\.value=next/);
});
test('candidate README describes the current public handoff without claiming publication',()=>{
 const version=JSON.parse(read('package.json')).version;
 const readme=read('README.md');
 assert.ok(readme.includes(version));
 for (const id of ['ECHO-CP01','ECHO-EV01','POSITION_JUMP','EVENT_ORDER_VIOLATION']) assert.ok(readme.includes(id),id);
 assert.match(readme,/hosted GitHub Pages site has not been deployed/i); 
 for (const file of ['docs/QA_ARCHITECTURE.md','docs/THIRD_PARTY_PROVENANCE.md','LICENSE','THIRD_PARTY_NOTICES.md']) assert.ok(existsSync(new URL('../'+file,import.meta.url)),file);
});
