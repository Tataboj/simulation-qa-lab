import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {positionAt,invalidEdgeSet,heading} from '../app/replay.js';
const a={entity_id:'ECHO-BRAVO',t:64,lon:17.7,lat:49.5};
const b={entity_id:'ECHO-BRAVO',t:65,lon:17.8,lat:49.6};
const c={entity_id:'ECHO-BRAVO',t:66,lon:17.80001,lat:49.60001};
const run={qa:{findings:[{rule:'POSITION_JUMP',entity_id:'ECHO-BRAVO',current:b}]}};
test('no smoothing over QA-invalid edge',()=>{
  const broken=invalidEdgeSet(run,'ECHO-BRAVO');
  assert.equal(positionAt([a,b,c],64.5,broken).lon,a.lon);
  assert.equal(positionAt([a,b,c],64.5,broken).heldForInvalidEdge,true);
  assert.equal(positionAt([a,b,c],65,broken).lon,b.lon);
});
test('valid edges interpolate, originals remain intact',()=>{
  const originals=JSON.stringify([a,b,c]);
  const p=positionAt([a,b,c],65.5,new Set());
  assert.equal(p.lon,(b.lon+c.lon)/2);
  assert.equal(p.interpolated,true);
  assert.equal(JSON.stringify([a,b,c]),originals);
});
test('heading remains finite immediately after flagged transition',()=>{
  assert.equal(Number.isFinite(heading([a,b,c],64.5,new Set([65]))),true);
});
