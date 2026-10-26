/** Presentation-only layout controls; never modify telemetry or QA findings. */
export function railWidthRange(shellWidth, inspectorWidth, mainMin=360) {
  if (![shellWidth,inspectorWidth,mainMin].every(Number.isFinite)) throw Error('Finite layout dimensions required');
  const min=210;
  const max=Math.max(min,Math.min(430,Math.floor(shellWidth-inspectorWidth-mainMin-12)));
  return {min,max};
}
export function clampRailWidth(requested, shellWidth, inspectorWidth) {
  const {min,max}=railWidthRange(shellWidth,inspectorWidth);
  return Math.min(max,Math.max(min,Math.round(requested)));
}
export function attributionClearance(height) {
  // Padding between real MapLibre attribution and the coordinate HUD.
  return Math.max(34, Math.ceil(Math.max(0,Number.isFinite(height)?height:0))+12);
}
export function initLayout({doc=document,win=window,resizeMap=()=>{}}={}) {
  const shell=doc.getElementById('appShell'), grip=doc.getElementById('railResize');
  const inspector=shell?.querySelector('.inspector');
  const pane=shell?.querySelector('.map-pane');
  if(!shell || !grip || !inspector || !pane)throw Error('Layout controls missing');
  let width=Number.parseInt(win.getComputedStyle(shell).getPropertyValue('--rail-width'),10)||334;
  const available=()=>railWidthRange(shell.getBoundingClientRect().width,inspector.getBoundingClientRect().width);
  let pendingMapResize=false;
  function notifyMapResize(){
    // Batch rapid pointer movements to at most one costly WebGL resize per frame.
    if(pendingMapResize)return;
    if(typeof win.requestAnimationFrame==='function'){
      pendingMapResize=true;
      win.requestAnimationFrame(()=>{pendingMapResize=false;resizeMap();});
    }else resizeMap();
  }
  function apply(requested) {
    const rect=shell.getBoundingClientRect();
    width=clampRailWidth(requested,rect.width,inspector.getBoundingClientRect().width);
    shell.style.setProperty('--rail-width',`${width}px`);
    const range=available();
    grip.setAttribute('aria-valuemin',String(range.min));
    grip.setAttribute('aria-valuemax',String(range.max));
    grip.setAttribute('aria-valuenow',String(width));
    grip.setAttribute('aria-valuetext',`Mission control width ${width} pixels`);
    // MapLibre must recompute canvas/projected marker placement when its container changes.
    notifyMapResize();
  }
  function desktop(){return !win.matchMedia('(max-width: 900px)').matches;}
  let dragging=false;
  grip.addEventListener('pointerdown',e=>{
    if(!desktop() || (e.pointerType==='mouse' && e.button!==0))return;
    dragging=true;
    if(doc.documentElement?.dataset)doc.documentElement.dataset.railResizing='true';
    grip.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });
  grip.addEventListener('pointermove',e=>{
    if(!dragging || !desktop())return;
    apply(e.clientX-shell.getBoundingClientRect().left);
  });
  const stop=()=>{dragging=false;if(doc.documentElement?.dataset)doc.documentElement.dataset.railResizing='false';};
  grip.addEventListener('pointerup',stop);
  grip.addEventListener('pointercancel',stop);
  grip.addEventListener('lostpointercapture',stop);
  grip.addEventListener('dblclick',()=>{if(desktop())apply(win.innerWidth<=1180?258:334);});
  grip.addEventListener('keydown',e=>{
    if(!desktop())return;
    const {min,max}=available();
    const next=({ArrowLeft:width-18,ArrowRight:width+18,Home:min,End:max})[e.key];
    if(next!==undefined){e.preventDefault();apply(next);}
  });
  // Do not store browser state: each demo starts at an understandable width.
  win.addEventListener('resize',()=>{if(desktop())apply(width);else notifyMapResize();});
  if(desktop())apply(width);

  let observedCorner=null;
  let ro=null;
  const Resize=win.ResizeObserver;
  const Mutation=win.MutationObserver;
  function measureAttribution(){
    const corner=pane.querySelector('.maplibregl-ctrl-bottom-right');
    if(corner!==observedCorner){
      ro?.disconnect();observedCorner=corner;
      if(corner && Resize){ro=new Resize(()=>measureAttribution());ro.observe(corner);}
    }
    const height=corner?.getBoundingClientRect().height??0;
    pane.style.setProperty('--map-attribution-clearance',`${attributionClearance(height)}px`);
  }
  // MapLibre injects controls after map creation and can change their size on expansion.
  const mo=Mutation?new Mutation(()=>measureAttribution()):null;
  mo?.observe(pane.querySelector('#map')||pane,{childList:true,subtree:true});
  measureAttribution();
  return {resizeTo:apply,measureAttribution,dispose(){mo?.disconnect();ro?.disconnect();}};
}
