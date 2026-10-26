import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import './style.css';
import './daylight.css';
import './guide.css';
import './vp04.css';
import './vp041.css';
import './layout.css';
import {initLayout} from './layout.js';
import {initGuide} from './guide.js';
import {invalidEdgeSet, positionAt as posAt, heading} from './replay.js';
import {replaySeparation} from './separation.js';
import {REFERENCE_LAYER_IDS, referencePaint} from './reference_style.js';
import {saveEvidence} from './evidence_export.js';
import {issueFromRun, saveIssueZip, renderAnnotatedMapPng, withFramedFaultMap} from './issue_report.js';
import {renderUiContextPng} from './ui_context.js';
import {ENTITIES_META, entityIdentity, mapContext} from './vp02_metadata.js';
import {SCENARIOS, optionLabel} from './scenario_catalog.js';

// MapLibre GL JS v6 + Vite: explicit bundled worker per upstream migration guide.
maplibregl.setWorkerUrl(maplibreWorkerUrl);

const $ = (id) => document.getElementById(id);
const ENTITIES = ['ECHO-ALPHA', 'ECHO-BRAVO'];
const CENTER = [17.7305, 49.5715];
const TERRAIN_BOUNDS = [17.658, 49.520, 17.821, 49.629];
const CHECKPOINTS = [[17.716,49.561], [17.732,49.577], [17.720,49.570]];
const INITIAL_TIME = 70;
// Vite base works at localhost root and project-scoped GitHub Pages URLs.
const publicAsset = (path) => `${import.meta.env.BASE_URL}${path}`;
const ONLINE_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const SYNTHETIC_STYLE = {version:8, sources:{}, layers:[{id:'base',type:'background',paint:{'background-color':'#d7e5da'}}]};
let mapMode='geographic', markersInstalled=false;
let dataset = {}, variant = 'fault', domain='movement', now = INITIAL_TIME, playing = false;
const activeKey=()=>domain==='checkpoint' ? `checkpoint_${variant}` : domain==='sequence'?`sequence_${variant}`:variant;
const activeRun=()=>dataset[activeKey()];
const baselineRun=()=>dataset[domain==='checkpoint'?'checkpoint_clean':domain==='sequence'?'sequence_clean':'clean'];
const activeIssueVariant=()=>activeRun()?.variant||variant;
let speed = 1, selectedEntity = 'ECHO-BRAVO', map = null, mapReady = false;
let lastFrame = null;
const markers = new Map();
const checkpoints = [];
let faultMarker = null, vp04CheckpointMarker=null, distanceMarker=null;
let currentSegments = new Set();

