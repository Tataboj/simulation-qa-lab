import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GUIDE_TOPICS,guideTopicFor,initGuide} from '../app/guide.js';

test('guide explains critical controls, raw/display evidence, map, and issue-tracker actions',()=>{
  for(const selector of ['#btnClean','#btnFault','#mapModeToggle','#togglePlay','#scrubber','#layerTrails','#qaStatus','#entityDetails','#downloadIssueBundle','#exportSave','#mapHealth','#themeToggle']){
    assert.ok(GUIDE_TOPICS.some(t=>t.selector===selector || selector==='#layerTrails'&&t.selector.includes('layerTrails')),selector);
  }
  assert.match(GUIDE_TOPICS.find(t=>t.selector==='#entityDetails').description,/RAW SAMPLE/);
  assert.match(GUIDE_TOPICS.find(t=>t.selector==='#btnFault').description,/synthetic|intentionally/i);
  assert.match(GUIDE_TOPICS.find(t=>t.selector==='#downloadIssueBundle').description,/blank|PNG/i);
});
test('guide defaults ON, has one nonblocking contextual bubble, with keyboard access',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../app/guide.css',import.meta.url),'utf8');
 const main=readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
 for(const id of ['guideToggle','guideTip','guideTipTitle','guideTipText','guideInstructions'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(html,/<div id="guideInstructions"[^>]*hidden/);
 assert.match(html,/<button id="guideToggle"[^>]*aria-pressed="true"/);
 assert.equal((html.match(/id="guideTip"/g)||[]).length,1);
 assert.match(html,/<aside id="guideTip"[^>]*hidden/);
 assert.match(css,/pointer-events:none/);
 assert.match(main,/initGuide\(\)/);
 assert.match(css,/guide-highlight/);
});

test('guide toggle, hover, focus and Escape have correct state transitions',()=>{
 const elements=new Map(), listeners=new Map();
 function el(id){return {id,textContent:'',hidden:true,style:{},attrs:{},classes:new Set(),
    setAttribute(k,v){this.attrs[k]=v;},
    classList:{add(){},remove(){}},
    addEventListener(event,fn){this.listeners??={};this.listeners[event]=fn;},
    getBoundingClientRect(){return {top:90,left:40,right:120}},offsetHeight:120,
    contains(v){return v===this;}}}
 for(const id of ['guideToggle','guideTip','guideTipTitle','guideTipText','guideClose','guideInstructions'])elements.set(id,el(id));
 const doc={getElementById(id){return elements.get(id);},contains(){return true;},addEventListener(k,fn){listeners.set(k,fn);}};
 const win={innerWidth:1100,innerHeight:800};
 const ctl=initGuide({document:doc,window:win});
 assert.equal(ctl.enabled,true);
 assert.equal(elements.get('guideToggle').attrs['aria-pressed'],'true');
 assert.equal(elements.get('guideInstructions').hidden,true); // no competing instruction banner
 const target={closest(selector){return selector==='#btnClean'?this:null;},classList:{add(){},remove(){}},getBoundingClientRect(){return {top:95,left:100,right:180}},contains(v){return v===this;}};
 listeners.get('focusin')({target});
 assert.equal(elements.get('guideTip').hidden,false);
 assert.match(elements.get('guideTipTitle').textContent,/Reference run/);
 listeners.get('keydown')({key:'Escape'});
 assert.equal(ctl.enabled,false);assert.equal(elements.get('guideTip').hidden,true);
 assert.equal(elements.get('guideInstructions').hidden,true);
 elements.get('guideToggle').listeners.click();
 assert.equal(ctl.enabled,true);
 elements.get('guideToggle').listeners.click();
 assert.equal(ctl.enabled,false);
});

test('every enabled guide topic is a unique selector with an explanation',()=>{
 const s=new Set();
 for(const topic of GUIDE_TOPICS){assert.ok(!s.has(topic.selector),topic.selector);s.add(topic.selector);assert.ok(topic.title.length>=4);assert.ok(topic.description.length>=25);}
});


test('native browser title tooltips are suppressed while guidance is ON and restored on exit',()=>{
  const elems=new Map();const events=new Map();
  const titled=new Set();let mutationCallback=null;let disconnectCalled=false;
  function element(id){return {id,hidden:true,textContent:'',style:{},attrs:{},
    getAttribute(k){return Object.hasOwn(this.attrs,k)?this.attrs[k]:null;},
    setAttribute(k,v){this.attrs[k]=String(v);},
    removeAttribute(k){delete this.attrs[k];},
    classList:{add(){},remove(){}},
    addEventListener(k,fn){this.listeners??={};this.listeners[k]=fn;},
    getBoundingClientRect(){return {top:10,left:10,right:30}},offsetHeight:80,
    contains(v){return this===v;}};}
  for(const id of ['guideToggle','guideTip','guideTipTitle','guideTipText','guideClose','guideInstructions'])elems.set(id,element(id));
  const control=element('mapModeToggle');control.setAttribute('title','Native map description');titled.add(control);
  const doc={documentElement:{},getElementById(id){return elems.get(id);},
    querySelectorAll(selector){return selector==='[title]'?[...titled].filter(e=>e.getAttribute('title')!==null):[];},
    contains(){return true;},addEventListener(k,fn){events.set(k,fn);}};
  const win={innerWidth:700,innerHeight:500,MutationObserver:class{
    constructor(callback){mutationCallback=callback;}
    observe(){}
    disconnect(){disconnectCalled=true;}
  }};
  const guide=initGuide({document:doc,window:win});
  assert.equal(guide.enabled,true);
  assert.equal(control.getAttribute('title'),null,'native browser popup must not exist');
  assert.equal(elems.get('guideInstructions').hidden,true,'no secondary banner');
  const dynamic=element('newMapZoom');dynamic.setAttribute('title','Zoom in');titled.add(dynamic);
  mutationCallback([]);
  assert.equal(dynamic.getAttribute('title'),null,'dynamic map buttons are also covered');
  control.closest=(selector)=>selector==='#mapModeToggle'?control:null;
  events.get('pointerover')({target:control});
  assert.equal(elems.get('guideTip').hidden,false);
  assert.match(elems.get('guideTipTitle').textContent,/geography/i);
  events.get('keydown')({key:'Escape'});
  assert.equal(guide.enabled,false);
  assert.equal(elems.get('guideTip').hidden,true);
  assert.equal(control.getAttribute('title'),'Native map description');
  assert.equal(dynamic.getAttribute('title'),'Zoom in');
  assert.equal(disconnectCalled,true);
  elems.get('guideToggle').listeners.click();
  assert.equal(guide.enabled,true);
  assert.equal(control.getAttribute('title'),null);
  elems.get('guideToggle').listeners.click();
  assert.equal(guide.enabled,false);
  assert.equal(control.getAttribute('title'),'Native map description');
});
