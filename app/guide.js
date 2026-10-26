/** Default-on, user-dismissible explanation layer for a fictional simulation QA demo. */
export const GUIDE_TOPICS = Object.freeze([
  {selector:'.mission-select',title:'Active fictional exercise',description:'Shows the currently selected exercise and its validation purpose. Change TEST DOMAIN to switch between movement, checkpoint and event-order validation.'},
  {selector:'#qaDomain',title:'QA test domain',description:'Choose Movement QA (position validity), Checkpoint QA (required trigger) or Event ordering QA (complete-before-start). All use deterministic fictional source data.'},
  {selector:'#btnClean',title:'Reference run — PASS',description:'Load the untouched baseline fixture. Every rule should pass with no findings. Use this to compare expected behavior.'},
  {selector:'#btnFault',title:'Injected fault — FAIL',description:'Load the intentionally corrupted synthetic fixture for the selected QA domain: a raw position jump, missing checkpoint event or reversed event order. Not a defect in external software.'},
  {selector:'#mapModeToggle',title:'Online geography / offline schematic',description:'Switch the background map only. Both modes show exactly the same fictional WGS84 telemetry and unit positions. The offline illustration has invented roads, river and buildings; use it if online tiles are unavailable.'},
  {selector:'[data-guide="layerTrails"]',title:'Actual trajectories',description:'Show movements recorded in the active fixture. A failed segment is not silently smoothed or interpolated.'},
  {selector:'[data-guide="layerReference"]',title:'Reference trajectories',description:'Show the known-good baseline as an amber dashed line with a light/dark outline, offset 6 SCREEN pixels beside recorded paths for readability. This is visual only: raw positions, QA results and export evidence remain unchanged. Turn Actual trajectories off to inspect the baseline alone.'},
  {selector:'[data-guide="layerCheckpoints"]',title:'Checkpoints',description:'Toggle fictional exercise checkpoint markers. They are not verified real-world military infrastructure.'},
  {selector:'[data-guide="layerFaults"]',title:'QA findings on the map',description:'Show invalid transition segments and the event marker. Select the finding to inspect the original samples.'},
  {selector:'[data-guide="layerSeparation"]',title:'Air-line distance',description:'Draw a dashed measurement between the two fictional vehicles. Changes with replay time, not real time. Distances are display-derived and are never substituted for original QA telemetry.'},
  {selector:'[data-guide="separationValue"]',title:'Current horizontal separation',description:'Great-circle distance in meters or kilometers from the two replay display positions. A position can be held when QA detects an invalid edge; this value is not a validation threshold.'},
  {selector:'#mapHealth',title:'Map and map status',description:'Online geographic labels are a contextual backdrop. Offline schematic means locally rendered, invented cartography around the SAME fictional WGS84 positions. Blue and red are exercise sides, not actual countries.'},
  {selector:'.map-bottom-left',title:'Map legend',description:'Solid lines show recorded movement. Amber dashed reference lines have a 6px display-only offset, not a position change. Red dashed segments are QA-invalid moves; purple dashed line is inter-entity distance.'},
  {selector:'#themeToggle',title:'Day / night view',description:'Changes map and interface appearance only. It never changes source telemetry or PASS/FAIL results.'},
  {selector:'#restart',title:'Restart replay',description:'Return the replay to the beginning and pause playback.'},
  {selector:'#togglePlay',title:'Play / pause',description:'Animate display positions along the synthetic telemetry samples without altering their raw values.'},
  {selector:'#step',title:'Single-step replay',description:'Move forward by one simulation second for precise fault investigation.'},
  {selector:'#scrubber',title:'Time scrubber',description:'Navigate to a specific simulation second; T+01:05 marks the injected position jump.'},
  {selector:'#speed',title:'Playback speed',description:'Cycle replay speed between 1×, 2× and 4×. Does not change simulation timestamps.'},
  {selector:'#qaStatus',title:'QA status',description:'PASS / FAIL comes from validated source telemetry, not from how smooth the map animation looks.'},
  {selector:'#sampleCount',title:'Event samples',description:'Number of original per-entity samples examined by the Python QA validator.'},
  {selector:'#violationCount',title:'Findings count',description:'Number of QA rules violated in the selected scenario.'},
  {selector:'#findingPanel',title:'Detected finding',description:'A reproducible, rule-based failure with exact entity, time, measured speed, threshold and underlying raw values.'},
  {selector:'#entityA',title:'ECHO-ALPHA / training BLUE',description:'Fictional R-4X4 reconnaissance vehicle; not an identification of a real armed force.'},
  {selector:'#entityB',title:'ECHO-BRAVO / training RED',description:'Fictional AT-6X6 armoured transport; intentionally faulty telemetry in RUN 02.'},
  {selector:'#entityDetails',title:'Raw vs interpolated',description:'RAW SAMPLE is the original source record. INTERPOLATED is a display-only position between valid samples. HELD means the renderer refuses to smooth a failed transition.'},
  {selector:'#exportBtn',title:'Evidence and issue tracker handoff',description:'Open format-specific exports and a copy/paste-ready bug ticket. The ZIP contains the original data and a marked map capture.'},
  {selector:'#issueSummaryText',title:'Issue title',description:'Concise, actionable issue summary with component, scenario, entity, time and measured rule violation.'},
  {selector:'#issueDescriptionText',title:'Issue description',description:'Copy expected/actual, reproduction, environment, provenance and regression criteria into your issue tracker.'},
  {selector:'#downloadIssueBundle',title:'Evidence ZIP',description:'Save timestamped TXT, XLSX, JSON and map PNG attachments. Export is rejected if the map pixels are blank.'},
  {selector:'#exportSave',title:'Single-file export',description:'Save original QA results as XLSX, CSV, Markdown or JSON to a location selected by your browser.'},
  {selector:'.maplibregl-ctrl-zoom-in',title:'Zoom in',description:'Increase map detail. Zoom affects map presentation only, never source coordinates.'},
  {selector:'.maplibregl-ctrl-zoom-out',title:'Zoom out',description:'See more geographic context around the fictional exercise.'},
  {selector:'#copyIssueTitle',title:'Copy issue summary',description:'Copy the issue title to your clipboard for pasting into the tracker Summary field.'},
  {selector:'#copyIssueDescription',title:'Copy issue description',description:'Copy reproduction, expected/actual behavior, raw evidence and regression criteria.'},
  {selector:'#exportClose',title:'Close evidence dialog',description:'Dismiss export without modifying the QA run or source data.'},
  {selector:'#exportCancel',title:'Cancel export',description:'Close the dialog; saving and cancelling do not mutate original telemetry.'},
  {selector:'#inspectFault',title:'Jump to finding',description:'Pause replay at the exact finding time and select the affected entity without changing source telemetry or event logs.'}
]);

