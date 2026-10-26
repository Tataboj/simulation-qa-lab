import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {distanceMeters,distanceText,replaySeparation} from '../app/separation.js';
import {issueFromRun,renderAnnotatedMapPng} from '../app/issue_report.js';
const load = n=>JSON.parse(readFileSync(new URL(`../public/data/${n}.json`,import.meta.url),'utf8'));
const clean=load('clean'),fault=load('fault'),cp=load('checkpoint_fault');
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+XJuIXAAAAABJRU5ErkJggg==','base64'));
test('WGS84 haversine gives plausible known distances, symmetric and zero for same point',()=>{
 const a={lat:0,lon:0},b={lat:0,lon:1};
 assert.ok(Math.abs(distanceMeters(a,b)-111195)<100);
 assert.ok(Math.abs(distanceMeters(a,b)-distanceMeters(b,a))<1e-8);
 assert.equal(distanceMeters(a,a),0);
 assert.equal(distanceMeters(null,b),null);
 assert.equal(distanceMeters({lat:Infinity,lon:0},b),null);
 assert.equal(distanceMeters({lat:91,lon:0},b),null);
 assert.equal(distanceMeters({lat:null,lon:0},b),null);
 assert.equal(distanceMeters({lat:'49.56',lon:17.7},b),null);
});
test('units cross exactly at one kilometer, no misleading threshold',()=>{
 assert.equal(distanceText(999.49),'999 m');assert.equal(distanceText(1000),'1.00 km');assert.equal(distanceText(null),'—');
});
test('separation changes with simulation time, without modifying raw fixtures',()=>{
 const before=JSON.stringify(clean), start=replaySeparation(clean,0),end=replaySeparation(clean,120);
 assert.ok(start&&end&&start.meters>0&&end.meters>0);
 assert.ok(Math.abs(start.meters-end.meters)>1,'actual separation should vary over time');
 assert.equal(JSON.stringify(clean),before);
 const halfway=replaySeparation(clean,70.5);
 assert.equal(halfway.interpolated,true);
});
test('flagged movement transition is held instead of smoothed and distance remains visible',()=>{
 const sep=replaySeparation(fault,64.5);
 assert.equal(sep.held,true);assert.ok(Number.isFinite(sep.meters));
 assert.notDeepEqual(replaySeparation(fault,65).b,replaySeparation(fault,64.5).b);
});
test('checkpoint event has only 4.14 m between previous and entry raw samples',()=>{
 const f=cp.qa.findings[0];assert.ok(Math.abs(distanceMeters(f.previous,f.current)-4.1443)<.02);
});
test('UI has a working visibility toggle, guide topic, distance readout, and MapLibre layer',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
 const guide=readFileSync(new URL('../app/guide.js',import.meta.url),'utf8');
 for(const token of ['id="layerSeparation"','id="separationValue"','id="separationMode"'])assert.ok(html.includes(token),token);
 for(const token of ['separation-geometry','distance-line','replaySeparation','distanceMarker','layerSeparation'])assert.ok(js.includes(token),token);
 assert.match(guide,/layerSeparation/);
 assert.match(guide,/separationValue/);
});
test('checkpoint screenshot uses ONE readable callout; includes both raw times and measured 4.1 m',async()=>{
 const issue=issueFromRun(cp,'checkpoint_fault');const texts=[];
 const ctx={drawImage(){},getImageData(x,y){return {data:[100+(x%30),130+(y%30),180,255]}},
  beginPath(){},arc(){},fill(){},stroke(){},moveTo(){},lineTo(){},setLineDash(){},fillRect(){},strokeRect(){},
  fillText(text){texts.push(String(text))},set fillStyle(x){},set strokeStyle(x){},set lineWidth(x){},set font(x){}};
 const canvas={width:1526,height:744,getContext(){return ctx},toBlob(cb){cb(new Blob([png],{type:'image/png'}))}};
 const old=globalThis.document;globalThis.document={createElement(){return canvas}};
 const map={loaded(){return true},getCanvas(){return {width:1526,height:744,clientWidth:1526}},
    project([lon,lat]){return {x:700+(lon-17.71)*5000,y:400+(49.56-lat)*5000}}};
 try{
  await renderAnnotatedMapPng(map,issue,58,{mapMode:'geographic'});
  assert.ok(texts.some(s=>s.includes('CP ENTRY T+00:58')));
  assert.ok(texts.some(s=>s.includes('Previous: 57s')));
  assert.ok(texts.some(s=>s.includes('Step: 4.1 m')));
  assert.ok(texts.some(s=>s.includes('Missing: CHECKPOINT_ENTER')));
  assert.ok(!texts.some(s=>s==='BEFORE'||s==='ENTRY'));
 }finally{globalThis.document=old;}
});
