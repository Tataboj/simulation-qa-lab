import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildExport, reportFor,saveEvidence, FORMATS} from '../app/evidence_export.js';
const load = n=>JSON.parse(readFileSync(new URL(`../public/data/${n}.json`,import.meta.url),'utf8'));
const clean=load('clean'),fault=load('fault');

test('export selection supports real Excel, CSV, Markdown and JSON',()=>{
  assert.deepEqual(Object.keys(FORMATS),['xlsx','csv','md','json']);
  for (const format of Object.keys(FORMATS)) {
    const result=buildExport(fault,'fault',format);
    assert.ok(result.filename.endsWith('.'+format));
    assert.equal(result.blob.type,FORMATS[format].mime);
    assert.ok(result.blob.size>200);
  }
});
test('JSON exports retain full unmodified source samples and exact fault finding', async()=>{
  const report=JSON.parse(await buildExport(fault,'fault','json').blob.text());
  assert.equal(report.telemetry.length,242);
  assert.equal(report.qa_result.findings.length,1);
  assert.deepEqual(report.telemetry,fault.events);
  assert.deepEqual(report.findings[0].current,fault.qa.findings[0].current);
  assert.ok(report.disclaimer.includes('Fictional'));
});
test('CSV has header, one row per sample and marked invalid event',async()=>{
  const csv=await buildExport(fault,'fault','csv').blob.text();
  const rows=csv.trim().replace(/^\uFEFF/,'').split(/\r?\n/);
  assert.equal(rows.length,243);
  assert.match(rows[0],/"entity_id"/);
  assert.ok(rows.some(x=>x.includes('"ECHO-BRAVO","65"')&&x.includes('"POSITION_JUMP"')));
});
test('Markdown includes reproducible QA context and source provenance',async()=>{
  const md=await buildExport(fault,'fault','md').blob.text();
  assert.match(md,/## Reproduction steps/);
  assert.match(md,/4041\.1 km\/h/);
  assert.match(md,/original synthetic fixture/);
});
test('Excel output has real zip/OOXML signature and named workbook sheets',async()=>{
  const bytes=new Uint8Array(await buildExport(fault,'fault','xlsx').blob.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0,4)),[0x50,0x4b,0x03,0x04]);
  const text=new TextDecoder().decode(bytes);
  assert.match(text,/xl\/workbook\.xml/);
  assert.match(text,/sheet name="Summary"/);
  assert.match(text,/sheet name="Telemetry"/);
  assert.match(text,/ECHO-BRAVO/);
});
test('clean scenario maintains PASS status and zero findings across formats',async()=>{
  const report=reportFor(clean,'clean');
  assert.equal(report.status,'PASS');assert.equal(report.findings.length,0);
  const md=await buildExport(clean,'clean','md').blob.text();
  assert.match(md,/QA status:\*\* PASS/);
});
test('Save As picker receives correct name/type, writes generated file and closes',async()=>{
  let opts,bytes,closed=false;
  const env={isSecureContext:true,async showSaveFilePicker(o){opts=o;return {async createWritable(){return {async write(blob){bytes=await blob.text()},async close(){closed=true;}}}}}};
  const result=await saveEvidence(fault,'fault','md',env);
  assert.equal(result.method,'picker');assert.equal(result.saved,true);
  assert.equal(opts.suggestedName,'Simulation_QA_Lab_ECHO01_QA_fault.md');
  assert.deepEqual(opts.types[0].accept,{'text/markdown':['.md']});
  assert.ok(bytes.includes('QA Evidence Report'));assert.equal(closed,true);
});
test('Cancel Save As leaves source data unchanged and writes nothing',async()=>{
  const original=JSON.stringify(fault);
  const env={isSecureContext:true,async showSaveFilePicker(){const e=new Error('User cancelled');e.name='AbortError';throw e;}};
  await assert.rejects(()=>saveEvidence(fault,'fault','xlsx',env),e=>e.name==='AbortError');
  assert.equal(JSON.stringify(fault),original);
});
test('reject unsupported export formats before accessing file system',()=>{
  assert.throws(()=>buildExport(fault,'fault','exe'),/Unsupported export format/);
  assert.rejects(()=>saveEvidence(fault,'fault','exe',{}),/Unknown export format/);
});
test('CSV preserves negative numeric coordinates and escapes formula-looking text',async()=>{
  const sample=structuredClone(clean);
  sample.events[0].lon=-17.714;
  sample.events[0].source='=HYPERLINK("https://example.invalid")';
  const csv=await buildExport(sample,'clean','csv').blob.text();
  assert.match(csv,/"-17\.714"/);
  assert.match(csv,/"'=HYPERLINK\(""https:\/\/example\.invalid""\)"/);
});
