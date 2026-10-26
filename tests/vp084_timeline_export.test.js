import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readScrubberSnapshot,replaceClonedScrubber,prepareUiClone} from '../app/ui_context.js';

function live(value='70',clock='01:10',theme='daylight') {
  const input={type:'range',min:'0',max:'120',value};
  const root={ownerDocument:{documentElement:{getAttribute(k){return k==='data-theme'?theme:null;}}},
    querySelector(s){return s==='#scrubber'?input:s==='#elapsed'?{textContent:clock}:null;}};
  return {root,input};
}
function mockClone() {
  let replacement, canvasReplacement;
  const scrubber={type:'range',replaceWith(el){replacement=el;}};
  const canvas={className:'maplibregl-canvas',style:{cssText:'width:100px',width:'100px',height:'90px'},replaceWith(el){canvasReplacement=el;}};
  const clonedRoot={querySelector(s){return s==='.maplibregl-canvas'?canvas:s==='.rail'||s==='.inspector'?{scrollTop:27}:null;}};
  const doc={getElementById(id){return id==='app'?clonedRoot:id==='scrubber'?scrubber:null;},
    createElement(tag){return {tag,style:{},appendChild(v){(this.children??=[]).push(v);},setAttribute(k,v){(this.attrs??={})[k]=v;}};}};
  return {doc,get replacement(){return replacement;},get canvasReplacement(){return canvasReplacement;}};
}
function thumbReplacement(replacement) {return replacement.children[0].children[1];}

test('VP08.4: export does not rasterize input range as phantom text "70"',()=>{
  const real=live();const copy=mockClone();
  const state=readScrubberSnapshot(real.root);
  assert.equal(state.fraction,70/120);
  prepareUiClone(copy.doc,'data:image/png;base64,ABC',state);
  assert.equal(real.input.value,'70','original live slider is unchanged');
  assert.equal(copy.replacement.className,'batsim-export-static-scrubber');
  assert.equal(copy.replacement.attrs['aria-hidden'],'true');
  assert.equal(copy.replacement.children[0].children[0].style.cssText.includes('width:58.3333%'),true);
  assert.equal(thumbReplacement(copy.replacement).style.cssText.includes('left:58.3333%'),true);
  assert.equal(JSON.stringify(copy.replacement).includes('70'),false,'the export-only graphic has no numeric value text');
});

test('VP08.4: exported decorative thumb is accurate at 00:00, 01:05 and 02:00 in both themes',()=>{
  for(const [value,clock,pct] of [['0','00:00','0.0000'],['65','01:05','54.1667'],['120','02:00','100.0000']]) {
    for(const theme of ['daylight','night']) {
      const {root}=live(value,clock,theme);const {doc,...copy}=mockClone();
      const graphic=replaceClonedScrubber(doc,readScrubberSnapshot(root));
      assert.match(thumbReplacement(graphic).style.cssText,new RegExp(`left:${pct}%`));
      const expected=theme==='daylight'?'#087e98':'#62d6db';
      assert.ok(thumbReplacement(graphic).style.cssText.includes(expected));
    }
  }
});

test('VP08.4: contradictory clock and slider are rejected rather than exporting misleading evidence',()=>{
  assert.throws(()=>readScrubberSnapshot(live('70','01:05').root),/clock and slider disagree/);
  assert.throws(()=>readScrubberSnapshot(live('140','02:20').root),/out of range/);
  assert.throws(()=>readScrubberSnapshot(live('70','not clock').root),/clock is unavailable/);
  const copy=mockClone();
  assert.throws(()=>replaceClonedScrubber(copy.doc,{fraction:Infinity,theme:'daylight'}),/valid frozen/);
});

test('VP08.4: only export clone is altered, and screenshot hook always replaces native range',()=>{
  const ctx=readFileSync(new URL('../app/ui_context.js',import.meta.url),'utf8');
  const main=readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
  assert.match(ctx,/onclone:\(doc\)=>prepareUiClone\(doc,mapDataUrl,scrubberSnapshot\)/);
  assert.match(ctx,/const scrubberSnapshot=readScrubberSnapshot\(root\)/);
  assert.match(ctx,/replaceClonedScrubber\(clonedDoc,scrubberSnapshot\)/);
  assert.match(main,/uiPng:await renderUiContextPng/);
  assert.match(main,/playing=false;render\(\)/);
});
