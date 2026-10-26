/** Deterministic exports of RAW simulation QA evidence. No third-party dependencies. */
import {reproductionSteps, scenarioForId} from './scenario_catalog.js';
const encode = new TextEncoder();
export const FORMATS = Object.freeze({
  xlsx: {label: 'Excel workbook', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: '.xlsx'},
  csv: {label: 'CSV telemetry', mime: 'text/csv', extension: '.csv'},
  md: {label: 'Markdown report', mime: 'text/markdown', extension: '.md'},
  json: {label: 'JSON evidence', mime: 'application/json', extension: '.json'}
});
export function reportFor(run, variant) {
  if (!run || !run.qa || !Array.isArray(run.events)) throw new Error('Missing QA evidence');
  scenarioForId(run.scenario_id); // Validate exercise identity before reporting.
  const f = run.qa.findings[0];
  const checkpoint=Boolean(run.checkpoint);
  const sequence=run.scenario_id==='ECHO-EV01';
  return {
    case_id: sequence ? 'QA-EV01' : checkpoint ? 'QA-CP01' : 'QA-001', exercise: run.scenario_id || 'ECHO-01', variant,
    classification: 'SYNTHETIC TEST ONLY', status: run.qa.status,
    requirement: sequence ? 'OBJECTIVE_COMPLETED must occur strictly after OBJECTIVE_STARTED for the same entity.' : checkpoint ? 'When ECHO-ALPHA enters CP-ALPHA (12 m radius), the scenario event log must record CHECKPOINT_ENTER within 1 second.' : 'Movement between consecutive per-entity samples must not exceed 90 km/h and timestamps must increase.',
    steps: reproductionSteps(run.scenario_id, variant),
    expected: sequence ? 'OBJECTIVE_STARTED must have a smaller simulation timestamp than OBJECTIVE_COMPLETED for ECHO-ALPHA.' : checkpoint ? 'CP-ALPHA entry triggers exactly one CHECKPOINT_ENTER event within the defined event tolerance.' : 'Every adjacent telemetry sample stays within the explicit scenario movement limit.',
    actual: f ? f.message : 'No QA findings in the reference run.',
    root_cause: sequence ? 'Known synthetic fixture cause: OBJECTIVE_COMPLETED was deliberately assigned an earlier timestamp. No external simulator root cause is claimed.' : checkpoint ? 'Unverified for a real simulator. In this demo the CHECKPOINT_ENTER event was intentionally omitted from the synthetic event log.' : 'Unverified for a real simulator. In this demonstration a known synthetic position offset is injected into the source fixture.',
    findings: run.qa.findings, qa_result: run.qa,
    telemetry: run.events, // RAW values, not visual interpolation
    scenario_events:run.scenario_events || [], checkpoint:run.checkpoint || null,
    disclaimer: 'Fictional QA demonstration. Not affiliated with any external simulator, army, or organization.'
  };
}
function rawRows(report) {
  const failures = new Set(report.findings.map(f=>`${f.entity_id}|${f.current.t}`));
  return report.telemetry.map(e=>({
    exercise: report.exercise, variant: report.variant, qa_status: report.status,
    entity_id: e.entity_id, time_s: e.t, latitude: e.lat, longitude: e.lon,
    source: e.source, finding: failures.has(`${e.entity_id}|${e.t}`) ? (report.findings.find(f=>f.entity_id===e.entity_id&&f.current?.t===e.t)?.rule || '') : ''
  }));
}
function safeCsvCell(value) {
  let txt = value == null ? '' : String(value);
  if (typeof value === 'number' && Number.isFinite(value)) return `"${txt}"`;
  // Spreadsheet formula injection protection for untrusted text fields.
  if (/^[\s\u0000-\u001F]*[=+\-@]/.test(txt)) txt = "'" + txt;
  return `"${txt.replace(/"/g, '""')}"`;
}
function toCSV(report) {
  const rows = rawRows(report);
  const cols = ['exercise','variant','qa_status','entity_id','time_s','latitude','longitude','source','finding'];
  return '\uFEFF' + [cols.map(safeCsvCell).join(','),...rows.map(row=>cols.map(c=>safeCsvCell(row[c])).join(','))].join('\r\n') + '\r\n';
}
const mdSafe = v=>String(v??'').replace(/\|/g,'\\|').replace(/\r?\n/g,' ');
function toMD(report) {
  const lines = [
    '# Simulation QA Lab — QA Evidence Report', '',
    '> Fictional training demonstration. No external integration or affiliation.', '',
    `- **Exercise:** ${mdSafe(report.exercise)}`,
    `- **Test variant:** ${mdSafe(report.variant)}`,
    `- **QA status:** ${mdSafe(report.status)}`,
    `- **Raw samples:** ${report.telemetry.length}`,
    `- **Findings:** ${report.findings.length}`,
    '', '## Requirement', '', report.requirement, '',
    '## Reproduction steps', '', ...report.steps.map((s,i)=>`${i+1}. ${mdSafe(s)}`), '',
    '## Expected result', '', report.expected, '',
    '## Actual result', '', report.actual, '',
    '## QA findings (raw coordinates)', '',
    '| Rule | Entity | Previous T (s) | Current T (s) | Previous lat/lon | Current lat/lon | Speed km/h |',
    '| --- | --- | ---: | ---: | --- | --- | ---: |',
    ...report.findings.map(f=>`| ${mdSafe(f.rule)} | ${mdSafe(f.entity_id)} | ${f.previous?.t??''} | ${f.current?.t??''} | ${f.previous?.lat??''}, ${f.previous?.lon??''} | ${f.current?.lat??''}, ${f.current?.lon??''} | ${f.speed_kmh??'N/A'} |`),
    '', '## Scenario event log', '', report.checkpoint ? `Checkpoint ${report.checkpoint.id}; expected event CHECKPOINT_ENTER; recorded events: ${JSON.stringify(report.scenario_events)}` : `Original scenario event log: ${JSON.stringify(report.scenario_events)}`, '', '## Root-cause assessment', '', report.root_cause, '',
    '## Provenance', '', 'Telemetry is taken from the original synthetic fixture. Animated/interpolated map positions are never exported as raw evidence.', ''
  ];
  return lines.join('\n');
}
const xmlEsc = value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function colLetter(n) { let result='';for(let x=n+1;x>0;x=Math.floor((x-1)/26))result=String.fromCharCode(65+(x-1)%26)+result;return result; }
function worksheet(rows) {
  const content=rows.map((cells,i)=>`<row r="${i+1}">${cells.map((val,j)=> {
    const ref=`${colLetter(j)}${i+1}`;
    return typeof val==='number' && Number.isFinite(val)
      ? `<c r="${ref}"><v>${val}</v></c>`
      : `<c r="${ref}" t="inlineStr"><is><t>${xmlEsc(val)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const lastCell=`${colLetter(Math.max(...rows.map(r=>r.length))-1)}${rows.length}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastCell}"/><sheetData>${content}</sheetData></worksheet>`;
}
// Small, standards-conformant STORE-only ZIP (OOXML). No zip64 needed for tiny synthetic fixtures.
const crcTable = Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
export function zipStore(entries,mime=FORMATS.xlsx.mime,createdAt=new Date()){
  if(!(createdAt instanceof Date)||!Number.isFinite(createdAt.getTime()))throw new Error('Invalid archive timestamp');
  // ZIP DOS local timestamp (seconds stored with two-second precision).
  const yr=Math.max(1980,Math.min(2107,createdAt.getFullYear()));
  const dosDate=((yr-1980)<<9)|((createdAt.getMonth()+1)<<5)|createdAt.getDate();
  const dosTime=(createdAt.getHours()<<11)|(createdAt.getMinutes()<<5)|Math.floor(createdAt.getSeconds()/2);
  let local=[], central=[], offset=0;
  for (const [name,content] of entries){
    const n=encode.encode(name), data=content instanceof Uint8Array?content:encode.encode(content), crc=crc32(data);
    const h=new Uint8Array(30+n.length),v=new DataView(h.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(10,dosTime,true);v.setUint16(12,dosDate,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);h.set(n,30);
    local.push(h,data);
    const c=new Uint8Array(46+n.length), w=new DataView(c.buffer);
    w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(12,dosTime,true);w.setUint16(14,dosDate,true);w.setUint32(16,crc,true);w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,n.length,true);w.setUint32(42,offset,true);c.set(n,46);
    central.push(c);offset+=h.length+data.length;
  }
  const csize=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);
  v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,csize,true);v.setUint32(16,offset,true);
  return new Blob([...local,...central,end],{type:mime});
}
function toXLSX(report){
  const summary=[
    ['Key','Value'],['Exercise',report.exercise],['Variant',report.variant],['QA Status',report.status],
    ['Raw Samples',report.telemetry.length],['Finding Count',report.findings.length],
    ...(Number.isFinite(report.qa_result.rule_max_speed_kmh)
      ? [['Scenario Speed Limit (km/h)', report.qa_result.rule_max_speed_kmh]] : []),
    ['Requirement',report.requirement],['Expected',report.expected],['Actual',report.actual],
    ['Root Cause',report.root_cause],['Checkpoint ID',report.checkpoint?.id||'N/A'],['Scenario event log',JSON.stringify(report.scenario_events)],['Classification',report.classification],['Disclaimer',report.disclaimer]
  ];
  const findings=[['Rule','Entity','Previous T (s)','Current T (s)','Previous Latitude','Previous Longitude','Current Latitude','Current Longitude','Speed (km/h)','Message'],
    ...report.findings.map(f=>[f.rule,f.entity_id,f.previous?.t??'',f.current?.t??'',f.previous?.lat??'',f.previous?.lon??'',f.current?.lat??'',f.current?.lon??'',f.speed_kmh??'',f.message])];
  const columns=['Exercise','Variant','QA Status','Entity ID','Time (s)','Latitude','Longitude','Source','Finding'];
  const telemetry=[columns,...rawRows(report).map(r=>Object.values(r))];
  const types=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
  const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const wb=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Summary" sheetId="1" r:id="rId1"/><sheet name="Findings" sheetId="2" r:id="rId2"/><sheet name="Telemetry" sheetId="3" r:id="rId3"/></sheets></workbook>`;
  const wrels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/></Relationships>`;
  return zipStore([['[Content_Types].xml',types],['_rels/.rels',rels],['xl/workbook.xml',wb],['xl/_rels/workbook.xml.rels',wrels],['xl/worksheets/sheet1.xml',worksheet(summary)],['xl/worksheets/sheet2.xml',worksheet(findings)],['xl/worksheets/sheet3.xml',worksheet(telemetry)]]);
}
export function buildExport(run, variant, format){
  if (!(format in FORMATS))throw new Error(`Unsupported export format: ${format}`);
  const report=reportFor(run,variant), filename=`Simulation_QA_Lab_${run.scenario_id.replace(/-/g,'')}_QA_${variant}${FORMATS[format].extension}`;
  const content={xlsx:()=>toXLSX(report),csv:()=>toCSV(report),md:()=>toMD(report),json:()=>JSON.stringify(report,null,2)}[format]();
  return {filename,mime:FORMATS[format].mime, blob: content instanceof Blob ? content : new Blob([content],{type:FORMATS[format].mime}),content};
}
/** Must be called directly from Save button click (browser transient user activation). */
export async function saveEvidence(run,variant,format, env=window){
  const filename=`Simulation_QA_Lab_${run.scenario_id.replace(/-/g,'')}_QA_${variant}${FORMATS[format]?.extension??''}`;
  if(!(format in FORMATS))throw new Error('Unknown export format');
  if(typeof env.showSaveFilePicker==='function' && env.isSecureContext){
    // Call picker BEFORE expensive workbook generation: preserve user gesture.
    const handle=await env.showSaveFilePicker({suggestedName:filename,
      types:[{description:FORMATS[format].label, accept:{[FORMATS[format].mime]:[FORMATS[format].extension]}}]
    });
    const generated=buildExport(run,variant,format);
    const writable=await handle.createWritable();
    try {await writable.write(generated.blob);await writable.close();}
    catch(err){try{await writable.abort?.();}catch{}throw err;}
    return {saved:true,filename,method:'picker'};
  }
  const generated=buildExport(run,variant,format), url=URL.createObjectURL(generated.blob);
  try {const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();}
  finally {setTimeout(()=>URL.revokeObjectURL(url),30000);}
  return {saved:false,filename,method:'download'}; // Cannot assert success or location for browser fallback
}
