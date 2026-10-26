import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {railWidthRange,clampRailWidth,attributionClearance,initLayout} from '../app/layout.js';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('resize bounds protect the QA inspector and main map width',()=>{
  assert.deepEqual(railWidthRange(1776,332),{min:210,max:430});
  assert.equal(clampRailWidth(340,1776,332),340);
  assert.equal(clampRailWidth(2,1776,332),210);
  assert.equal(clampRailWidth(1000,1776,332),430);
  assert.equal(clampRailWidth(1000,930,275),283);
  assert.throws(()=>railWidthRange(Number.NaN,332));
});
test('attribution clearance tracks expanded or wrapped copyright without covering it',()=>{
  assert.equal(attributionClearance(0),34);
  assert.equal(attributionClearance(22),34);
  assert.equal(attributionClearance(42),54);
  assert.equal(attributionClearance(80.2),93);
  const css=read('app/layout.css');
  assert.match(css,/bottom:calc\(var\(--map-attribution-clearance\) \+ 12px\)/);
  assert.match(css,/\.maplibregl-ctrl-attrib/);
  assert.doesNotMatch(css,/\.maplibregl-ctrl-attrib[^}]*display\s*:\s*none/);
});
test('UI includes accessible separator and MapLibre geometry resize hook',()=>{
  const html=read('index.html'),main=read('app/main.js'),guide=read('app/guide.js');
  assert.match(html,/id="railResize"[^>]*role="separator"[^>]*tabindex="0"/);
  assert.match(html,/aria-orientation="vertical"/);
  assert.match(main,/import \{initLayout\} from '\.\/layout\.js'/);
  assert.match(main,/initLayout\(\{resizeMap:\(\)=>map\?\.resize\(\)\}\)/);
  assert.doesNotMatch(guide,/selector:'#railResize'/,'drag handle must not create Guide Mode popup');
  assert.match(html,/aria-description="Drag edge to resize/);
});
function stub(){
  const handlers=new Map();
  const grip={attributes:{},listeners:handlers,
    setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,cb){handlers.set(k,cb);},
    setPointerCapture(){}};
  const shell={width:1776,style:{values:{},setProperty(k,v){this.values[k]=v;}},
    getBoundingClientRect(){return{width:this.width,left:0}},querySelector(s){return s==='.inspector'?inspector:s==='.map-pane'?pane:null}};
  const inspector={getBoundingClientRect(){return{width:332}}};
  const corner={height:24,getBoundingClientRect(){return{height:this.height}}};
  const pane={style:{values:{},setProperty(k,v){this.values[k]=v;}},querySelector(s){return s==='.maplibregl-ctrl-bottom-right'?corner:s==='#map'?{}:null;}};
  const doc={documentElement:{dataset:{}},getElementById(s){return s==='appShell'?shell:s==='railResize'?grip:null}};
  const windowHandlers=new Map();
  const win={innerWidth:1776,getComputedStyle(){return{getPropertyValue(){return'334px'}}},matchMedia(){return{matches:false}},
    addEventListener(k,cb){windowHandlers.set(k,cb)}};
  let resizeCount=0;
  const api=initLayout({doc,win,resizeMap(){resizeCount++}});
  return{handlers,grip,shell,corner,pane,doc,api,getResizeCount:()=>resizeCount};
}
test('drag/keyboard/home/end/reset work and retain map attribution clearance',()=>{
  const x=stub(),fire=(type,extra={})=>{
    const ev={pointerType:'mouse',button:0,pointerId:1,clientX:0,preventDefault(){this.prevented=true;},...extra};
    x.handlers.get(type)(ev);return ev;
  };
  assert.equal(x.shell.style.values['--rail-width'],'334px');
  assert.equal(x.pane.style.values['--map-attribution-clearance'],'36px');
  fire('pointerdown');
  assert.equal(x.doc.documentElement.dataset.railResizing,'true');
  fire('pointermove',{clientX:390});
  assert.equal(x.shell.style.values['--rail-width'],'390px');
  fire('pointerup');
  assert.equal(x.doc.documentElement.dataset.railResizing,'false');
  fire('pointermove',{clientX:420});
  assert.equal(x.shell.style.values['--rail-width'],'390px','drag must end at pointerup');
  fire('keydown',{key:'ArrowLeft'});
  assert.equal(x.shell.style.values['--rail-width'],'372px');
  fire('keydown',{key:'Home'});
  assert.equal(x.grip.attributes['aria-valuenow'],'210');
  fire('keydown',{key:'End'});
  assert.equal(x.grip.attributes['aria-valuenow'],'430');
  fire('dblclick');
  assert.equal(x.grip.attributes['aria-valuenow'],'334');
  x.corner.height=65;x.api.measureAttribution();
  assert.equal(x.pane.style.values['--map-attribution-clearance'],'77px');
  assert.ok(x.getResizeCount()>=5);
  x.api.dispose();
});
