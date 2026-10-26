/** Jira/issue-tracker friendly synthetic QA ticket; no service integration. */
import {buildExport, reportFor, zipStore} from './evidence_export.js';
import {distanceMeters, distanceText} from './separation.js';
export const APP_VERSION='1.0.0-rc.1';
export function exportTimestamp(date=new Date()){
  if(!(date instanceof Date)||!Number.isFinite(date.getTime()))throw new Error('Valid export date required');
  const p=n=>String(n).padStart(2,'0');
  return `${p(date.getDate())}${p(date.getMonth()+1)}${p(date.getFullYear()%100)}_${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}
const prettyTime = n=>`T+${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
export function issueFromRun(run,variant,environment={}) {
  const report=reportFor(run,variant);
  if (!['fault','checkpoint_fault','sequence_fault'].includes(variant) || report.status!=='FAIL' || report.findings.length!==1)
    throw new Error('No failing simulated issue to report. Choose Injected fault first.');
  const finding=report.findings[0];
  if(finding.rule==='EVENT_ORDER_VIOLATION'){
    const when=prettyTime(finding.objective_completed_t);
    const summary=`[Scenario/Events][${report.exercise}] ${finding.entity_id} OBJECTIVE_COMPLETED at ${when} precedes OBJECTIVE_STARTED`;
    const titleRoot=`Simulation_QA_Lab_${report.exercise}_${finding.rule}_${finding.entity_id}_T${String(Math.floor(finding.objective_completed_t/60)).padStart(2,'0')}${String(finding.objective_completed_t%60).padStart(2,'0')}`;
    const body=[
      'ISSUE TYPE: Bug / intentionally injected fictional event-order fault',
      'COMPONENT: Scenario event sequence / causal ordering',
      `EXERCISE: ${report.exercise} | ENTITY: ${finding.entity_id} | RULE: ${finding.rule}`,
      'SEVERITY: Major (proposal; requires team triage)',
      'PRIORITY: Not assigned',
      'STEPS TO REPRODUCE',...report.steps.map((x,i)=>`${i+1}. ${x}`),
      'EXPECTED RESULT',report.expected,
      'ACTUAL RESULT',finding.message,
      `Raw event log (unaltered): ${JSON.stringify(report.scenario_events)}`,
      `Event times: START ${finding.objective_start_t}s; COMPLETE ${finding.objective_completed_t}s.`,
      'ENVIRONMENT',`Simulation QA Lab v${APP_VERSION} — local fictional replay`,
      `URL/host: ${environment.host||'Not recorded'}`,
      `Browser agent: ${environment.userAgent||'Not recorded'}`,
      'ROOT CAUSE / INVESTIGATION',
      'Known synthetic fixture cause: completion time was deliberately shifted earlier. Not a confirmed external simulator bug.',
      'Inspect event emission order, logical preconditions, timestamp clock sources and event log serialization in analogous systems.',
      'ACCEPTANCE / REGRESSION',
      'sequence_clean PASS (START 45s, COMPLETE 85s); sequence_fault FAIL with exactly one EVENT_ORDER_VIOLATION (START 45s, COMPLETE 35s).',
      'Do not repair or sort event timestamps before validation.',
      'ATTACHMENTS','Annotated map PNG, full UI context PNG, original JSON with scenario_events, XLSX with raw telemetry.',
      'PROVENANCE','All source data and units are synthetic, not an external simulator feed.'
    ].join('\n');
    return {summary,body,titleRoot,report,finding};
  }
  if(finding.rule==='CHECKPOINT_EVENT_MISSING'){
    const t=prettyTime(finding.expected_t);
    const summary=`[Scenario/Checkpoint][${report.exercise}] ${finding.entity_id} entered ${finding.checkpoint_id} at ${t} — CHECKPOINT_ENTER not logged`;
    const titleRoot=`Simulation_QA_Lab_${report.exercise}_${finding.rule}_${finding.entity_id}_T${String(Math.floor(finding.expected_t/60)).padStart(2,'0')}${String(finding.expected_t%60).padStart(2,'0')}`;
    const body=[
      'ISSUE TYPE: Bug / synthetic scenario-logic demonstration (deliberately injected)',
      `COMPONENT: Scenario triggers / checkpoint event logging`,
      `EXERCISE: ${report.exercise} | ENTITY: ${finding.entity_id} | RULE: ${finding.rule}`,
      'SEVERITY: Major — proposed, subject to team triage',
      'PRIORITY: Not assigned — decide in issue tracker',
      'REPRODUCIBILITY: Deterministic with original synthetic fixtures',
      'CONTEXT',
      'This is a controlled missing-event fixture, not evidence of a defect in any external simulator.',
      `Requirement: ${report.requirement}`,
      'STEPS TO REPRODUCE', ...report.steps.map((v,i)=>`${i+1}. ${v}`),
      'EXPECTED RESULT',report.expected,
      `At ${t}, source entry into ${finding.checkpoint_id} must produce CHECKPOINT_ENTER within 1 s.`,
      'ACTUAL RESULT',finding.message,
      `Observed event log: ${JSON.stringify(report.scenario_events)}`,
      `Previous raw WGS84: ${finding.previous.lat}, ${finding.previous.lon} at ${finding.previous.t}s.`,
      `Current raw WGS84: ${finding.current.lat}, ${finding.current.lon} at ${finding.current.t}s.`,
      `Validation: ${report.status}, ${report.findings.length} finding; ${report.telemetry.length} untouched raw samples.`,
      'ENVIRONMENT',`Application: Simulation QA Lab v${APP_VERSION}, local synthetic checkpoint_fault replay`,
      `URL/host: ${environment.host||'Not captured'}`,`Browser user agent: ${environment.userAgent||'Not captured'}`,
      'ROOT CAUSE / INVESTIGATION',
      'Known DEMO fixture cause: CHECKPOINT_ENTER was intentionally omitted. Real software root cause is not established.',
      'Investigate trigger emission, event buffering and correlation to raw entry-time samples in analogous systems.',
      'ACCEPTANCE / REGRESSION',
      'checkpoint_clean must PASS with one correctly timed event; checkpoint_fault must FAIL with one CHECKPOINT_EVENT_MISSING at T+00:58.',
      'Never invent an event based on graphical interpolation.',
      'ATTACHMENTS', 'Marked map PNG, full UI context PNG, original XLSX telemetry, JSON including separate scenario_events and checkpoint specification.',
      'PROVENANCE', 'All units and scenario data are fictional. Evidence is from original synthetic fixtures.'
    ].join('\n');
    return {summary,body,titleRoot,report,finding};
  }
  const fmt=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:1});
  const summary=`[Replay/Telemetry][${report.exercise}] ${finding.entity_id} position jump at ${prettyTime(finding.current.t)} — ${fmt(finding.speed_kmh)} km/h vs ${fmt(report.qa_result.rule_max_speed_kmh)} km/h limit`;
  const ua=environment.userAgent||'Not captured — enter when filing';
  const host=environment.host||'Local demo (exact host not recorded)';
  const titleRoot=`Simulation_QA_Lab_${report.exercise}_${finding.rule}_${finding.entity_id}_T${String(Math.floor(finding.current.t/60)).padStart(2,'0')}${String(finding.current.t%60).padStart(2,'0')}`;
  const body=[
    'ISSUE TYPE: Bug / QA demonstration (synthetic, intentionally injected)',
    `COMPONENT: Replay / Telemetry validation`,
    `EXERCISE: ${report.exercise} | ENTITY: ${finding.entity_id} | RULE: ${finding.rule}`,
    'SEVERITY: Major — suggested, subject to team triage',
    'PRIORITY: Not assigned — decide in issue tracker',
    'REPRODUCIBILITY: Deterministic with the provided synthetic fixture',
    '',
    'CONTEXT',
    'Fictional Simulation QA Lab QA demonstration. This is a controlled synthetic fault, NOT a verified defect in any real simulator or external product.',
    `Requirement: ${report.requirement}`,
    '',
    'STEPS TO REPRODUCE',
    ...report.steps.map((s,i)=>`${i+1}. ${s}`),
    '',
    'EXPECTED RESULT',
    report.expected,
    `At ${prettyTime(finding.current.t)}, the transition must respect the ${report.qa_result.rule_max_speed_kmh} km/h scenario limit (or be rejected/flagged).`,
    '',
    'ACTUAL RESULT',
    `${finding.entity_id} moves from raw sample ${finding.previous.t} s to ${finding.current.t} s at ${finding.speed_kmh.toFixed(2)} km/h; rule limit ${report.qa_result.rule_max_speed_kmh} km/h.`,
    `Previous raw WGS84: lat ${finding.previous.lat}, lon ${finding.previous.lon}.`,
    `Current raw WGS84: lat ${finding.current.lat}, lon ${finding.current.lon}.`,
    `Result: ${report.status}; ${report.findings.length} finding across ${report.telemetry.length} raw event samples.`,
    'The invalid segment is deliberately not smoothed or interpolated.',
    '',
    'ENVIRONMENT',
    `Application: Simulation QA Lab v${APP_VERSION}; mode: local fictional replay; variant: ${variant}`,
    `URL/host: ${host}`,
    `Browser user agent (reported): ${ua}`,
    'Actual operating system and real simulator build: not verified / not applicable to this synthetic demo.',
    '',
    'ROOT CAUSE / INVESTIGATION',
    'Known DEMO fixture cause: an intentionally injected source-coordinate offset. There is no established root cause in external software.',
    'Suggested developer investigation for analogous real bugs: inspect event ingestion, coordinate units, per-entity timestamp order and movement validation before interpolation.',
    '',
    'ACCEPTANCE / REGRESSION',
    'Reference dataset must return PASS (0 findings); fault dataset must return FAIL with one POSITION_JUMP on ECHO-BRAVO at t=65 s.',
    'Reject or flag the invalid raw transition; never conceal it with visual interpolation.',
    '',
    'ATTACHMENTS — add files manually in Jira or another tracker',
    'Annotated map PNG — map capture (visual corroboration only; actual saved filename includes export timestamp).',
    'Full UI context PNG — live dashboard DOM plus captured MapLibre pixels; sidebar scroll reset only in export clone; export dialog omitted.',
    'Raw telemetry XLSX — Summary, Findings and original Telemetry sheets (timestamped filename).',
    'Raw evidence JSON — complete machine-readable raw records and finding (timestamped filename).',
    'Do not copy the local screenshot path as a public URL; attach the actual file.',
    '',
    'PROVENANCE',
    'Raw telemetry is from the included synthetic scenario fixture. Map animation is for display only; no interpolated coordinates are exported as raw evidence.'
  ].join('\n');
  return {summary,body,titleRoot,report,finding};
}
const pngHeader=[137,80,78,71,13,10,26,10];
export function isPng(bytes){return bytes instanceof Uint8Array && pngHeader.every((v,i)=>bytes[i]===v);}
export async function makeIssueZip(run,variant,pngBytes,environment={},createdAt=new Date(),uiContextPng) {
  const issue=issueFromRun(run,variant,environment);
  if (!isPng(pngBytes)) throw new Error('Annotated map evidence is not a valid PNG. No package created.');
  if (!isPng(uiContextPng)) throw new Error('Full UI context evidence is not a valid PNG. No package created.');
  const stamp=exportTimestamp(createdAt);
  const root=`${issue.titleRoot}_${stamp}`;
  const xlsx=new Uint8Array(await buildExport(run,variant,'xlsx').blob.arrayBuffer());
  const raw=await buildExport(run,variant,'json').blob.text();
  const files=[
    [`${root}_summary.txt`,issue.summary+'\n'],
    [`${root}_description.txt`,issue.body+'\n'],
    [`${root}_raw_telemetry.xlsx`,xlsx],
    [`${root}_raw_evidence.json`,raw],
    [`${root}_map_evidence.png`,pngBytes],
    [`${root}_ui_context.png`,uiContextPng],
    [`${root}_HOW_TO_FILE.txt`,'1) Create Bug / work item in your team issue tracker.\n2) Copy summary.txt to the title/summary field.\n3) Copy description.txt to description.\n4) Attach BOTH map_evidence.png (technical map) and ui_context.png (dashboard context), plus .xlsx/.json; assign priority in tracker.\n5) Verify attachments finished uploading.\n\nALL RECORDS ARE FICTIONAL SIMULATED QA EVIDENCE.\n']
  ];
  return {issue,files,filename:`${root}_issue_bundle.zip`,blob:zipStore(files,'application/zip',createdAt)};
}
export async function saveIssueZip(run,variant,renderEvidence,environment={},env=window){
  const issue=issueFromRun(run,variant,environment);
  const createdAt=new Date();
  const filename=`${issue.titleRoot}_${exportTimestamp(createdAt)}_issue_bundle.zip`;
  let handle=null;
  if (typeof env.showSaveFilePicker==='function' && env.isSecureContext) {
    // Show picker during direct user interaction, before async screenshot encoding.
    handle=await env.showSaveFilePicker({suggestedName:filename,types:[{description:'QA issue evidence bundle',accept:{'application/zip':['.zip']}}]});
  }
  const images=await renderEvidence(issue);
  if (!images || !isPng(images.mapPng) || !isPng(images.uiPng)) throw new Error('Both map and full UI PNG evidence are required');
  const generated=await makeIssueZip(run,variant,images.mapPng,environment,createdAt,images.uiPng);
  if(handle){
    const w=await handle.createWritable();
    try{await w.write(generated.blob);await w.close();}catch(e){try{await w.abort?.();}catch{}throw e;}
    return {method:'picker',filename};
  }
  // Fallback browser download. Does not assert save succeeded or where it was saved.
  const href=URL.createObjectURL(generated.blob);
  try{const a=document.createElement('a');a.href=href;a.download=filename;document.body.append(a);a.click();a.remove();}
  finally{setTimeout(()=>URL.revokeObjectURL(href),30000);}
  return {method:'download',filename};
}
/** Reject maps whose readback is uniformly black/empty (MapLibre 6 default buffer).
 *  Check BEFORE drawing overlays, so red markers cannot disguise a blank map.
 *  Pixels are sampled only from interior map area to avoid the top header.
 */
