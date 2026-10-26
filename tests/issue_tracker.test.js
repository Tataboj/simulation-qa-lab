import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {issueFromRun, makeIssueZip, saveIssueZip} from '../app/issue_report.js';
const load=n=>JSON.parse(readFileSync(new URL(`../public/data/${n}.json`,import.meta.url),'utf8'));
const fault=load('fault'),clean=load('clean');
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+XJuIXAAAAABJRU5ErkJggg==','base64'));
test('issue title is actionable and includes rule, time, entity and measured impact',()=>{
  const issue=issueFromRun(fault,'fault');
  assert.match(issue.summary,/ECHO-01/);
  assert.match(issue.summary,/ECHO-BRAVO/);
  assert.match(issue.summary,/01:05/);
  assert.match(issue.summary,/4,041/);
  assert.match(issue.summary,/90 km\/h/);
  assert.doesNotMatch(issue.summary,/QA-001/);
});
test('ticket description is suitable for copy/paste and does not invent software root cause',()=>{
  const issue=issueFromRun(fault,'fault',{userAgent:'TestBrowser/1.0',host:'127.0.0.1:5173'});
  for(const heading of ['STEPS TO REPRODUCE','EXPECTED RESULT','ACTUAL RESULT','ENVIRONMENT','ROOT CAUSE','ACCEPTANCE / REGRESSION','ATTACHMENTS'])assert.ok(issue.body.includes(heading),heading);
  assert.match(issue.body,/synthetic fault/i);
  assert.match(issue.body,/TestBrowser\/1\.0/);
  assert.match(issue.body,/127\.0\.0\.1:5173/);
  assert.match(issue.body,/49\.57694659/);
  assert.match(issue.body,/17\.74321918/);
  assert.match(issue.body,/priority: not assigned/i);
  assert.match(issue.body,/subject to team triage/i);
});
test('reference PASS run must NOT create a bogus bug ticket',()=>{
  assert.throws(()=>issueFromRun(clean,'clean'),/No failing simulated issue/);
});
test('package requires a genuine PNG header, rather than claiming a screenshot exists',async()=>{
  await assert.rejects(()=>makeIssueZip(fault,'fault',new Uint8Array([1,2,3]),{},new Date(),png),/not a valid PNG/);
});
test('package exports ZIP holding summary, description, image, XLSX and JSON',async()=>{
  const {blob,files,filename}=await makeIssueZip(fault,'fault',png,{},new Date(),png);
  assert.equal(blob.type,'application/zip');
  assert.match(filename,/ECHO-BRAVO.*\.zip$/);
  const names=files.map(([n])=>n);
  for(const ext of ['summary.txt','description.txt','.xlsx','.json','.png'])assert.ok(names.some(n=>n.endsWith(ext)),ext);
  const archive=new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual(Array.from(archive.slice(0,4)),[0x50,0x4b,0x03,0x04]);
  const json=JSON.parse(files.find(([n])=>n.endsWith('_raw_evidence.json'))[1]);
  assert.equal(json.telemetry.length,242);
  assert.equal(json.findings[0].current.t,65);
  assert.equal(JSON.stringify(fault),JSON.stringify(load('fault')),'No source mutation');
});
test('ZIP is offered for download only AFTER evidence renders and archive is complete',async()=>{
  let rendered=false,downloaded=false,captured;
  const mock={URL:{createObjectURL(blob){assert.equal(rendered,true);assert.ok(blob.size>100);return 'blob:mock';},revokeObjectURL(){}},
   document:{createElement(){return {click(){downloaded=true;},remove(){}};},body:{append(a){captured=a;}}},
   setTimeout(){} };
  const result=await saveIssueZip(fault,'fault',async()=>{rendered=true;return {mapPng:png,uiPng:png};},{},mock);
  assert.equal(result.method,'download');assert.equal(downloaded,true);assert.match(captured.download,/issue_bundle\.zip$/);
});
test('failed screenshot generates NO download and NO zero-byte archive',async()=>{
  let touched=false;
  const mock={URL:{createObjectURL(){touched=true;throw Error('should not happen');}}};
  await assert.rejects(()=>saveIssueZip(fault,'fault',async()=>{throw new Error('Map invalid');},{},mock),/Map invalid/);
  assert.equal(touched,false);
});
test('integration wires copy controls and map evidence to actual buttons',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const js=readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
  for(const id of ['copyIssueTitle','copyIssueDescription','downloadIssueBundle','issueSummaryText','issueDescriptionText'])assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(js,/navigator\.clipboard\?\.writeText/);
  assert.match(js,/renderAnnotatedMapPng\(map/);
  assert.match(js,/canvasContextAttributes:\{preserveDrawingBuffer:true\}/);
});
test('map evidence screenshot is honest map canvas capture and annotates actual raw position',async()=>{
  const {renderAnnotatedMapPng}=await import('../app/issue_report.js');
  const issue=issueFromRun(fault,'fault');
  let draw=false,stroke=false,blobMade=false;
  const fakeContext={
    drawImage(...args){draw=args.length>=5;},
    getImageData(x,y){return {data:[(x+y)%200+45,155,(x%80)+80,255]};},
    beginPath(){},arc(){},fill(){},stroke(){stroke=true;},
    moveTo(){},lineTo(){},setLineDash(){},fillRect(){},fillText(){},strokeRect(){},
    set fillStyle(v){},set lineWidth(v){},set strokeStyle(v){},set font(v){}
  };
  const canvas={width:1200,height:800,getContext(){return fakeContext;},toBlob(cb){blobMade=true;cb(new Blob([png],{type:'image/png'}));}};
  const previous=globalThis.document;
  globalThis.document={createElement(name){assert.equal(name,'canvas');return canvas;}};
  const mock={loaded(){return true;},getCanvas(){return {width:1200,height:800,clientWidth:1200};},project([lon,lat]){return {x:lon*15,y:lat*10};}};
  try{
    const result=await renderAnnotatedMapPng(mock,issue,70);
    assert.equal(draw,true);assert.equal(stroke,true);assert.equal(blobMade,true);
    assert.deepEqual(Array.from(result.slice(0,4)),[137,80,78,71]);
  }finally{globalThis.document=previous;}
});
