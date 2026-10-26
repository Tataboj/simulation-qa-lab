/** Pure replay math.  Never rewrite raw input samples or smooth flagged edges. */
export function invalidEdgeSet(run,id){
  return new Set(run.qa.findings.filter(f=>f.entity_id===id && f.rule==='POSITION_JUMP').map(f=>f.current.t));
}
export function positionAt(list,t,invalid){
  if(!list.length)return null;
  if(t<=list[0].t)return {...list[0],interpolated:false};
  if(t>=list[list.length-1].t)return {...list[list.length-1],interpolated:false};
  // Search by timestamp rather than assuming that t equals the array index.
  let lo=0,hi=list.length-1;
  while(lo+1<hi){const mid=(lo+hi)>>1;if(list[mid].t<=t)lo=mid;else hi=mid;}
  const a=list[lo],b=list[lo+1];
  if(Math.abs(t-a.t)<1e-6)return {...a,interpolated:false};
  if(invalid.has(b.t))return {...a,interpolated:false,heldForInvalidEdge:true};
  const frac=(t-a.t)/(b.t-a.t);
  return {...a,t,lon:a.lon+(b.lon-a.lon)*frac,lat:a.lat+(b.lat-a.lat)*frac,interpolated:true};
}
export function heading(list,t,invalid){
  let k=0; while(k<list.length-2 && list[k+1].t<=t)k++;
  let a=list[k],b=list[k+1];
  if(invalid.has(b.t)){a=list[Math.min(k+1,list.length-2)];b=list[Math.min(k+2,list.length-1)];}
  return Math.atan2((b.lon-a.lon)*Math.cos(a.lat*Math.PI/180),b.lat-a.lat)*180/Math.PI;
}
