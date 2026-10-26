/** VP-08.2 — evidence of the actual DOM controls and the current MapLibre pixels.
 * The export dialog and Guide bubble are omitted from the COPY only.  Sidebars
 * are scrolled to top in the COPY so mission, PASS/FAIL, and finding are visible.
 * No source fixture, UI selection or map state is modified.
 */
import {assessMapPixels, isPng} from './issue_report.js';

export function uiContextRequirements(root, mapCanvas, viewport = {width:innerWidth,height:innerHeight}) {
  if (!root || !mapCanvas) throw new Error('Full UI context unavailable: app or map missing');
  if (viewport.width < 1050 || viewport.height < 660)
    throw new Error('Full UI evidence needs a browser window at least 1050×660 CSS pixels. Maximize the browser and retry.');
  for (const selector of ['.topbar','.rail','.mainstage','.map-pane','.playback','.inspector','#findingPanel','#qaStatus','.variant.active']) {
    if (!root.querySelector(selector)) throw new Error(`Full UI evidence missing: ${selector}`);
  }
  if (mapCanvas.width < 100 || mapCanvas.height < 100) throw new Error('Map is not yet rendered');
  return true;
}

/** Capture the LIVE playback value before html2canvas clones the DOM.
 * html2canvas 1.4.1 handles range inputs like text inputs on some platforms:
 * the range's numeric value (e.g. "70") leaks into the exported screenshot.
 * The real interactive control remains untouched; only the export clone is changed.
 */
export function readScrubberSnapshot(root) {
  const input=root?.querySelector('#scrubber');
  if(!input || input.type!=='range')throw new Error('UI evidence requires the live replay range control');
  const min=Number(input.min),max=Number(input.max),value=Number(input.value);
  if(![min,max,value].every(Number.isFinite)||max<=min||value<min||value>max)
    throw new Error('UI evidence replay slider is out of range');
  // The displayed replay clock is independently captured as DOM text. Never
  // synthesize a different timestamp or inject a second time label.
  const displayed=root.querySelector('#elapsed')?.textContent?.trim();
  if(!/^\d{2}:\d{2}$/.test(displayed||''))throw new Error('UI evidence replay clock is unavailable');
  const seconds=Number(displayed.slice(0,2))*60+Number(displayed.slice(3));
  if(Math.abs(seconds-value)>1)throw new Error('UI evidence replay clock and slider disagree');
  const theme=root.ownerDocument?.documentElement?.getAttribute('data-theme');
  return Object.freeze({fraction:(value-min)/(max-min),theme:theme==='daylight'?'daylight':'night'});
}

/** Build a purely decorative, text-free track and thumb for the SCREENSHOT copy.
 * Native inputs must never be rasterized here: they can expose "70" or other
 * phantom text. All geometry comes from the real range value, not a fixture.
 */
export function replaceClonedScrubber(clonedDoc,liveSnapshot) {
  if(!liveSnapshot || !Number.isFinite(liveSnapshot.fraction) ||
      liveSnapshot.fraction<0 || liveSnapshot.fraction>1)
    throw new Error('UI evidence lacks a valid frozen scrubber position');
  const input=clonedDoc.getElementById('scrubber');
  if(!input || input.type!=='range')throw new Error('UI capture clone lacks replay slider');
  const mk=()=>clonedDoc.createElement('div');
  const staticControl=mk();
  staticControl.className='batsim-export-static-scrubber';
  staticControl.setAttribute('aria-hidden','true');
  staticControl.style.cssText='display:block;position:relative;width:100%;height:18px;margin:2px 0;pointer-events:none;';
  const rail=mk();
  const light=liveSnapshot.theme==='daylight';
  rail.style.cssText=`position:absolute;left:7px;right:7px;top:7px;height:4px;background:${light?'#c4cdd3':'#526673'};border-radius:6px;`;
  const filled=mk();
  const pct=(liveSnapshot.fraction*100).toFixed(4);
  const accent=light?'#087e98':'#62d6db';
  filled.style.cssText=`position:absolute;left:0;top:0;height:100%;width:${pct}%;background:${accent};border-radius:6px;`;
  const thumb=mk();
  thumb.style.cssText=`position:absolute;left:${pct}%;top:50%;width:14px;height:14px;transform:translate(-50%,-50%);background:${accent};border-radius:50%;border:0;`;
  rail.appendChild(filled);rail.appendChild(thumb);staticControl.appendChild(rail);
  input.replaceWith(staticControl);
  return staticControl;
}

