import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {uiContextRequirements, prepareUiClone, contextHighlightTargets, readScrubberSnapshot} from '../app/ui_context.js';
import {makeIssueZip,saveIssueZip} from '../app/issue_report.js';
const load = name => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`,import.meta.url),'utf8'));
const fault=load('fault');
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+XJuIXAAAAABJRU5ErkJggg==','base64'));
const root={querySelector(selector){return selector==='#no'?null:{getBoundingClientRect(){return {x:0,y:0,width:100,height:30};}}},getBoundingClientRect(){return {x:0,y:0,width:1800,height:900}}};

test('VP08.2: full UI evidence requires header, both panels, map, timeline, status and active scenario',()=>{
 assert.equal(uiContextRequirements(root,{width:900,height:600},{width:1800,height:900}),true);
 assert.throws(()=>uiContextRequirements(root,{width:900,height:600},{width:900,height:900}),/at least 1050/);
 assert.throws(()=>uiContextRequirements(root,{width:900,height:600},{width:1800,height:590}),/at least 1050/);
 assert.throws(()=>uiContextRequirements({querySelector(){return null;}},{width:900,height:600},{width:1800,height:900}),/missing:/);
 assert.equal(contextHighlightTargets(root).length,5);
});
test('VP08.2: clone replaces MapLibre canvas, hides overlays, resets only CLONED panel scroll',()=>{
 let replacement=null;const original={className:'maplibregl-canvas',style:{cssText:'width:500px;height:400px;',width:'500px',height:'400px'},replaceWith(el){replacement=el;}};
 const left={scrollTop:35},right={scrollTop:45};const tooltip={hidden:false},instructions={hidden:false};
 const dialog={removeAttribute(v){this.removed=v;},style:{}};
 const scrubber={type:'range',replaceWith(el){this.replacement=el;}};
 const doc={getElementById(id){if(id==='app')return {querySelector(s){return s==='.maplibregl-canvas'?original:s==='.rail'?left:s==='.inspector'?right:null;}};return {guideTip:tooltip,guideInstructions:instructions,exportDialog:dialog,scrubber}[id];},createElement(tag){return {tag,style:{},appendChild(el){(this.children??=[]).push(el);},setAttribute(k,v){(this.attrs??={})[k]=v;}};}};
 prepareUiClone(doc,'data:image/png;base64,ABC',{fraction:70/120,theme:'daylight'});
 assert.equal(scrubber.replacement.className,'batsim-export-static-scrubber');
 assert.equal(scrubber.replacement.children[0].children[0].style.cssText.includes('width:58.3333%'),true);
 assert.equal(scrubber.replacement.children[0].children[1].style.cssText.includes('left:58.3333%'),true);
 assert.equal(replacement.tag,'img');assert.equal(replacement.src,'data:image/png;base64,ABC');
 assert.equal(left.scrollTop,0);assert.equal(right.scrollTop,0);
 assert.equal(tooltip.hidden,true);assert.equal(instructions.hidden,true);
 assert.equal(dialog.removed,'open');assert.equal(dialog.style.display,'none');
});
test('VP08.2: 7-file ZIP has two distinct named PNG files and one common local creation timestamp',async()=>{
 const d=new Date(2026,9,25,10,2,5);
 const r=await makeIssueZip(fault,'fault',png,{},d,png);
 assert.equal(r.files.length,7);
 assert.ok(r.files.some(([name])=>name.endsWith('_map_evidence.png')));
 assert.ok(r.files.some(([name])=>name.endsWith('_ui_context.png')));
 assert.ok(r.files.every(([name])=>name.includes('_251026_100205_')));
 const text=r.files.find(([n])=>n.endsWith('_HOW_TO_FILE.txt'))[1];
 assert.match(text,/BOTH map_evidence\.png.*ui_context\.png/);
 assert.deepEqual(JSON.parse(r.files.find(([n])=>n.endsWith('_raw_evidence.json'))[1]).telemetry,fault.events);
 await assert.rejects(()=>makeIssueZip(fault,'fault',png,{},d,undefined),/Full UI context evidence is not a valid PNG/);
 await assert.rejects(()=>makeIssueZip(fault,'fault',png,{},d,new Uint8Array([0])),/Full UI context evidence is not a valid PNG/);
});
test('VP08.2: Save As cancellation never calls either evidence screenshot producer',async()=>{
 let called=false;
 const env={isSecureContext:true,async showSaveFilePicker(){const e=new Error('Cancel');e.name='AbortError';throw e;}};
 await assert.rejects(()=>saveIssueZip(fault,'fault',async()=>{called=true;return {mapPng:png,uiPng:png};},{},env),{name:'AbortError'});
 assert.equal(called,false);
});
test('VP08.2: button actually wires TWO captures with frozen replay and no silent PNG fallback',()=>{
 const main=readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
 const ctx=readFileSync(new URL('../app/ui_context.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(main,/playing=false;render\(\)/);
 assert.match(main,/mapPng:await renderAnnotatedMapPng/);
 assert.match(main,/uiPng:await renderUiContextPng/);
 assert.match(ctx,/await import\('html2canvas'\)/);
 assert.match(ctx,/assessMapPixels/);
 assert.match(html,/2 PNG/);
});