function fmtTime(t) { const s = Math.floor(Math.max(0, t)); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
function byEntity(run, id) { return run.events.filter(v => v.entity_id === id); }
function findingFor(run,id) {return run?.qa.findings.filter(x=>x.entity_id===id && x.rule==='POSITION_JUMP') || [];}
function toFeature(type, coordinates, props={}) {return {type:'Feature', properties:props,geometry:{type,coordinates}};}
function collection(features=[]) {return {type:'FeatureCollection',features};}
function createMap() {
  map = new maplibregl.Map({
    container:'map', center:CENTER, zoom:13.1, minZoom:10.8, maxZoom:15.4,
    attributionControl:false, dragRotate:false, pitchWithRotate:false,
    canvasContextAttributes:{preserveDrawingBuffer:true},
    style:ONLINE_STYLE
  });
  map.addControl(new maplibregl.NavigationControl({showCompass:false}), 'top-right');
  map.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:'Simulation QA Lab • fictional units / synthetic telemetry'}),'bottom-right');
  map.on('error',e=> {
    console.error('MapLibre error:',e.error || e);
    if(mapMode==='geographic' && !mapReady){
      mapMode='synthetic'; map.setStyle(SYNTHETIC_STYLE);
      $('mapHealth').textContent='OFFLINE FALLBACK • SYNTHETIC TERRAIN';
      updateMapModeLabel();
    }else if(mapMode==='geographic'){$('mapHealth').textContent='MAP TILE WARNING • CHECK CONNECTION';}
  });
  map.on('style.load',()=> {
    mapReady=false;
    const isSynthetic=mapMode==='synthetic';
    const terrainCorners = [
      [TERRAIN_BOUNDS[0],TERRAIN_BOUNDS[3]],[TERRAIN_BOUNDS[2],TERRAIN_BOUNDS[3]],
      [TERRAIN_BOUNDS[2],TERRAIN_BOUNDS[1]],[TERRAIN_BOUNDS[0],TERRAIN_BOUNDS[1]]
    ];
    if(isSynthetic){
      map.addSource('terrain-night',{type:'image',url:publicAsset('terrain.png'),coordinates:terrainCorners});
      map.addSource('terrain-day',{type:'image',url:publicAsset('terrain-daylight.png'),coordinates:terrainCorners});
      map.addLayer({id:'terrain-night-raster',type:'raster',source:'terrain-night',paint:{'raster-opacity':1},layout:{visibility:'none'}});
      map.addLayer({id:'terrain-day-raster',type:'raster',source:'terrain-day',paint:{'raster-opacity':1}});
    }
    map.addSource('real-lines',{type:'geojson',data:collection()});
    map.addLayer({id:'actual-path',type:'line',source:'real-lines',paint:{'line-color':['case',['==',['get','entity'],'ECHO-ALPHA'],'#85d9bb','#5fe4f0'],'line-width':3.5,'line-opacity':.94}});
    // Baseline is rendered beside actual paths (6 SCREEN pixels, not changed GPS positions).
    // A contrasting dashed casing and the reference trace sit above actual, below incident/distance.
    map.addSource('ref-lines',{type:'geojson',data:collection()});
    const referenceStyle=referencePaint(document.documentElement.dataset.theme !== 'dark');
    map.addLayer({id:'reference-halo',type:'line',source:'ref-lines',layout:{'line-cap':'round','line-join':'round'},paint:referenceStyle.halo});
    map.addLayer({id:'reference-path',type:'line',source:'ref-lines',layout:{'line-cap':'round','line-join':'round'},paint:referenceStyle.path});
    map.addSource('separation-geometry',{type:'geojson',data:collection()});
    map.addLayer({id:'distance-line',type:'line',source:'separation-geometry',paint:{'line-color':'#683da8','line-width':3,'line-opacity':.92,'line-dasharray':[2,2]}});
    map.addSource('bad-lines',{type:'geojson',data:collection()});
    map.addLayer({id:'invalid-edge',type:'line',source:'bad-lines',paint:{'line-color':'#ff996c','line-opacity':.96,'line-width':4,'line-dasharray':[1,1.4]}});
    if(!markersInstalled){
      CHECKPOINTS.forEach((coords,i)=>{
        const el=document.createElement('div');el.className='checkpoint-pin';el.title=`Fictional checkpoint ${i+1}`;
        checkpoints.push(new maplibregl.Marker({element:el,anchor:'center'}).setLngLat(coords).addTo(map));
      });
      ENTITIES.forEach(id=>{
        const meta=entityIdentity(id), el=document.createElement('div');
        el.className=`entity-pin faction-${meta.side.toLowerCase()}`;el.dataset.id=id.replace('ECHO-','');
        el.title=`${meta.callSign} • Training ${meta.side} • ${meta.vehicleType} (fictional)`;
        const ink=meta.side==='BLUE'?'#2d91db':'#d45147';
        const glyph=meta.side==='BLUE'?'<path d="M17 5 L25 17 L17 29 L9 17 Z" fill="'+ink+'" stroke="white" stroke-width="1.5"/>':'<rect x="10" y="10" width="14" height="14" rx="2" fill="'+ink+'" stroke="white" stroke-width="1.5"/>';
        el.innerHTML=`<svg width="38" height="38" viewBox="0 0 34 34" role="img" aria-label="Fictional training ${meta.side} ${meta.vehicleType}"><circle cx="17" cy="17" r="16" fill="#ffffff" stroke="${ink}" stroke-width="2"/><g class="vehicle-direction">${glyph}<path d="M17 6 L21 16 L17 13 L13 16 Z" fill="#112937"/></g></svg>`;
        el.addEventListener('click',()=>selectEntity(id));
        markers.set(id,new maplibregl.Marker({element:el,anchor:'center'}).setLngLat(CENTER).addTo(map));
      });
      const cp=document.createElement('div');cp.className='vp04-checkpoint';
      cp.innerHTML='◆ <span>CP-ALPHA</span>';
      cp.title='Fictional checkpoint · requires CHECKPOINT_ENTER event';
      vp04CheckpointMarker=new maplibregl.Marker({element:cp,anchor:'center'})
        .setLngLat([dataset.checkpoint_clean.checkpoint.lon,dataset.checkpoint_clean.checkpoint.lat]).addTo(map);
      cp.addEventListener('click',()=>{if(domain!=='checkpoint')setDomain('checkpoint');now=58;playing=false;selectEntity('ECHO-ALPHA');});
      const f=document.createElement('div');f.className='fault-pin';f.textContent='!';f.title='Synthetic QA finding • select to inspect original evidence';
      f.addEventListener('click',()=>{const issue=activeRun()?.qa.findings[0];if(!issue)return;selectedEntity=issue.entity_id;now=issue.violation_t ?? issue.expected_t ?? issue.current?.t ?? 65;playing=false;render(true);});
      faultMarker=new maplibregl.Marker({element:f,anchor:'center'}).setLngLat(CENTER).addTo(map);
      const distanceEl=document.createElement('div');distanceEl.className='batsim-distance-pill';distanceEl.textContent='DISTANCE —';
      distanceMarker=new maplibregl.Marker({element:distanceEl,anchor:'bottom',offset:[0,-6]}).setLngLat(CENTER).addTo(map);
      map.on('mousemove',e=>{$('coords').textContent=`${e.lngLat.lat.toFixed(4)}° N / ${e.lngLat.lng.toFixed(4)}° E`;});
      markersInstalled=true;
    }
    mapReady=true;$('mapHealth').textContent=isSynthetic?'SCHEMATIC MAP • OFFLINE':'REAL MAP • ONLINE';
    updateMapModeLabel();$('mapModeToggle').disabled=false;applyTheme();redrawLayers();render(true);
  });
}