export function guideTopicFor(target,root=document) {
  if(!target || typeof target.closest!=='function')return null;
  for(const topic of GUIDE_TOPICS) {
    const el=target.closest(topic.selector);
    if(el && (typeof root.contains!=='function'||root.contains(el))) return {...topic,element:el};
  }
  return null;
}

export function initGuide({document:doc=document,window:win=window}={}) {
  const toggle=doc.getElementById('guideToggle');
  const panel=doc.getElementById('guideTip');
  const title=doc.getElementById('guideTipTitle');
  const body=doc.getElementById('guideTipText');
  const close=doc.getElementById('guideClose');
  const instructions=doc.getElementById('guideInstructions');
  if(![toggle,panel,title,body,close,instructions].every(Boolean))throw Error('Guide Mode controls missing');
  let enabled=false,highlighted=null;
  // While guided help is enabled, prevent native browser `title` tooltips from
  // appearing alongside the single accessible BatSim help bubble.
  // Preserve the exact original titles, restoring them when help is disabled.
  const savedTitles=new Map();
  let titleObserver=null;
  function suppressNativeTitles(){
    for(const element of doc.querySelectorAll?.('[title]') ?? []) {
      const value=element.getAttribute?.('title');
      if(value===null || value===undefined)continue;
      if(!savedTitles.has(element))savedTitles.set(element,value);
      element.removeAttribute('title');
    }
  }
  function restoreNativeTitles(){
    for(const [element,value] of savedTitles){
      // Do not overwrite a title set by other UI logic while Guide Mode ran.
      if(element.getAttribute?.('title')===null)element.setAttribute('title',value);
    }
    savedTitles.clear();
  }
  function startTitleSuppression(){
    suppressNativeTitles();
    const Observer=win.MutationObserver;
    if(Observer && !titleObserver && doc.documentElement){
      titleObserver=new Observer(()=>{if(enabled)suppressNativeTitles();});
      titleObserver.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['title']});
    }
  }
  function stopTitleSuppression(){
    titleObserver?.disconnect();titleObserver=null;
    restoreNativeTitles();
  }
  function dismiss(){
    if(highlighted?.classList?.remove)highlighted.classList.remove('guide-highlight');
    highlighted=null;panel.hidden=true;
  }
  function setEnabled(next){
    const requested=Boolean(next);
    if(enabled===requested)return;
    enabled=requested;
    toggle.setAttribute('aria-pressed',String(enabled));
    toggle.textContent=enabled?'? Guide Mode: ON':'? Guide Mode';
    // The button itself announces active guidance. Avoid a second floating
    // instruction banner; use the one contextual help bubble exclusively.
    instructions.hidden=true;
    if(enabled)startTitleSuppression();
    else {dismiss();stopTitleSuppression();}
  }
  function show(topic){
    if(!enabled||!topic)return;
    if(highlighted!==topic.element)dismiss();
    highlighted=topic.element;highlighted.classList?.add('guide-highlight');
    title.textContent=topic.title;body.textContent=topic.description;
    panel.hidden=false;
    // Keep popup inside the viewport and away from the highlighted control.
    const rect=topic.element.getBoundingClientRect();
    const width=Math.min(330,Math.max(210,win.innerWidth-24));
    panel.style.width=`${width}px`;
    const right=rect.right+12+width <= win.innerWidth-10;
    const left=right?rect.right+12:Math.max(12,rect.left-width-12);
    const maxY=Math.max(10,win.innerHeight-(panel.offsetHeight||180)-14);
    panel.style.left=`${Math.min(Math.max(12,left),Math.max(12,win.innerWidth-width-12))}px`;
    panel.style.top=`${Math.min(Math.max(12,rect.top),maxY)}px`;
  }
  toggle.addEventListener('click',()=>setEnabled(!enabled));
  close.addEventListener('click',()=>setEnabled(false));
  // Only explicit controls launch guide help. Map pixels are NOT a help target:
  // otherwise the gigantic #map ancestor catches every pointer movement and the
  // last bubble remains stuck in a corner when the user moves across the map.
  function pointerHelp(event){
    if(!enabled)return;
    // Pointer capture during a column drag must never open contextual help,
    // even when elementFromPoint happens to encounter another guided control.
    if(doc.documentElement?.dataset?.railResizing==='true'){dismiss();return;}
    const element=(typeof doc.elementFromPoint==='function' && Number.isFinite(event.clientX) && Number.isFinite(event.clientY))
      ? doc.elementFromPoint(event.clientX,event.clientY) : event.target;
    const topic=guideTopicFor(element,doc);
    if(topic) {if(highlighted!==topic.element || panel.hidden)show(topic);}
    else dismiss();
  }
  doc.addEventListener('pointerover',pointerHelp);
  doc.addEventListener('pointermove',pointerHelp); // reliable even if map captures pointer events
  doc.addEventListener('pointerdown',event=>{if(enabled && !guideTopicFor(event.target,doc))dismiss();});
  doc.addEventListener('pointerleave',()=>{if(enabled)dismiss();});
  doc.addEventListener('focusin',event=>{if(enabled){const t=doc.documentElement?.dataset?.railResizing==='true'?null:guideTopicFor(event.target,doc);if(t)show(t);else dismiss();}});
  doc.addEventListener('focusout',event=>{
    if(enabled&&highlighted&&!highlighted.contains?.(event.relatedTarget))dismiss();
  });
  doc.addEventListener('pointerout',event=>{
    if(!enabled||!highlighted)return;
    if(!event.relatedTarget || !highlighted.contains?.(event.relatedTarget))dismiss();
  });
  doc.addEventListener('keydown',event=>{if(enabled && event.key==='Escape')setEnabled(false);});
  // User-requested default: guidance active from the first rendered frame.
  setEnabled(true);
  return {get enabled(){return enabled;},setEnabled,showFor(target){const t=guideTopicFor(target,doc);if(t)show(t);},dismiss};
}