export function assessMapPixels(ctx,width,height) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<40||height<40)
    return {valid:false,reason:'Map capture dimensions invalid'};
  if(typeof ctx.getImageData!=='function')
    return {valid:false,reason:'Map screenshot pixel inspection unavailable'};
  const samples=[];
  try {
    for(let iy=2;iy<=8;iy++)for(let ix=1;ix<=11;ix++){
      const x=Math.floor(width*ix/12),y=Math.floor(height*iy/10);
      const c=ctx.getImageData(x,y,1,1).data;
      samples.push([c[0],c[1],c[2],c[3]]);
    }
  }catch(err){return {valid:false,reason:'Map canvas pixel readback failed: '+(err.message||err)};}
  const empty=samples.filter(([r,g,b,a])=>a<5 || (r<8 && g<8 && b<8));
  const almostBlack=samples.filter(([r,g,b,a])=>a<10 || (r+g+b<40));
  const distinct=new Set(samples.map(([r,g,b])=>[r>>4,g>>4,b>>4].join(','))).size;
  const valid=empty.length/samples.length<0.88 && almostBlack.length/samples.length<0.96 && distinct>=3;
  return {valid,blackRatio:empty.length/samples.length,distinct,reason:valid?'OK':'Map background appears blank or black; screenshot rejected'};
}
/** Technical evidence uses a reserved HEADER and SIDE PANEL, not overlays over
 *  the MapLibre view. Pixel coordinates and every raw sample remain unchanged.
 *  No map panning/zooming, resampling or telemetry interpolation during export.
 */
