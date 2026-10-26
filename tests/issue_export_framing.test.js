import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {issueFromRun,withFramedFaultMap} from '../app/issue_report.js';
const load=n=>JSON.parse(readFileSync(new URL(`../public/data/${n}.json`,import.meta.url),'utf8'));
const run=load('fault');
const issue=issueFromRun(run,'fault');
test('framing temporarily exposes both raw endpoints and restores original camera',async()=>{
 const original=JSON.stringify(run),events=[];let framed=false;
 const map={loaded(){return true;},getCenter(){return {lng:17.7,lat:49.5};},getZoom(){return 9;},getBearing(){return 0;},getPitch(){return 0;},
 getCanvas(){return {clientWidth:820,clientHeight:420};},project(){return framed?{x:260,y:170}:{x:-14,y:170};},
 once(event,callback){assert.equal(event,'idle');this.idle=callback;},
 fitBounds(bounds,opts){events.push(['fit',bounds,opts]);framed=true;queueMicrotask(()=>this.idle());},
 jumpTo(cam){events.push(['restore',cam]);framed=false;}};
 const result=await withFramedFaultMap(map,issue,async()=>{assert.equal(framed,true);return 'captured';});
 assert.equal(result,'captured');assert.equal(events[0][0],'fit');assert.equal(events[1][0],'restore');
 assert.equal(events[1][1].zoom,9);assert.equal(JSON.stringify(run),original);
});
test('capture failure still restores original camera',async()=>{
 let restored=false;const map={loaded(){return true;},getCenter(){return [17.7,49.5];},getZoom(){return 9;},getBearing(){return 0;},getPitch(){return 0;},
 getCanvas(){return {clientWidth:800,clientHeight:400};},project(){return {x:300,y:150};},jumpTo(){restored=true;}};
 await assert.rejects(()=>withFramedFaultMap(map,issue,async()=>{throw Error('capture failure');}),/capture failure/);
 assert.equal(restored,true);
});
