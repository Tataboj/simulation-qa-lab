import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {issueFromRun, mapEvidenceLayout, mapEvidenceAttributionLines, renderAnnotatedMapPng} from '../app/issue_report.js';
const load=n=>JSON.parse(readFileSync(new URL(`../public/data/${n}.json`,import.meta.url),'utf8'));
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+XJuIXAAAAABJRU5ErkJggg==','base64'));
const fault=issueFromRun(load('fault'),'fault');

test('VP-08.3: separate title + evidence sidebar, ORIGINAL map viewport never overpainted',()=>{
 const g=mapEvidenceLayout(1231,577,1);
 assert.deepEqual({w:g.width,h:g.height,mapY:g.mapY,sideX:g.sideX},{w:1685,h:731,mapY:94,sideX:1231});
 assert.equal(g.height-g.header-g.footer,577);
 assert.equal(g.footer,60); // three attribution lines outside the original map pixels
 assert.equal(g.sideX,g.mapWidth);
 assert.ok(g.sideX>0&&g.sideW>=400);
 assert.throws(()=>mapEvidenceLayout(0,577,1),/Invalid/);
});

test('VP-08.3: raw previous and current markers remain inside unscaled original map after header shift',async()=>{
 let output=null;const ops=[],texts=[];let createCount=0;
 const ctx={
  drawImage(...args){ops.push(['image',...args]);},getImageData(x,y){return {data:[120+(x%25),160+(y%25),185,255]};},
  beginPath(){},arc(...args){ops.push(['arc',...args]);},fill(){},stroke(){},moveTo(x,y){ops.push(['move',x,y]);},lineTo(x,y){ops.push(['line',x,y]);},
  setLineDash(){},fillRect(x,y,w,h){ops.push(['fillRect',x,y,w,h]);},strokeRect(x,y,w,h){ops.push(['strokeRect',x,y,w,h]);},
  fillText(text,x,y,maxWidth){texts.push({text:String(text),x,y,maxWidth});},set fillStyle(x){},set strokeStyle(x){},set lineWidth(x){},set font(x){}
 };
 const canvas=()=>({width:0,height:0,getContext(){return ctx;},toBlob(cb){cb(new Blob([png],{type:'image/png'}));}});
 const old=globalThis.document;globalThis.document={createElement(){const c=canvas();createCount++;if(createCount===1)output=c;return c;}};
 const map={loaded(){return true;},getCanvas(){return {width:1231,height:577,clientWidth:1231,clientHeight:577};},
  project([lon,lat]){return lat===fault.finding.previous.lat?{x:620,y:310}:{x:845,y:42};}};
 try {
  await renderAnnotatedMapPng(map,fault,70,{mapMode:'geographic'});
  const geometry=mapEvidenceLayout(1231,577,1);
  assert.equal(output.width,geometry.width); assert.equal(output.height,geometry.height);
 } finally {globalThis.document=old;}
 const image=ops.find(op=>op[0]==='image'&&op.length===6&&op[3]===94);
 assert.ok(image,'source map is drawn separately with offset and original dimensions');
 assert.deepEqual(image.slice(2),[0,94,1231,577]);
 assert.ok(ops.some(op=>op[0]==='arc'&&op[2]===404),'previous: map y310 + 94');
 assert.ok(ops.some(op=>op[0]==='arc'&&op[2]===136),'current: map y42 + 94, never hidden by header');
 const tipX=620+225*.68,tipY=404+(136-404)*.68;
 assert.ok(ops.some(op=>op[0]==='move'&&Math.abs(op[1]-tipX)<.01&&Math.abs(op[2]-tipY)<.01),'fault arrow points from previous T+64 to current T+65');
 assert.ok(texts.some(t=>t.text==='START T+01:04'));
 assert.ok(texts.some(t=>t.text==='FAULT T+01:05'));
 assert.ok(texts.some(t=>t.text.includes('Red arrow = direction')));
 assert.ok(texts.some(t=>t.text.includes('4041.1 km/h')));
 const footerGeometry=mapEvidenceLayout(1231,577,1);
 const footerY=footerGeometry.mapY+577;
 for (const exact of mapEvidenceAttributionLines('geographic')) {
   const found=texts.find(t=>t.text===exact);
   assert.ok(found,`Missing visible geographic credit: ${exact}`);
   assert.ok(found.y>footerY && found.y<=footerGeometry.height,`Attribution outside footer: ${exact}`);
   assert.equal(found.maxWidth,footerGeometry.width-20,'Attribution width constrained to export image');
 }
 assert.ok(texts.some(t=>t.text.includes('https://www.openstreetmap.org/copyright')));
 assert.ok(texts.some(t=>t.text.includes('© OpenMapTiles')));
 assert.ok(texts.some(t=>t.text.includes('© OpenStreetMap contributors')));
});

test('VP-08.3: refuses misleading cropped map evidence when raw endpoint is outside visible viewport',async()=>{
 const ctx={getImageData(x,y){return {data:[130+(x%22),145+(y%33),175,255]};},drawImage(){}};
 const doc=globalThis.document;globalThis.document={createElement(){return {width:0,height:0,getContext(){return ctx;}};}};
 const map={loaded(){return true;},getCanvas(){return {width:1231,height:577,clientWidth:1231,clientHeight:577};},project(){return {x:-20,y:30};}};
 try{await assert.rejects(()=>renderAnnotatedMapPng(map,fault,70),/outside the current map view/);}
 finally{globalThis.document=doc;}
});

test('VP-08.3: event-order and checkpoint evidence never suggest a false movement jump',()=>{
 const code=readFileSync(new URL('../app/issue_report.js',import.meta.url),'utf8');
 assert.match(code,/f\.rule==='POSITION_JUMP'\)directedFaultArrow/);
 assert.match(code,/Independent source-log error/);
 assert.match(code,/ctx\.drawImage\(source,0,layout\.mapY,width,height\)/);
});


test('LIC-01: static PNG attribution distinguishes online OpenMapTiles/ODbL from fictional offline art',()=>{
 const geographic=mapEvidenceAttributionLines('geographic');
 assert.equal(geographic.length,3);
 assert.match(geographic.join(' '),/© OpenMapTiles/);
 assert.match(geographic.join(' '),/© OpenStreetMap contributors/);
 assert.match(geographic.join(' '),/OpenFreeMap/);
 assert.match(geographic.join(' '),/ODbL/);
 assert.match(geographic.join(' '),/https:\/\/www\.openstreetmap\.org\/copyright/);
 assert.match(geographic.join(' '),/https:\/\/openmaptiles\.org\//);
 assert.deepEqual(mapEvidenceAttributionLines(undefined),geographic,'unknown map mode credits online sources conservatively');
 const offline=mapEvidenceAttributionLines('synthetic');
 assert.equal(offline.length,3);
 assert.match(offline.join(' '),/original fictional artwork/);
 assert.doesNotMatch(offline.join(' '),/© OpenMapTiles|© OpenStreetMap contributors/);
});