function applyTheme() {
  const daylight = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = daylight ? 'daylight' : 'dark';
  $('themeToggle').textContent = daylight ? '☾ Night view' : '☀ Daylight view';
  $('themeToggle').setAttribute('aria-pressed', String(!daylight));
  // Data and QA verdict are immutable. Only presentation colors and basemap change.
  if (!mapReady) return;
  if(mapMode==='synthetic'){
    map.setLayoutProperty('terrain-day-raster', 'visibility', daylight ? 'visible' : 'none');
    map.setLayoutProperty('terrain-night-raster', 'visibility', daylight ? 'none' : 'visible');
    map.setPaintProperty('base', 'background-color', daylight ? '#d7e5da' : '#101e29');
  }
  // The same thematic contract is re-applied after map-style reloads and theme changes.
  const referenceStyle=referencePaint(daylight);
  map.setPaintProperty('reference-halo', 'line-color', referenceStyle.halo['line-color']);
  map.setPaintProperty('reference-path', 'line-color', referenceStyle.path['line-color']);
  map.setPaintProperty('actual-path', 'line-color', daylight
    ? ['case', ['==', ['get', 'entity'], 'ECHO-ALPHA'], '#087858', '#057bb0']
    : ['case', ['==', ['get', 'entity'], 'ECHO-ALPHA'], '#85d9bb', '#5fe4f0']);
  map.setPaintProperty('invalid-edge', 'line-color', daylight ? '#d4472a' : '#ff996c');
}

