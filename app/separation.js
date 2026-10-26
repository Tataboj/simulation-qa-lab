/** Replay-only horizontal great-circle distance (WGS84); NOT a road route or a QA source field. */
import {invalidEdgeSet, positionAt} from './replay.js';
export const EARTH_RADIUS_M = 6371008.8;
export function distanceMeters(a,b){
  if(!a||!b) return null;
  const lat1=a.lat,lat2=b.lat,lon1=a.lon,lon2=b.lon;
  if(![lat1,lat2,lon1,lon2].every(v=>typeof v==='number'))return null;
  if(![lat1,lat2,lon1,lon2].every(Number.isFinite)||Math.abs(lat1)>90||Math.abs(lat2)>90||Math.abs(lon1)>180||Math.abs(lon2)>180)return null;
  const rad=Math.PI/180;
  const dphi=(lat2-lat1)*rad, dlambda=(lon2-lon1)*rad;
  const h=Math.sin(dphi/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dlambda/2)**2;
  return 2*EARTH_RADIUS_M*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function distanceText(m){
  if(m===null||!Number.isFinite(m)||m<0)return '—';
  return m<1000 ? `${Math.round(m)} m` : `${(m/1000).toFixed(2)} km`;
}
export function replaySeparation(run, time, first='ECHO-ALPHA', second='ECHO-BRAVO'){
  if(!run||!Array.isArray(run.events))return null;
  const a=positionAt(run.events.filter(e=>e.entity_id===first),time,invalidEdgeSet(run,first));
  const b=positionAt(run.events.filter(e=>e.entity_id===second),time,invalidEdgeSet(run,second));
  const meters=distanceMeters(a,b);
  if(meters===null)return null;
  return {a,b,meters,text:distanceText(meters), held:Boolean(a.heldForInvalidEdge||b.heldForInvalidEdge), interpolated:Boolean(a.interpolated||b.interpolated)};
}