export function mapEvidenceLayout(mapWidth,mapHeight,pixelScale) {
  if (![mapWidth,mapHeight,pixelScale].every(v=>Number.isFinite(v)&&v>0))
    throw new Error('Invalid technical map evidence geometry');
  const header=Math.round(94*pixelScale);
  const footer=Math.round(24*pixelScale);
  const sidebar=Math.round(454*pixelScale);
  return Object.freeze({width:mapWidth+sidebar,height:header+mapHeight+footer,
    mapWidth,mapHeight,mapX:0,mapY:header,header,footer,sidebar,
    sideX:mapWidth,sideW:sidebar});
}

function markedLabel(ctx,label,x,y,mapRect,pixelScale) {
  const h=27*pixelScale,w=Math.max(88,label.length*8.3+24)*pixelScale;
  // Place below the point where possible, then clamp to the actual map area.
  const left=Math.max(mapRect.x+6*pixelScale,Math.min(x+12*pixelScale,mapRect.x+mapRect.w-w-6*pixelScale));
  const top=Math.max(mapRect.y+5*pixelScale,Math.min(y-38*pixelScale,mapRect.y+mapRect.h-h-6*pixelScale));
  ctx.fillStyle='rgba(255,255,255,.96)';ctx.fillRect(left,top,w,h);
  ctx.strokeStyle='#c3321a';ctx.lineWidth=1.4*pixelScale;ctx.strokeRect(left,top,w,h);
  ctx.fillStyle='#a72d1d';ctx.font=`bold ${Math.max(12,13*pixelScale)}px sans-serif`;
  ctx.fillText(label,left+9*pixelScale,top+18*pixelScale);
}

