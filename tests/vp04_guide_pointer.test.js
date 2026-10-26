import test from 'node:test';
import assert from 'node:assert/strict';
import {GUIDE_TOPICS,initGuide} from '../app/guide.js';
function harness(){
 const elements=new Map(),listeners=new Map();
 function element(id){return {id,hidden:true,textContent:'',style:{},attrs:{},getAttribute(k){return this.attrs[k]??null;},setAttribute(k,v){this.attrs[k]=String(v)},removeAttribute(k){delete this.attrs[k]},classList:{add(){},remove(){}},addEventListener(k,fn){this.handlers??={};this.handlers[k]=fn},getBoundingClientRect(){return {top:60,left:20,right:150}},offsetHeight:80,contains(v){return v===this}}}
 for(const id of ['guideToggle','guideTip','guideTipTitle','guideTipText','guideClose','guideInstructions'])elements.set(id,element(id));
 const control=element('btnClean');control.closest=s=>s==='#btnClean'?control:null;
 const emptyMap=element('map');emptyMap.closest=s=>s==='#map'?emptyMap:null;
 let point=control;
 const doc={getElementById:id=>elements.get(id),querySelectorAll:()=>[],contains:()=>true,
   elementFromPoint(){return point;},addEventListener:(k,f)=>listeners.set(k,f)};
 const win={innerWidth:1400,innerHeight:900};
 const guide=initGuide({document:doc,window:win});
 return {elements,listeners,guide,control,emptyMap,setPoint:x=>{point=x}};
}
test('Guide defaults ON but does not create sticky map popup from blank map movements',()=>{
 assert.ok(!GUIDE_TOPICS.some(x=>x.selector==='#map'));
 const h=harness(),tip=h.elements.get('guideTip');assert.equal(h.guide.enabled,true);
 h.setPoint(h.emptyMap);h.listeners.get('pointermove')({target:h.emptyMap,clientX:500,clientY:500});
 assert.equal(tip.hidden,true,'blank map does not launch help');
 h.setPoint(h.control);h.listeners.get('pointermove')({target:h.control,clientX:30,clientY:70});
 assert.equal(tip.hidden,false);assert.match(h.elements.get('guideTipTitle').textContent,/Reference run/);
 h.setPoint(h.emptyMap);h.listeners.get('pointermove')({target:h.control,clientX:500,clientY:500});
 assert.equal(tip.hidden,true,'guide dismissed even if old target continues receiving pointer events');
 h.listeners.get('keydown')({key:'Escape'});assert.equal(h.guide.enabled,false);
});
