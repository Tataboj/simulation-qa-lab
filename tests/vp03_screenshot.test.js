import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessMapPixels,issueFromRun,renderAnnotatedMapPng} from '../app/issue_report.js';

const fault=JSON.parse(readFileSync(new URL('../public/data/fault.json',import.meta.url),'utf8'));
const issue=issueFromRun(fault,'fault');
const validPng=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+XJuIXAAAAABJRU5ErkJggg==','base64'));

test('MapLibre 6 screenshot uses canvasContextAttributes, not ignored top-level option',()=>{
 const js=readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
 assert.match(js,/canvasContextAttributes:\{preserveDrawingBuffer:true\}/);
 assert.doesNotMatch(js,/(?:,|\s)preserveDrawingBuffer:true,\s*style:/);
});
test('black GPU canvas is rejected before annotation',()=>{
 const blank={getImageData(){return {data:[0,0,0,255]};}};
 const result=assessMapPixels(blank,1526,744);
 assert.equal(result.valid,false);
 assert.match(result.reason,/blank|black/);
});
test('nonblack daylight and dark scene pixels are accepted',()=>{
 for(const rgb of [[200,220,202],[14,29,39]]){
  const ctx={getImageData(x,y){const n=((x*11+y*7)%90);return {data:[...rgb.map(c=>Math.min(255,c+n)),255]};}};
  assert.equal(assessMapPixels(ctx,1526,744).valid,true);
 }
});
test('capture refuses to package source black canvas even with valid PNG encoder',async()=>{
 const fakeContext={drawImage(){},getImageData(){return {data:[0,0,0,255]};}};
 const fakeCanvas={width:800,height:600,getContext(){return fakeContext},toBlob(cb){cb(new Blob([validPng],{type:'image/png'}));}};
 const old=globalThis.document;
 globalThis.document={createElement(){return fakeCanvas}};
 const map={loaded(){return true},getCanvas(){return {width:800,height:600,clientWidth:800}},project(){return {x:3,y:4}}};
 try{await assert.rejects(()=>renderAnnotatedMapPng(map,issue,70),/Map background appears blank or black/);}
 finally{globalThis.document=old;}
});