function directedFaultArrow(ctx,x,y,X,Y,pixelScale) {
  ctx.lineWidth=Math.max(3,3*pixelScale);ctx.strokeStyle='#e7472b';
  ctx.setLineDash([12*pixelScale,8*pixelScale]);ctx.beginPath();
  ctx.moveTo(x,y);ctx.lineTo(X,Y);ctx.stroke();ctx.setLineDash([]);
  const dx=X-x,dy=Y-y,len=Math.hypot(dx,dy);
  if(len<18*pixelScale)return;
  const ux=dx/len,uy=dy/len,px=-uy,py=ux;
  const tx=x+dx*.68,ty=y+dy*.68;
  const wing=9*pixelScale,back=18*pixelScale;
  ctx.fillStyle='#e7472b';ctx.beginPath();ctx.moveTo(tx,ty);
  ctx.lineTo(tx-ux*back+px*wing,ty-uy*back+py*wing);
  ctx.lineTo(tx-ux*back-px*wing,ty-uy*back-py*wing);
  ctx.lineTo(tx,ty);ctx.fill();
}

/** Technical PNG: ENTIRE original map viewport plus dedicated explanatory space.
 *  Both raw endpoints remain on the map; annotation panels cannot cover them.
 */
export async function renderAnnotatedMapPng(map,issue,shownSeconds,options={}) {
  if(!map || !map.loaded())throw new Error('Map not ready. Wait for Map Engine Operational.');
  const source=map.getCanvas();
  const width=source.width,height=source.height;
  if(width===0||height===0)throw new Error('Map canvas has no pixels');
  const pixelScale=width/source.clientWidth;
  const layout=mapEvidenceLayout(width,height,pixelScale);
  const canvas=document.createElement('canvas');canvas.width=layout.width;canvas.height=layout.height;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('2D evidence canvas is unavailable');
  // Inspect an untouched copy of source pixels, before evidence graphics are drawn.
  const sourceCheck=document.createElement('canvas');sourceCheck.width=width;sourceCheck.height=height;
  const checkCtx=sourceCheck.getContext('2d',{willReadFrequently:true});
  if(!checkCtx)throw new Error('Map readback context is unavailable');
  try{checkCtx.drawImage(source,0,0,width,height);}catch(e){throw new Error('Could not capture MapLibre canvas: '+e.message);}
  const mapPixels=assessMapPixels(checkCtx,width,height);
  if(!mapPixels.valid)throw new Error(mapPixels.reason+' — switch to Offline schematic map or wait until tiles are visible, then retry.');

  const f=issue.finding;
  const a=map.project([f.previous.lon,f.previous.lat]),b=map.project([f.current.lon,f.current.lat]);
  const points=[a,b];
  if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<10||p.y<10||p.x>source.clientWidth-10||p.y>source.clientHeight-10))
    throw new Error('Raw fault endpoint is outside the current map view. Zoom out or pan until both points are visible, then export again.');
  const x=a.x*pixelScale,y=a.y*pixelScale+layout.mapY,X=b.x*pixelScale,Y=b.y*pixelScale+layout.mapY;
  const size=Math.max(16,Math.round(21*pixelScale));
  const stepMeters=distanceMeters(f.previous,f.current);
  const rect={x:0,y:layout.mapY,w:width,h:height};
  ctx.fillStyle='#edf2f4';ctx.fillRect(0,0,layout.width,layout.height);
  ctx.drawImage(source,0,layout.mapY,width,height); // original rendered pixels, no scaling or cropping
  if(f.rule==='POSITION_JUMP')directedFaultArrow(ctx,x,y,X,Y,pixelScale);
  else if(f.rule==='CHECKPOINT_EVENT_MISSING') {
    ctx.lineWidth=2.5*pixelScale;ctx.strokeStyle='#cc442c';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(X,Y);ctx.stroke();
  }
  const mark=(px,py)=>{ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(px,py,size*.6,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#c3321a';ctx.lineWidth=3*pixelScale;ctx.beginPath();ctx.arc(px,py,size*.6,0,Math.PI*2);ctx.stroke();};
  if(f.rule==='POSITION_JUMP') {
    mark(x,y);mark(X,Y);
    markedLabel(ctx,`START ${prettyTime(f.previous.t)}`,x,y,rect,pixelScale);
    markedLabel(ctx,`FAULT ${prettyTime(f.current.t)}`,X,Y,rect,pixelScale);
  } else if(f.rule==='CHECKPOINT_EVENT_MISSING') {
    mark(X,Y);
    markedLabel(ctx,`CP ENTRY ${prettyTime(f.current.t)}`,X,Y,rect,pixelScale);
  } else {
    // Independent source-log error. Position only locates the unit: no false red jump arrow.
    mark(X,Y);
    markedLabel(ctx,'COMPLETED BEFORE STARTED',X,Y,rect,pixelScale);
  }
  // Dedicated title band: never covers map symbols, nodes or map labels.
  ctx.fillStyle='#102633';ctx.fillRect(0,0,layout.width,layout.header);
  ctx.fillStyle='#ffffff';ctx.font=`bold ${Math.round(20*pixelScale)}px sans-serif`;
  ctx.fillText('SIMULATION QA LAB — SYNTHETIC MAP EVIDENCE',16*pixelScale,30*pixelScale);
  ctx.font=`${Math.round(14*pixelScale)}px sans-serif`;
  ctx.fillText(`${f.entity_id} · ${f.rule} · event ${prettyTime(f.current.t)} · map view ${prettyTime(shownSeconds)}`,16*pixelScale,58*pixelScale);
  ctx.fillText('Original visible map pixels preserved; labels added outside the original map view where possible.',16*pixelScale,80*pixelScale);
  // Dedicated data panel, outside the map, for readable evidence without overlap.
  ctx.fillStyle='#f4f7f9';ctx.fillRect(layout.sideX,layout.mapY,layout.sideW,height);
  ctx.fillStyle='#b63e29';ctx.fillRect(layout.sideX,layout.mapY,3*pixelScale,height);
  const boxX=layout.sideX+16*pixelScale,boxY=layout.mapY+17*pixelScale;
  const boxW=layout.sideW-32*pixelScale,boxH=228*pixelScale;
  ctx.fillStyle='#fff';ctx.fillRect(boxX,boxY,boxW,boxH);
  ctx.strokeStyle='#b63e29';ctx.lineWidth=Math.max(2,2*pixelScale);ctx.strokeRect(boxX,boxY,boxW,boxH);
  ctx.fillStyle='#163a4b';ctx.font=`bold ${Math.max(12,16*pixelScale)}px sans-serif`;
  ctx.fillText(f.rule==='EVENT_ORDER_VIOLATION'?'EVENT ORDER / SOURCE LOG':f.rule==='CHECKPOINT_EVENT_MISSING'?'CHECKPOINT EVENT / SOURCE DATA':`${f.rule} / SOURCE DATA`,boxX+12*pixelScale,boxY+25*pixelScale);
  ctx.font=`${Math.max(11,13*pixelScale)}px monospace`;
  ctx.fillText(`Entity: ${f.entity_id}`,boxX+12*pixelScale,boxY+52*pixelScale);
  ctx.fillText(`Previous: ${f.previous.t}s  ${f.previous.lat.toFixed(5)}, ${f.previous.lon.toFixed(5)}`,boxX+12*pixelScale,boxY+77*pixelScale);
  ctx.fillText(`Current:  ${f.current.t}s  ${f.current.lat.toFixed(5)}, ${f.current.lon.toFixed(5)}`,boxX+12*pixelScale,boxY+99*pixelScale);
  ctx.fillStyle='#a83420';ctx.font=`bold ${Math.max(11,13*pixelScale)}px monospace`;
  ctx.fillText(f.rule==='EVENT_ORDER_VIOLATION'?`COMPLETE ${f.objective_completed_t}s BEFORE START ${f.objective_start_t}s`:f.rule==='CHECKPOINT_EVENT_MISSING'?'Missing: CHECKPOINT_ENTER':`Observed: ${f.speed_kmh.toFixed(1)} km/h`,boxX+12*pixelScale,boxY+128*pixelScale);
  ctx.fillText(f.rule==='EVENT_ORDER_VIOLATION'?'Independent source event log':f.rule==='CHECKPOINT_EVENT_MISSING'?`Checkpoint: ${f.checkpoint_id} · T+${f.expected_t}s`:`Limit: ${issue.report.qa_result.rule_max_speed_kmh} km/h`,boxX+12*pixelScale,boxY+151*pixelScale);
  ctx.fillStyle='#183747';ctx.font=`${Math.max(11,13*pixelScale)}px monospace`;
  ctx.fillText(f.rule==='EVENT_ORDER_VIOLATION'?'Map position is contextual only':`Step: ${f.rule==='CHECKPOINT_EVENT_MISSING'?stepMeters.toFixed(1)+' m':distanceText(stepMeters)} / ${f.current.t-f.previous.t}s`,boxX+12*pixelScale,boxY+177*pixelScale);
  ctx.fillStyle='#315367';ctx.font=`${Math.max(11,12*pixelScale)}px sans-serif`;
  ctx.fillText(f.rule==='POSITION_JUMP'?'Red arrow = direction of INVALID transition':
    f.rule==='CHECKPOINT_EVENT_MISSING'?'Missing event, not a movement defect':'Source-log event error, not a position jump',boxX+12*pixelScale,boxY+203*pixelScale);
  ctx.fillStyle='#315367';ctx.font=`${Math.max(11,13*pixelScale)}px sans-serif`;
  let noteY=boxY+boxH+26*pixelScale;
  for(const line of ['TECHNICAL EVIDENCE',
    'Red markers: original WGS84 samples.',
    'Map view is unchanged; no new terrain.',
    'Purple line in the UI: air-line distance',
    'between ALPHA and BRAVO (not a route).',
    'No data corrected or interpolated.']) {
    ctx.fillText(line,boxX+3*pixelScale,noteY);noteY+=24*pixelScale;
  }
  const attribution=options.mapMode==='geographic'
    ? 'Basemap © OpenStreetMap contributors · OpenFreeMap | Synthetic telemetry / fictional units'
    : 'Offline schematic (invented cartography) / unchanged synthetic WGS84 unit positions';
  const footerY=layout.mapY+height;
  ctx.fillStyle='#102633';ctx.fillRect(0,footerY,layout.width,layout.footer);
  ctx.fillStyle='#fff';ctx.font=`${Math.max(10,11*pixelScale)}px sans-serif`;
  ctx.fillText(attribution,10*pixelScale,footerY+16*pixelScale);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG encoding failed')),'image/png'));
  const bytes=new Uint8Array(await blob.arrayBuffer());
  if(!isPng(bytes))throw new Error('Browser returned non-PNG data');
  return bytes;
}