function updateMapModeLabel() {
  const geographic=mapMode==='geographic';
  $('mapModeToggle').textContent=geographic?'◈ Offline schematic map':'▣ Geographic map (online)';
  $('mapModeToggle').setAttribute('aria-label', geographic?'Currently online geographic map; switch to offline schematic':'Currently offline schematic; switch to online geographic map');
  $('sceneLocation').textContent=mapContext(mapMode);
  $('environmentNote').textContent=geographic
    ? 'Real place labels and roads near Hranice, Czechia; ALL tracked units, checkpoints, movement records and events are fictional. Map tiles load online.'
    : 'Offline schematic is an illustrative invented map, NOT accurate geography. The same fictional WGS84 coordinates and all QA data remain unchanged.';
  $('mapModeHint').textContent=geographic
    ? 'OpenFreeMap / OpenStreetMap labels online. Unit locations and events are fictional.'
    : 'Illustrated offline background only. SAME unit coordinates; roads, river and buildings invented.';
}
function toggleMapMode(){
  if(!map || !mapReady)return;
  mapMode=mapMode==='geographic'?'synthetic':'geographic';
  mapReady=false;
  $('mapHealth').textContent='SWITCHING MAP STYLE…';
  $('mapModeToggle').disabled=true;
  updateMapModeLabel();
  map.setStyle(mapMode==='geographic'?ONLINE_STYLE:SYNTHETIC_STYLE);
}
function redrawLayers() {
  if (!mapReady || !activeRun()) return;
  const run=activeRun(), reference=baselineRun();
  const expected=ENTITIES.map(id=>toFeature('LineString',byEntity(reference,id).map(x=>[x.lon,x.lat]),{entity:id}));
  const real=[],bad=[];
  for (const id of ENTITIES) {
    const samples=byEntity(run,id), invalid=invalidEdgeSet(run,id);
    let line=[];
    for (let i=0;i<samples.length;i++) {
      const s=samples[i];
      if (i>0 && invalid.has(s.t)) {
        if(line.length>1)real.push(toFeature('LineString',line,{entity:id}));
        bad.push(toFeature('LineString',[[samples[i-1].lon,samples[i-1].lat],[s.lon,s.lat]],{entity:id}));
        line=[];
      }
      line.push([s.lon,s.lat]);
    }
    if (line.length>1) real.push(toFeature('LineString',line,{entity:id}));
  }
  map.getSource('ref-lines').setData(collection(expected));
  map.getSource('real-lines').setData(collection(real));
  map.getSource('bad-lines').setData(collection(bad));
  toggleLayers();
}
function toggleLayers() {
  if (!mapReady)return;
  const referenceVisibility=$('layerReference').checked?'visible':'none';
  for(const id of REFERENCE_LAYER_IDS) map.setLayoutProperty(id,'visibility',referenceVisibility);
  [['actual-path','layerTrails'],['invalid-edge','layerFaults']].forEach(([layer,toggle])=>map.setLayoutProperty(layer,'visibility',$(toggle).checked?'visible':'none'));
  checkpoints.forEach(m=>m.getElement().style.display=$('layerCheckpoints').checked?'':'none');
  if(vp04CheckpointMarker){const el=vp04CheckpointMarker.getElement();el.style.display=domain==='checkpoint'&&$('layerCheckpoints').checked?'':'none';el.classList.toggle('missing-event',variant==='fault');}
  const distanceVisible=$('layerSeparation').checked;
  map.setLayoutProperty('distance-line','visibility',distanceVisible?'visible':'none');
  if(distanceMarker)distanceMarker.getElement().style.display=distanceVisible?'':'none';
  const f=activeRun()?.qa.findings.find(f=>['POSITION_JUMP','CHECKPOINT_EVENT_MISSING','EVENT_ORDER_VIOLATION'].includes(f.rule));
  if(f)faultMarker.setLngLat([f.current.lon,f.current.lat]);
  faultMarker.getElement().style.display=(f&&$('layerFaults').checked)?'':'none';
}
function selectEntity(id) {
  selectedEntity=id;render(true);
  if(mapReady) {
    const p=posAt(byEntity(activeRun(),id),now,invalidEdgeSet(activeRun(),id));
    if(p)map.easeTo({center:[p.lon,p.lat],duration:550});
  }
}
function render(changed=false) {
  if(!activeRun())return;
  const run=activeRun(), result=run.qa;
  const f=result.findings.find(v=>['POSITION_JUMP','CHECKPOINT_EVENT_MISSING','EVENT_ORDER_VIOLATION'].includes(v.rule));
  $('elapsed').textContent=fmtTime(now);$('clock').textContent='T+ '+fmtTime(now);
  $('scrubber').value=String(now);
  $('scrubber').style.setProperty('--progress',`${now/120*100}%`);
  $('togglePlay').textContent=playing?'Ⅱ':'▶';
  $('qaStatus').textContent=result.status;
  $('qaStatus').className=result.status==='PASS'?'good':'bad';
  $('sampleCount').textContent=result.checked.toLocaleString('en-US');
  $('violationCount').textContent=String(result.findings.length).padStart(2,'0');
  $('findingTag').textContent=variant==='fault'?'RUN 02':'RUN 01';
  $('timelineScenario').textContent=run.scenario_id;
  $('brandExercise').textContent=`EXERCISE ${run.scenario_id}`;
  $('missionScenario').textContent=run.scenario_id;
  $('missionSubtitle').textContent=SCENARIOS[domain].subtitle;
  $('ruleLimit').innerHTML=domain==='checkpoint'?'CHECKPOINT <small>trigger</small>':domain==='sequence'?'EVENTS <small>order</small>':'90 <small>km/h</small>';
  $('faultHint').innerHTML=domain==='checkpoint'?'EXPECTED EVENT <b>T+ 00:58</b>':domain==='sequence'?'EARLY COMPLETION <b>T+ 00:35</b>':'FAULT INJECTION <b>T+ 01:05</b>';
  $('faultSubtitle').textContent=domain==='checkpoint'?'Missing checkpoint event':domain==='sequence'?'Completed before started':'Position discontinuity';
  $('btnClean').classList.toggle('active',variant==='clean');$('btnFault').classList.toggle('active',variant==='fault');
  for(const id of ENTITIES){$(id==='ECHO-ALPHA'?'entityA':'entityB').classList.toggle('selected',selectedEntity===id);}
  if(changed){
    if(f){
      $('findingPanel').className='finding-panel';
      if(f.rule==='EVENT_ORDER_VIOLATION'){
        $('findingPanel').innerHTML=`<div class="finding-label">■ QA-EV01 / EVENT_ORDER_VIOLATION</div><div class="finding-title">Objective completed before it started</div><div class="finding-desc">ECHO-ALPHA completion logged at T+00:35 before start at T+00:45. Independent source event log, not a map interpolation issue.</div><div class="finding-meta">START &nbsp; T+ 00:45<br/>COMPLETE &nbsp; T+ 00:35<br/>SOURCE &nbsp; SYNTHETIC_EVENT_LOG</div><div class="finding-actions"><button type="button" class="small-action" id="inspectFault">▶ INSPECT EVENT @ 00:35</button></div>`;
        $('inspectFault').addEventListener('click',()=>{now=f.violation_t;playing=false;selectEntity(f.entity_id);});
      } else if(f.rule==='CHECKPOINT_EVENT_MISSING'){
        $('findingPanel').innerHTML=`<div class="finding-label">■ QA-CP01 / CHECKPOINT_EVENT_MISSING</div><div class="finding-title">Checkpoint entry event not recorded</div><div class="finding-desc">ECHO-ALPHA entered ${f.checkpoint_id} at T+${fmtTime(f.expected_t)}, but the source event log contains no CHECKPOINT_ENTER event.</div><div class="finding-meta">EXPECTED EVENT &nbsp; CHECKPOINT_ENTER<br/>CHECKPOINT &nbsp; ${f.checkpoint_id}<br/>OBSERVED EVENTS &nbsp; 0</div><div class="finding-actions"><button type="button" class="small-action" id="inspectFault">▶ INSPECT ENTRY @ ${fmtTime(f.expected_t)}</button></div>`;
        $('inspectFault').addEventListener('click',()=>{now=f.expected_t;playing=false;selectEntity(f.entity_id);});
      }else{
        $('findingPanel').innerHTML=`<div class="finding-label">■ QA-001 &nbsp; / &nbsp; POSITION_JUMP</div><div class="finding-title">Position discontinuity detected</div><div class="finding-desc">ECHO-BRAVO moves beyond the scenario movement rule between T+ ${fmtTime(f.previous.t)} and T+ ${fmtTime(f.current.t)}. Segment is deliberately not interpolated.</div><div class="finding-meta">DETECTED SPEED &nbsp; ${f.speed_kmh.toFixed(1)} km/h<br/>SCENARIO LIMIT &nbsp; ${result.rule_max_speed_kmh} km/h<br/>SOURCE &nbsp; SYNTHETIC_REPLAY</div><div class="finding-actions"><button type="button" class="small-action" id="inspectFault">▶ INSPECT EVENT @ 01:05</button></div>`;
        $('inspectFault').addEventListener('click',()=>{now=65;playing=false;selectEntity('ECHO-BRAVO');});
      }
    } else {
      $('findingPanel').className='finding-panel good';
      $('findingPanel').innerHTML=`<div class="finding-label">✓ QA / NO FINDINGS</div><div class="finding-title">Reference run validated</div><div class="finding-desc">All 242 source samples passed validation. Scenario-required events met their relevant contract.</div><div class="finding-meta">STATUS &nbsp; PASS<br/>SCENARIO &nbsp; ${run.scenario_id}</div>`;
    }
  }
  const s=byEntity(run,selectedEntity), invalid=invalidEdgeSet(run,selectedEntity), p=posAt(s,now,invalid);
  const raw=s[Math.min(120,Math.floor(now))];
  const sourceDesc=p?.heldForInvalidEdge?'HELD • INVALID EDGE':p?.interpolated?'INTERPOLATED FOR DISPLAY':'RAW SAMPLE';
  const identity=entityIdentity(selectedEntity);
  const sep=replaySeparation(run,now);
  $('separationValue').textContent=sep?sep.text:'—';
  $('separationMode').textContent=sep?.held?'HELD • invalid telemetry edge':sep?.interpolated?'Interpolated for visual replay':'Exact timestamp samples';
  $('entityDetails').innerHTML=`<div class="vp02-identity faction-${identity.side.toLowerCase()}"><b>${identity.callSign}</b><span>TRAINING ${identity.side} · ${identity.vehicleType}</span><small>${identity.role} / fictional model ${identity.model}</small></div><div class="detail-row"><span>ENTITY ID</span><span>${selectedEntity}</span></div><div class="detail-row"><span>DISPLAY MODE</span><span>${sourceDesc}</span></div><div class="detail-row"><span>DISPLAY LAT</span><span>${p?.lat.toFixed(6)}°</span></div><div class="detail-row"><span>DISPLAY LON</span><span>${p?.lon.toFixed(6)}°</span></div><div class="detail-row"><span>RAW SAMPLE T</span><span>${fmtTime(raw.t)}</span></div><div class="detail-row"><span>RAW LAT</span><span>${raw.lat.toFixed(6)}°</span></div><div class="detail-row"><span>RAW LON</span><span>${raw.lon.toFixed(6)}°</span></div>`;
  if(mapReady){
    if(sep){
      map.getSource('separation-geometry').setData(collection([toFeature('LineString',[[sep.a.lon,sep.a.lat],[sep.b.lon,sep.b.lat]],{kind:'display-only'})]));
      if(distanceMarker){distanceMarker.setLngLat([(sep.a.lon+sep.b.lon)/2,(sep.a.lat+sep.b.lat)/2]);distanceMarker.getElement().textContent=`↔ ${sep.text}`;}
    }else{map.getSource('separation-geometry').setData(collection());}
    const show=$('layerSeparation').checked;
    if(distanceMarker)distanceMarker.getElement().style.display=show&&sep?'':'none';
    ENTITIES.forEach(id=>{
      const samples=byEntity(run,id),bad=invalidEdgeSet(run,id),pos=posAt(samples,now,bad),marker=markers.get(id);
      if(!pos)return;
      marker.setLngLat([pos.lon,pos.lat]);
      marker.getElement().classList.toggle('selected',id===selectedEntity);
      marker.getElement().querySelector('.vehicle-direction').setAttribute('transform',`rotate(${heading(samples,now,bad)},17,17)`);
    });
  }
}
function bindExportDialog() {
  const dialog=$('exportDialog'), save=$('exportSave'), status=$('exportStatus');
  const titleText=$('issueSummaryText'), descText=$('issueDescriptionText');
  const titleCopy=$('copyIssueTitle'), bodyCopy=$('copyIssueDescription'), bundle=$('downloadIssueBundle');
  $('exportBtn').onclick=()=>{
    // Freeze the visible replay at one timestamp for BOTH evidence images.
    playing=false;render();
    status.textContent='';save.disabled=false;
    try {
      const issue=issueFromRun(activeRun(),activeIssueVariant(),{userAgent:navigator.userAgent,host:location.host});
      titleText.value=issue.summary;descText.value=issue.body;
      titleCopy.disabled=false;bodyCopy.disabled=false;bundle.disabled=false;
    } catch(err) {
      titleText.value='No failing QA finding in reference run';
      descText.value='Select Injected fault to prepare a reproducible issue.';
      titleCopy.disabled=true;bodyCopy.disabled=true;bundle.disabled=true;
    }
    dialog.showModal();
  };
  async function copyField(field){
    try {
      if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(field.value);status.textContent='Copied to clipboard — paste into the corresponding issue tracker field.';return;}
      throw new Error('Clipboard API unavailable');
    }catch(e){
      field.focus();field.select();
      // User can press Ctrl+C if browser clipboard permissions are denied.
      status.textContent='Clipboard permission unavailable. Text selected: press Ctrl+C to copy.';
    }
  }
  titleCopy.onclick=()=>copyField(titleText);
  bodyCopy.onclick=()=>copyField(descText);
  bundle.onclick=async()=>{
    bundle.disabled=true;status.textContent='';
    try {
      const viewTime=now;
      const result=await saveIssueZip(activeRun(),activeIssueVariant(),
        async issue=>withFramedFaultMap(map,issue,async()=>({
          mapPng:await renderAnnotatedMapPng(map,issue,viewTime,{mapMode}),
          uiPng:await renderUiContextPng($('app'),map)
        })),
        {userAgent:navigator.userAgent,host:location.host});
      status.textContent=result.method==='picker'
        ? `Evidence package saved: ${result.filename}`
        : `Bundle download requested: ${result.filename}. Check browser downloads.`;
    }catch(err){
      status.textContent=err?.name==='AbortError'?'Save cancelled. No file written.':`Package failed: ${err?.message||'Unknown error'}`;
      if(err?.name!=='AbortError')console.error('Issue export failed',err);
    }finally{bundle.disabled=activeRun()?.qa.status!=='FAIL';}
  };
  $('exportCancel').onclick=()=>dialog.close();
  $('exportClose').onclick=()=>dialog.close();
  save.onclick=async()=>{
    const chosen=dialog.querySelector('input[name="exportFormat"]:checked').value;
    save.disabled=true;status.textContent='';
    try {
      const result=await saveEvidence(activeRun(),activeIssueVariant(),chosen);
      status.textContent=result.method==='picker'
        ? `Saved ${result.filename} in the selected location.`
        : `Download requested: ${result.filename}. Check browser downloads or enable “Ask where to save each file” in Chrome settings.`;
      if(result.method==='picker') dialog.close();
    } catch (err) {
      if(err?.name==='AbortError') status.textContent='Save cancelled. No file was written.';
      else {console.error('Export failed:',err);status.textContent=`Export failed: ${err?.message||'Unknown error'}`;}
    } finally {save.disabled=false;}
  };
}
function bindControls(){
  const domainSelect=$('qaDomain');
  domainSelect.replaceChildren(...Object.entries(SCENARIOS).map(([key])=>{
    const option=document.createElement('option'); option.value=key; option.textContent=optionLabel(key);return option;
  }));
  domainSelect.value=domain;
  $('mapModeToggle').disabled=true;
  $('mapModeToggle').onclick=toggleMapMode;
  $('themeToggle').onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'daylight':'dark';applyTheme();};
  applyTheme();
  $('btnClean').onclick=()=>setVariant('clean');
  $('btnFault').onclick=()=>setVariant('fault');
  $('qaDomain').onchange=e=>setDomain(e.target.value);
  $('togglePlay').onclick=()=>{if(now>=120)now=0;playing=!playing;render();};
  $('restart').onclick=()=>{now=0;playing=false;render(true);};
  $('step').onclick=()=>{now=Math.min(120,Math.floor(now)+1);playing=false;render();};
  $('scrubber').oninput=e=>{now=Number(e.target.value);playing=false;render();};
  $('speed').onclick=()=>{speed=speed===1?2:speed===2?4:1;$('speed').textContent=speed+'×';};
  ['layerTrails','layerReference','layerCheckpoints','layerFaults','layerSeparation'].forEach(id=>$(id).onchange=toggleLayers);
  $('entityA').onclick=()=>selectEntity('ECHO-ALPHA');
  $('entityB').onclick=()=>selectEntity('ECHO-BRAVO');
  bindExportDialog();
  initGuide();
  window.addEventListener('keydown',e=>{if($('exportDialog').open || ['INPUT','BUTTON','TEXTAREA','SELECT'].includes(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();playing=!playing;render();}});
}
function setVariant(next){variant=next;playing=false;now=next==='fault'?(domain==='checkpoint'?58:domain==='sequence'?35:INITIAL_TIME):0;selectedEntity=domain!=='movement'?'ECHO-ALPHA':'ECHO-BRAVO';redrawLayers();render(true);}
function setDomain(next){if(!Object.hasOwn(SCENARIOS,next))return;domain=next;$('qaDomain').value=next;variant='fault';playing=false;now=domain==='checkpoint'?58:domain==='sequence'?35:INITIAL_TIME;selectedEntity=domain!=='movement'?'ECHO-ALPHA':'ECHO-BRAVO';redrawLayers();render(true);}
function animation(frame){
  if(lastFrame!==null&&playing){now=Math.min(120,now+(frame-lastFrame)/1000*speed);if(now>=120)playing=false;render();}
  lastFrame=frame;requestAnimationFrame(animation);
}
async function start(){
  try{
    const names=['clean','fault','checkpoint_clean','checkpoint_fault','sequence_clean','sequence_fault'];
    const runs=await Promise.all(names.map(async name=>{
      const response=await fetch(publicAsset(`data/${name}.json`));if(!response.ok)throw new Error(`${name}: HTTP ${response.status}`);return response.json();
    }));
    dataset=Object.fromEntries(names.map((name,i)=>[name,runs[i]]));
    for(const [key,meta] of Object.entries(SCENARIOS)){
      for(const suffix of ['clean','fault']) {
        const name=key==='movement'?suffix:`${key==='sequence'?'sequence':'checkpoint'}_${suffix}`;
        if(dataset[name]?.scenario_id!==meta.id)throw new Error(`Fixture ${name}: exercise identity mismatch`);
      }
    }
    for(const name of names){
      const run=dataset[name],expected=name.endsWith('clean')?'PASS':'FAIL';
      if(run.qa.status!==expected||run.qa.findings.length!==(expected==='PASS'?0:1))
        throw new Error(`${name}: QA fixture contract failed — regenerate with py scripts/build_fixtures.py`);
    }
    bindControls();initLayout({resizeMap:()=>map?.resize()});render(true);createMap();requestAnimationFrame(animation);
  }catch(e){console.error(e);$('mapError').textContent='Simulation QA Lab could not load: '+e.message;$('mapError').classList.remove('hidden');$('mapHealth').textContent='INITIALIZATION FAILED';}
}
start();
