import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reportFor,buildExport} from '../app/evidence_export.js';
import {issueFromRun,makeIssueZip,renderAnnotatedMapPng} from '../app/issue_report.js';
const get=name=>JSON.parse(readFileSync(new URL(`../public/data/${name}.json`,import.meta.url),'utf8'));
const clean=get('sequence_clean'),fault=get('sequence_fault');
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+XJuIXAAAAABJRU5ErkJggg==','base64'));

test('event-order pair validates causality; untouched raw movement',()=>{
 assert.equal(clean.qa.status,'PASS');assert.equal(fault.qa.status,'FAIL');
 assert.equal(fault.qa.findings.length,1);assert.equal(fault.qa.findings[0].rule,'EVENT_ORDER_VIOLATION');
 assert.deepEqual(clean.events,fault.events);
 assert.deepEqual(fault.events,get('clean').events);
 assert.deepEqual(fault.scenario_events.map(x=>[x.event_type,x.t]),[['OBJECTIVE_STARTED',45],['OBJECTIVE_COMPLETED',35]]);
});
test('reference event sequence cannot create a false issue',()=>assert.throws(()=>issueFromRun(clean,'sequence_clean'),/No failing simulated issue/));
test('developer ticket names correct entity, exact event times, no invented external defect',()=>{
 const issue=issueFromRun(fault,'sequence_fault');
 assert.match(issue.summary,/ECHO-ALPHA.*00:35.*OBJECTIVE_STARTED/);
 assert.match(issue.body,/OBJECTIVE_STARTED.*45s/);assert.match(issue.body,/OBJECTIVE_COMPLETED.*35s/);
 assert.match(issue.body,/EXPECTED RESULT/);assert.match(issue.body,/ACCEPTANCE \/ REGRESSION/);
 assert.match(issue.body,/synthetic fixture cause/);assert.doesNotMatch(issue.body,/4041/);
});
test('exports carry original event log, never a reconstructed visual sequence',async()=>{
 const report=reportFor(fault,'sequence_fault');assert.equal(report.exercise,'ECHO-EV01');
 const raw=JSON.parse(await buildExport(fault,'sequence_fault','json').blob.text());
 assert.deepEqual(raw.scenario_events,fault.scenario_events);assert.deepEqual(raw.telemetry,fault.events);
 const md=await buildExport(fault,'sequence_fault','md').blob.text();assert.match(md,/OBJECTIVE_COMPLETED/);
 const csv=await buildExport(fault,'sequence_fault','csv').blob.text();assert.match(csv,/EVENT_ORDER_VIOLATION/);
 const xlsx=new TextDecoder().decode(new Uint8Array(await buildExport(fault,'sequence_fault','xlsx').blob.arrayBuffer()));
 assert.match(xlsx,/OBJECTIVE_STARTED/);assert.match(xlsx,/OBJECTIVE_COMPLETED/);
});
test('issue ZIP contains event ordering, timestamped evidence files',async()=>{
 const r=await makeIssueZip(fault,'sequence_fault',png,{},new Date('2026-10-22T18:01:02'),png);
 assert.match(r.filename,/EVENT_ORDER_VIOLATION.*_221026_180102_issue_bundle\.zip/);
 assert.equal(r.files.length,7);assert.ok(r.files.every(([name])=>name.includes('221026_180102')));
 const data=JSON.parse(r.files.find(([name])=>name.endsWith('_raw_evidence.json'))[1]);
 assert.equal(data.findings[0].rule,'EVENT_ORDER_VIOLATION');
 assert.deepEqual(data.scenario_events,fault.scenario_events);
});
test('event-order finding is integrated into selector, Guide and inspector',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const main=readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
 const guide=readFileSync(new URL('../app/guide.js',import.meta.url),'utf8');
 assert.match(html,/id="qaDomain"/);
 const catalog=readFileSync(new URL('../app/scenario_catalog.js',import.meta.url),'utf8');
 assert.match(catalog,/Event ordering/);assert.match(catalog,/ECHO-EV01/);
 for(const token of ['sequence_clean','sequence_fault','EVENT_ORDER_VIOLATION','Objective completed before it started','00:35'])assert.ok(main.includes(token),token);
 assert.match(guide,/Event ordering QA/);
});
test('event order PNG label identifies the event, does not claim a physical position jump',async()=>{
 const issue=issueFromRun(fault,'sequence_fault'), labels=[];
 const ctx={drawImage(){},getImageData(x,y){return {data:[100+(x%30),150+(y%30),180,255]}},beginPath(){},arc(){},fill(){},stroke(){},moveTo(){},lineTo(){},setLineDash(){},fillRect(){},strokeRect(){},fillText(s){labels.push(s)},set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set font(v){}};
 const canvas={width:1100,height:720,getContext(){return ctx},toBlob(cb){cb(new Blob([png],{type:'image/png'}))}};
 const old=globalThis.document;globalThis.document={createElement(){return canvas}};
 const map={loaded(){return true},getCanvas(){return {width:1100,height:720,clientWidth:1100}},project([lon,lat]){return {x:400+(lon-17.7)*5000,y:310+(49.6-lat)*5000}}};
 try{await renderAnnotatedMapPng(map,issue,35,{mapMode:'synthetic'});
 assert.ok(labels.some(s=>String(s).includes('COMPLETED BEFORE STARTED')));
 assert.ok(labels.some(s=>String(s).includes('COMPLETE 35s BEFORE START 45s')));
 assert.ok(labels.some(s=>String(s).includes('EVENT ORDER / SOURCE LOG')));
 assert.ok(!labels.some(s=>String(s).includes('Observed: 4041')));
 } finally{globalThis.document=old;}
});
