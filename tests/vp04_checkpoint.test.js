import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reportFor,buildExport} from '../app/evidence_export.js';
import {issueFromRun,makeIssueZip} from '../app/issue_report.js';
const load = n => JSON.parse(readFileSync(new URL(`../public/data/${n}.json`,import.meta.url),'utf8'));
const clean=load('checkpoint_clean'),fault=load('checkpoint_fault');
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+XJuIXAAAAABJRU5ErkJggg==','base64'));
test('checkpoint baseline PASS and missing-event fault FAIL; telemetry identical',()=>{
 assert.equal(clean.qa.status,'PASS');assert.equal(fault.qa.status,'FAIL');
 assert.deepEqual(clean.events,fault.events);assert.equal(clean.events.length,242);
 assert.equal(clean.scenario_events.length,1);assert.equal(fault.scenario_events.length,0);
 assert.equal(clean.scenario_events[0].event_type,'CHECKPOINT_ENTER');
 assert.deepEqual(fault.qa.findings.map(f=>[f.rule,f.entity_id,f.expected_t,f.checkpoint_id]),[['CHECKPOINT_EVENT_MISSING','ECHO-ALPHA',58,'CP-ALPHA']]);
});
test('checkpoint reference cannot create an issue ticket',()=>assert.throws(()=>issueFromRun(clean,'checkpoint_clean'),/No failing simulated issue/));
test('checkpoint ticket has explicit event log, reproduction and regression, no fake speed value',()=>{
 const issue=issueFromRun(fault,'checkpoint_fault');
 assert.match(issue.summary,/CHECKPOINT_ENTER not logged/);assert.match(issue.summary,/ECHO-ALPHA/);assert.match(issue.summary,/00:58/);
 assert.match(issue.body,/EXPECTED RESULT/);assert.match(issue.body,/ACTUAL RESULT/);assert.match(issue.body,/ACCEPTANCE \/ REGRESSION/);
 assert.match(issue.body,/Observed event log: \[\]/);assert.doesNotMatch(issue.body,/4041/);
});
test('checkpoint CSV XLSX MD JSON include event information and exact original data',async()=>{
 const report=reportFor(fault,'checkpoint_fault');assert.equal(report.checkpoint.id,'CP-ALPHA');assert.deepEqual(report.scenario_events,[]);
 const json=JSON.parse(await buildExport(fault,'checkpoint_fault','json').blob.text());
 assert.deepEqual(json.telemetry,fault.events);assert.equal(json.qa_result.findings[0].expected_t,58);
 assert.ok(json.checkpoint.radius_m===12);
 const md=await buildExport(fault,'checkpoint_fault','md').blob.text();assert.match(md,/CHECKPOINT_ENTER/);
 const csv=await buildExport(fault,'checkpoint_fault','csv').blob.text();assert.match(csv,/CHECKPOINT_EVENT_MISSING/);
 const xlsx=new TextDecoder().decode(new Uint8Array(await buildExport(fault,'checkpoint_fault','xlsx').blob.arrayBuffer()));
 assert.match(xlsx,/CHECKPOINT_ENTER/);assert.match(xlsx,/CP-ALPHA/);
});
test('checkpoint issue ZIP contains raw JSON plus matching timestamped files',async()=>{
 const r=await makeIssueZip(fault,'checkpoint_fault',png,{},new Date('2026-10-22T17:25:33'),png);
 assert.match(r.filename,/CHECKPOINT_EVENT_MISSING.*_221026_172533_issue_bundle\.zip/);
 assert.equal(r.files.length,7);
 const data=JSON.parse(r.files.find(([n])=>n.endsWith('_raw_evidence.json'))[1]);
 assert.equal(data.findings[0].rule,'CHECKPOINT_EVENT_MISSING');
 assert.ok(r.files.every(([n])=>n.includes('221026_172533')));
});
test('UI wires checkpoint selector, marker, datasets, finding details and guide',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const main=readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
 const guide=readFileSync(new URL('../app/guide.js',import.meta.url),'utf8');
 assert.match(html,/id="qaDomain"/);const catalog=readFileSync(new URL('../app/scenario_catalog.js',import.meta.url),'utf8');assert.match(catalog,/Checkpoint triggers/);
 for(const token of ['checkpoint_clean','checkpoint_fault','CHECKPOINT_EVENT_MISSING','vp04CheckpointMarker','setDomain'])assert.ok(main.includes(token),token);
 assert.match(guide,/#qaDomain/);
});
test('checkpoint PNG annotation uses missing-event terminology and original entry coords',async()=>{
 const {renderAnnotatedMapPng}=await import('../app/issue_report.js');
 const issue=issueFromRun(fault,'checkpoint_fault');
 const texts=[];
 const ctx={drawImage(){},getImageData(x,y){return {data:[100+(x%30),150+(y%30),180,255]}},
   beginPath(){},arc(){},fill(){},stroke(){},moveTo(){},lineTo(){},setLineDash(){},fillRect(){},strokeRect(){},
   fillText(t){texts.push(t)},set fillStyle(x){},set strokeStyle(x){},set lineWidth(x){},set font(x){}};
 const canvas={width:1100,height:720,getContext(){return ctx},toBlob(cb){cb(new Blob([png],{type:'image/png'}))}};
 const old=globalThis.document;globalThis.document={createElement(){return canvas}};
 const map={loaded(){return true},getCanvas(){return {width:1100,height:720,clientWidth:1100}},
   project([lon,lat]){return {x:500+(lon-17.7)*5000,y:300+(49.6-lat)*5000}}};
 try {
  const result=await renderAnnotatedMapPng(map,issue,58,{mapMode:'synthetic'});
  assert.equal(result[0],137);
  assert.ok(texts.some(v=>String(v).includes('CHECKPOINT EVENT')));
  assert.ok(texts.some(v=>String(v).includes('Missing: CHECKPOINT_ENTER')));
  assert.ok(texts.some(v=>String(v).includes('CP-ALPHA')));
  assert.ok(!texts.some(v=>String(v).includes('Observed: 4041')));
 } finally {globalThis.document=old;}
});
