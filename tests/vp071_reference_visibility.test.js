import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {REFERENCE_SCREEN_OFFSET_PX, REFERENCE_LAYER_IDS, referencePaint} from '../app/reference_style.js';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('reference is a display-only six-screen-pixel offset with correct day and night contrast',()=>{
  assert.equal(REFERENCE_SCREEN_OFFSET_PX,6);
  assert.deepEqual(REFERENCE_LAYER_IDS,['reference-halo','reference-path']);
  for(const day of [true,false]){
    const {halo,path}=referencePaint(day);
    assert.equal(halo['line-offset'],6); assert.equal(path['line-offset'],6);
    assert.deepEqual(halo['line-dasharray'],path['line-dasharray']);
    assert.ok(halo['line-width']>path['line-width'] && path['line-width']>=3.5);
    assert.equal(path['line-opacity'],1);
    assert.notEqual(halo['line-color'],path['line-color']);
  }
  assert.notEqual(referencePaint(true).path['line-color'],referencePaint(false).path['line-color']);
});

test('layer order: actual below outlined baseline below distance and invalid segment',()=>{
  const source=read('app/main.js');
  const at=id=>source.indexOf(`map.addLayer({id:'${id}'`);
  const layerIds=['actual-path','reference-halo','reference-path','distance-line','invalid-edge'];
  for(const id of layerIds)assert.ok(at(id)>=0,`missing ${id}`);
  for(let i=1;i<layerIds.length;i++)assert.ok(at(layerIds[i])>at(layerIds[i-1]),`${layerIds[i-1]} must be before ${layerIds[i]}`);
  assert.match(source,/source:'ref-lines',layout:\{'line-cap':'round','line-join':'round'\},paint:referenceStyle\.halo/);
  assert.match(source,/source:'ref-lines',layout:\{'line-cap':'round','line-join':'round'\},paint:referenceStyle\.path/);
});

test('checkbox controls both baseline layers, not the actual path or incident',()=>{
  const source=read('app/main.js');
  assert.match(source,/const referenceVisibility=\$\('layerReference'\)\.checked\?'visible':'none'/);
  assert.match(source,/for\(const id of REFERENCE_LAYER_IDS\) map\.setLayoutProperty\(id,'visibility',referenceVisibility\)/);
  assert.match(source,/\['actual-path','layerTrails'\]/);
  assert.match(source,/\['invalid-edge','layerFaults'\]/);
  assert.match(source,/setLayoutProperty\('distance-line','visibility'/);
  const html=read('index.html');
  assert.match(html,/<input id="layerReference" type="checkbox" checked/);
  assert.match(html,/Reference \(offset\)/);
  assert.match(html,/6 screen px for visibility; raw coordinates unchanged/);
});

test('day/night and map style reload restore both contrast colors and geometries',()=>{
  const source=read('app/main.js');
  assert.match(source,/map\.on\('style\.load',\(\)=> \{/);
  assert.match(source,/applyTheme\(\);redrawLayers\(\);render\(true\);/);
  assert.match(source,/setPaintProperty\('reference-halo', 'line-color', referenceStyle\.halo\['line-color'\]\)/);
  assert.match(source,/setPaintProperty\('reference-path', 'line-color', referenceStyle\.path\['line-color'\]\)/);
  assert.match(source,/map\.getSource\('ref-lines'\)\.setData\(collection\(expected\)\)/);
  assert.match(read('app/guide.js'),/6 SCREEN pixels/);
  assert.match(read('app/guide.js'),/raw positions, QA results and export evidence remain unchanged/);
});

test('unchanged four fixtures retain v0.6.3 identity; updated event-order cases preserve raw arrays',()=>{
  // Measured baseline SHA-256s are frozen from BatSim_VP06_3_v0.6.3 archive.
  const expected={
    'clean.json':'8b368aae17c5778853c1b1d03a385b426a909f78c52b22dfb7b44e95e705f6b5','fault.json':'5167dd5096330da3091656f253032b4b04265ce3e7ddb37a2d321e9ecfa1c7b8',
    'checkpoint_clean.json':'eb079d19bd7a850f8dc5500184a801a846d9609a93043638b16c0e0d70aea4a1','checkpoint_fault.json':'10f9cafec5efaf96b1457b7d70711c419396e6801f39968ffd1be0b85e5cf179',

  };
  assert.deepEqual(readdirSync(new URL('../public/data/',import.meta.url)).sort(),[...Object.keys(expected),'sequence_clean.json','sequence_fault.json'].sort());
  for(const [filename,hash] of Object.entries(expected)){
    const observed=createHash('sha256').update(readFileSync(new URL('../public/data/'+filename,import.meta.url))).digest('hex');
    assert.equal(observed,hash,`${filename} source fixture modified`);
  }
  // Event-order fixtures now contain corrected QA metadata, so whole-file hashes change.
  // Preserve a frozen hash of ONLY authoritative source arrays instead.
  const sourceHashes = {
    'sequence_clean.json':{events:'b3b73a4a7784148f18d3f7299fb7afa858c7a5423614d06da5912e3025b59b66',scenario_events:'543f20a7c1505a3e7910a909d588bda9dac90bfce067df7a6d52671b6fe5d59a'},
    'sequence_fault.json':{events:'b3b73a4a7784148f18d3f7299fb7afa858c7a5423614d06da5912e3025b59b66',scenario_events:'a410582ccfb0502511c44dd12e859b583cf2de84d53498d64d943a0e0a748a24'}
  };
  for(const [filename,keys] of Object.entries(sourceHashes)){
    const run=JSON.parse(read('public/data/'+filename));
    for(const [key,hash] of Object.entries(keys)){
      // Canonical serialization matches the frozen independent Python SHA-256 baseline.
      const json=JSON.stringify(run[key],(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
      assert.equal(createHash('sha256').update(json).digest('hex'),hash,filename+' '+key);
    }
  }
});

test('current candidate version matches UI and evidence metadata',()=>{
 const version=JSON.parse(read('package.json')).version;
 assert.ok(read('app/issue_report.js').includes(`APP_VERSION='${version}'`));
 assert.ok(read('index.html').includes(`v${version}`));
 assert.ok(read('README.md').includes(version));
});
