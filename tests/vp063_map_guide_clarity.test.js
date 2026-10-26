import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {guideTopicFor,initGuide,GUIDE_TOPICS} from '../app/guide.js';
import {mapContext} from '../app/vp02_metadata.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('resizable separator is not a Guide Mode hover or focus topic',()=>{
  const html=read('index.html');
  assert.match(html,/id="railResize"[^>]*role="separator"/);
  assert.match(html,/id="railResize"[^>]*aria-description="Drag edge to resize/);
  assert.doesNotMatch(html,/<div id="railResize"[^>]*data-guide=/);
  assert.ok(!GUIDE_TOPICS.some(t=>t.selector==='#railResize'));
  const separator={closest(selector){return selector==='#railResize'?this:null;}};
  assert.equal(guideTopicFor(separator,{contains:()=>true}),null);
});

test('dragging suppresses all floating help even over another enabled guide control',()=>{
  const elements=new Map(),listeners=new Map(),dataset={};
  function node(id){return {id,hidden:true,textContent:'',style:{},attrs:{},
    setAttribute(k,v){this.attrs[k]=v;},getAttribute(){return null;},
    classList:{add(){},remove(){}},
    addEventListener(name,fn){this.listeners??={};this.listeners[name]=fn;},
    getBoundingClientRect(){return {left:30,top:80,right:180}},
    contains(target){return target===this;},offsetHeight:100};}
  for(const id of ['guideToggle','guideTip','guideTipTitle','guideTipText','guideClose','guideInstructions'])elements.set(id,node(id));
  const guided=node('btnFault');guided.closest=selector=>selector==='#btnFault'?guided:null;
  const grip=node('railResize');grip.closest=selector=>selector==='#railResize'?grip:null;
  const doc={documentElement:{dataset},getElementById:id=>elements.get(id),contains:()=>true,
    addEventListener:(type,fn)=>listeners.set(type,fn),elementFromPoint:()=>guided};
  const gui=initGuide({document:doc,window:{innerWidth:1024,innerHeight:768}});
  listeners.get('pointerover')({target:guided,clientX:15,clientY:20});
  assert.equal(elements.get('guideTip').hidden,false,'guide works for regular controls');
  dataset.railResizing='true';
  listeners.get('pointermove')({target:grip,clientX:250,clientY:150});
  assert.equal(elements.get('guideTip').hidden,true,'drag must remove existing popup');
  listeners.get('pointerover')({target:grip,clientX:250,clientY:150});
  assert.equal(elements.get('guideTip').hidden,true,'no replacement popup during drag');
  dataset.railResizing='false';
  listeners.get('pointermove')({target:guided,clientX:15,clientY:20});
  assert.equal(elements.get('guideTip').hidden,false,'guide resumes afterwards');
  listeners.get('focusin')({target:grip});
  assert.equal(elements.get('guideTip').hidden,true,'separator focus keeps help unobtrusive');
  assert.equal(gui.enabled,true,'Guide remains ON');
});

test('map-mode labels distinguish alternate CARTOGRAPHY from entity location',()=>{
  const html=read('index.html'),main=read('app/main.js'),guide=read('app/guide.js');
  assert.match(mapContext('synthetic'),/OFFLINE SCHEMATIC.*same synthetic WGS84/);
  assert.match(mapContext('geographic'),/Czechia.*fictional training replay/);
  assert.match(html,/id="mapModeHint"/);
  assert.doesNotMatch(html,/id="mapModeToggle"[^>]*aria-pressed=/,'action button must not falsely announce current selection as pressed');
  assert.doesNotMatch(main,/mapModeToggle'\)\.setAttribute\('aria-pressed'/);
  assert.match(main,/mapModeToggle'\)\.setAttribute\('aria-label'/);
  assert.match(main,/Offline schematic map/);
  assert.match(main,/Geographic map \(online\)/);
  assert.match(main,/SAME unit coordinates/);
  assert.match(guide,/invented roads, river and buildings/);
  assert.match(main,/map\.setStyle\(mapMode==='geographic'\?ONLINE_STYLE:SYNTHETIC_STYLE\)/);
  assert.doesNotMatch(main,/on\('click'[^\n]*reset.*[Ee]ntit/);
});

test('UI relabeling does not touch the original synthetic data and offline image sources',()=>{
  const main=read('app/main.js');
  for(const item of ['terrain-night','terrain-day','terrain-night-raster','terrain-day-raster'])assert.ok(main.includes(item));
  assert.match(main,/map\.addSource\('terrain-day'/);
  assert.match(main,/map\.addSource\('terrain-night'/);
  assert.match(read('app/issue_report.js'),/Offline schematic/);
});
