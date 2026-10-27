import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
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
test('README reports actual source version and audited Pages history without implying GitHub Release publication',()=>{
 const version=JSON.parse(read('package.json')).version;
 const readme=read('README.md');
 assert.ok(readme.includes(`**Version:** ` + String.fromCharCode(96) + version + String.fromCharCode(96)));
 assert.match(readme,/source version alone does \*\*not\*\* constitute an official GitHub tag or Release/);
 for (const id of ['ECHO-CP01','ECHO-EV01','POSITION_JUMP','EVENT_ORDER_VIOLATION']) assert.ok(readme.includes(id),id);
 assert.match(readme,/https:\/\/tataboj\.github\.io\/simulation-qa-lab\//i);
 // Readiness evidence is dated, and must not be pinned to an obsolete deployment number.
 assert.match(readme,/16 Python tests/);
 assert.match(readme,/117 JavaScript tests/);
 assert.match(readme,/GitHub QA workflow #\d+ passed for commit `[0-9a-f]{7}`/);
 assert.match(readme,/Pages deployment #\d+ for that commit also passed/);
 assert.match(readme,/https:\/\/tataboj\.github\.io\/simulation-qa-lab\/licenses\/index\.html/);
 assert.match(readme,/Node\.js 22\.12\+/);
 // Normalize CRLF checkout on Windows to the canonical LF Git blob content.
 const lockText=readFileSync(new URL('../package-lock.json',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 const lockDigest=createHash('sha256').update(lockText,'utf8').digest('hex').toUpperCase();
 assert.ok(readme.includes('The included lockfile has SHA-256 `'+lockDigest+'`.'), 'README lockfile checksum must match canonical Git lockfile bytes');
 assert.doesNotMatch(readme,/110 JavaScript tests|GitHub QA workflow #4|Pages deployment #2/i);
 const changelog=read('CHANGELOG.md'),scope=read('docs/QA_SCOPE.md');
 assert.match(changelog,/GitHub QA workflow #\d+/);
 assert.match(changelog,/Pages deployment #\d+/);
 assert.doesNotMatch(changelog,/Not yet deployed/i);
 assert.match(scope,/GitHub CI #\d+/);
 assert.match(scope,/GitHub Pages deployment #\d+/);
 assert.doesNotMatch(scope,/must not be confused with a completed public GitHub or Pages deployment/i);
 assert.match(readme,/explicit owner approval/);
 assert.match(readme,/RG-03/);
 assert.doesNotMatch(readme,/hosted GitHub Pages site has not been deployed/i);
 assert.doesNotMatch(readme,/The hosted demo has not been deployed/i);
 for (const file of ['docs/QA_ARCHITECTURE.md','docs/THIRD_PARTY_PROVENANCE.md','LICENSE','THIRD_PARTY_NOTICES.md']) assert.ok(existsSync(new URL('../'+file,import.meta.url)),file);
});