export function prepareUiClone(clonedDoc, mapDataUrl, scrubberSnapshot) {
  // Only change the cloned DOM: never scroll or hide controls in the live app.
  const clone = clonedDoc.getElementById('app');
  if (!clone) throw new Error('HTML capture clone lacks application root');
  const clonedCanvas = clone.querySelector('.maplibregl-canvas');
  if (!clonedCanvas) throw new Error('HTML capture clone lacks MapLibre canvas');
  const img = clonedDoc.createElement('img');
  img.className = clonedCanvas.className;
  img.alt = 'Exact visible MapLibre canvas pixels at exported replay time';
  img.src = mapDataUrl;
  img.style.cssText = clonedCanvas.style.cssText;
  img.style.width = clonedCanvas.style.width || '100%';
  img.style.height = clonedCanvas.style.height || '100%';
  img.style.objectFit = 'fill';
  img.style.pointerEvents = 'none';
  clonedCanvas.replaceWith(img);
  // Convert the cloned <input type=range> into graphics before html2canvas paints it.
  replaceClonedScrubber(clonedDoc,scrubberSnapshot);
  for (const selector of ['.rail','.inspector']) {
    const panel=clone.querySelector(selector);
    if (panel) panel.scrollTop=0;
  }
  const tooltip=clonedDoc.getElementById('guideTip');
  if (tooltip) tooltip.hidden=true;
  const instructions=clonedDoc.getElementById('guideInstructions');
  if (instructions) instructions.hidden=true;
  const dialog=clonedDoc.getElementById('exportDialog');
  if (dialog) {dialog.removeAttribute('open');dialog.style.display='none';}
  return img;
}

export function contextHighlightTargets(root) {
  // Relative to the app screenshot's origin; no reliance on fake fixture coords.
  const parent=root.getBoundingClientRect();
  return ['#qaDomain','.variant.active','#qaStatus','#findingPanel','#elapsed'].map(selector=>{
    const el=root.querySelector(selector);
    if(!el)return null;
    const r=el.getBoundingClientRect();
    return {selector,x:r.x-parent.x,y:r.y-parent.y,width:r.width,height:r.height};
  }).filter(r=>r&&r.width>0&&r.height>0);
}

export async function renderUiContextPng(root,map,options={}) {
  if (!map || !map.loaded())throw new Error('Map not ready to capture UI context');
  const source=map.getCanvas();
  const viewport=options.viewport||{width:window.innerWidth,height:window.innerHeight};
  uiContextRequirements(root,source,viewport);
  // Reuse the proven GPU readback guard. A black/empty basemap MUST NOT be packaged.
  const scratch=document.createElement('canvas');scratch.width=source.width;scratch.height=source.height;
  const sc=scratch.getContext('2d',{willReadFrequently:true});
  if(!sc)throw new Error('No canvas context for map preflight');
  try{sc.drawImage(source,0,0);}catch(e){throw new Error(`Map evidence readback failed: ${e.message}`);}
  const mapCheck=assessMapPixels(sc,source.width,source.height);
  if(!mapCheck.valid)throw new Error(`Full UI context rejected: ${mapCheck.reason}`);
  const mapDataUrl=scratch.toDataURL('image/png');
  if(!mapDataUrl.startsWith('data:image/png;base64,'))throw new Error('Map readback was not PNG');
  const rasterize=options.rasterize || (await import('html2canvas')).default;
  if(typeof rasterize!=='function')throw new Error('DOM capture engine unavailable');
  const bounds=root.getBoundingClientRect();
  const width=Math.round(bounds.width),height=Math.round(bounds.height);
  if(width<1050||height<660)throw new Error('Full UI context would crop the dashboard. Maximize your window and retry.');
  const highlights=contextHighlightTargets(root);
  const scrubberSnapshot=readScrubberSnapshot(root);
  const pixelScale=Math.min(2,Math.max(1,window.devicePixelRatio||1));
  const result=await rasterize(root,{
    backgroundColor: getComputedStyle(root).backgroundColor || '#ffffff',
    scale:pixelScale,
    width,height,
    scrollX:0,scrollY:0,
    useCORS:true,allowTaint:false,logging:false,
    onclone:(doc)=>prepareUiClone(doc,mapDataUrl,scrubberSnapshot)
  });
  if(!result||result.width<width||result.height<height)throw new Error('Full UI screenshot returned incorrect image dimensions');
  const canvas=document.createElement('canvas');
  const labelHeight=Math.round(28*pixelScale);
  canvas.width=result.width;canvas.height=result.height+labelHeight;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('UI context image composition unavailable');
  ctx.drawImage(result,0,0);
  // Minimal, purposeful QA annotation; do not conceal controls or fabricate content.
  ctx.save();ctx.lineWidth=2*pixelScale;ctx.strokeStyle='#e66b28';
  for(const r of highlights){
    if(r.selector==='#qaDomain'||r.selector==='.variant.active'||r.selector==='#findingPanel'||r.selector==='#elapsed')
      ctx.strokeRect((r.x-2)*pixelScale,(r.y-2)*pixelScale,(r.width+4)*pixelScale,(r.height+4)*pixelScale);
  }
  ctx.restore();
  ctx.fillStyle='#102633';ctx.fillRect(0,result.height,canvas.width,labelHeight);
  ctx.fillStyle='#ffffff';ctx.font=`${11*pixelScale}px sans-serif`;
  ctx.fillText('SIMULATION QA LAB · UI CONTEXT EVIDENCE · reconstructed from current dashboard DOM + original MapLibre canvas; panels scrolled to top in export copy only',10*pixelScale,result.height+18*pixelScale);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('UI context PNG encoder failed')),'image/png'));
  const png=new Uint8Array(await blob.arrayBuffer());
  if(!isPng(png))throw new Error('UI context result is not a valid PNG');
  return png;
}
