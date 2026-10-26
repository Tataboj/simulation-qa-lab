import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ENTITIES_META,entityIdentity,mapContext} from '../app/vp02_metadata.js';
import {exportTimestamp,makeIssueZip} from '../app/issue_report.js';
const source = file => readFileSync(new URL(file,import.meta.url),'utf8');
const fault = JSON.parse(source('../public/data/fault.json'));
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+XJuIXAAAAABJRU5ErkJggg==','base64'));
test('VP-02 identities are explicit, distinct, and fictional',()=>{
 assert.equal(Object.keys(ENTITIES_META).length,2);
 assert.equal(entityIdentity('ECHO-ALPHA').side,'BLUE');
 assert.equal(entityIdentity('ECHO-BRAVO').side,'RED');
 for(const item of Object.values(ENTITIES_META)){
  assert.equal(item.fictional,true);
  assert.ok(item.vehicleType && item.model && item.role);
 }
 assert.throws(()=>entityIdentity('UNKNOWN'),/Unknown simulated entity/);
});
test('VP-02 geography separates genuine names from fictional scene',()=>{
 assert.match(mapContext('geographic'),/Czechia/);
 assert.match(mapContext('geographic'),/fictional training replay/);
 assert.match(mapContext('synthetic'),/OFFLINE SCHEMATIC.*same synthetic WGS84/);
 assert.throws(()=>mapContext('unknown'),/Unknown map mode/);
});
test('VP-02 map toggle is wired, supports offline fallback and source attribution',()=>{
 const html=source('../index.html');
 const main=source('../app/main.js');
 for(const required of ['id="mapModeToggle"','id="sceneLocation"','id="environmentNote"'])assert.ok(html.includes(required));
 assert.match(main,/\$\('mapModeToggle'\)\.onclick=toggleMapMode/);
 assert.match(main,/map\.setStyle\(mapMode==='geographic'\?ONLINE_STYLE:SYNTHETIC_STYLE\)/);
 assert.match(main,/map\.on\('style\.load'/);
 assert.match(main,/mapMode='synthetic'; map\.setStyle\(SYNTHETIC_STYLE\)/);
 assert.match(main,/https:\/\/tiles\.openfreemap\.org\/styles\/liberty/);
 assert.match(main,/AttributionControl/);
});
test('ddmmyy_HHMMSS timestamp is local calendar and zero-padded',()=>{
 assert.equal(exportTimestamp(new Date(2026,9,22,21,7,5)),'221026_210705');
 assert.equal(exportTimestamp(new Date(2026,0,2,3,4,5)),'020126_030405');
 assert.throws(()=>exportTimestamp(new Date(NaN)),/Valid export date/);
});
test('Issue ZIP and ALL seven internal files share the same creation timestamp',async()=>{
 const d=new Date(2026,9,22,21,7,5);
 const result=await makeIssueZip(fault,'fault',png,{},d,png);
 assert.match(result.filename,/_221026_210705_issue_bundle\.zip$/);
 assert.equal(result.files.length,7);
 for(const [filename] of result.files){
  assert.match(filename,/_221026_210705_/);
  assert.match(filename,/^Simulation_QA_Lab_ECHO-01_POSITION_JUMP_ECHO-BRAVO_T0105_/);
 }
 const evidence=JSON.parse(result.files.find(([n])=>n.endsWith('_raw_evidence.json'))[1]);
 assert.equal(evidence.telemetry.length,242);
 assert.equal(evidence.findings[0].current.t,65);
});
