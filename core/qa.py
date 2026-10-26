"""QA rules: operate on raw samples, never on interpolated render positions."""
from __future__ import annotations

import math
from collections import defaultdict
from typing import Any

REQUIRED_FIELDS = ('entity_id', 't', 'lon', 'lat')
MAX_SPEED_KMH = 90.0  # Exercise ECHO-01 testing contract, NOT a vehicle physics claim
EARTH_RADIUS_M = 6_371_000.0


def distance_m(a: dict, b: dict) -> float:
    lat1, lat2 = math.radians(a['lat']), math.radians(b['lat'])
    dlat = lat2 - lat1
    dlon = math.radians(b['lon'] - a['lon'])
    h = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(h)))


def check_run(samples: list[dict[str, Any]]) -> dict:
    """Validate original arrival order per entity; preserve evidence in findings."""
    findings = []
    previous: dict[str, dict] = {}
    for index, sample in enumerate(samples):
        missing = [key for key in REQUIRED_FIELDS if key not in sample or sample[key] is None]
        if missing:
            findings.append({'rule': 'SCHEMA_REQUIRED', 'index': index,
                             'entity_id': sample.get('entity_id', 'UNKNOWN'),
                             'message': f'Missing required: {", ".join(missing)}',
                             'previous': None, 'current': sample, 'speed_kmh': None})
            continue
        if (not isinstance(sample['t'], (int, float)) or isinstance(sample['t'], bool)
            or any(not isinstance(sample[key], (int, float)) or isinstance(sample[key], bool)
                   or not math.isfinite(sample[key]) for key in ('t','lon','lat'))
            or not (-180 <= sample['lon'] <= 180) or not (-90 <= sample['lat'] <= 90)
            or not isinstance(sample['entity_id'], str) or not sample['entity_id']):
            findings.append({'rule': 'SCHEMA_INVALID', 'index': index,
                             'entity_id': str(sample.get('entity_id', 'UNKNOWN')),
                             'message': 'Invalid coordinate, time, or entity identifier',
                             'previous': None, 'current': sample, 'speed_kmh': None})
            continue
        entity = sample['entity_id']
        prev = previous.get(entity)
        if prev is not None:
            dt = sample['t'] - prev['t']
            if dt <= 0:
                findings.append({'rule': 'TIME_ORDER', 'index': index,
                                 'entity_id': entity, 'message': 'Timestamp not increasing',
                                 'previous': prev, 'current': sample, 'speed_kmh': None})
            else:
                speed = distance_m(prev, sample) / dt * 3.6
                if speed > MAX_SPEED_KMH:
                    findings.append({'rule': 'POSITION_JUMP', 'index': index,
                                     'entity_id': entity,
                                     'message': f'{speed:.1f} km/h exceeds scenario limit {MAX_SPEED_KMH:.0f} km/h',
                                     'previous': prev, 'current': sample,
                                     'speed_kmh': round(speed, 2)})
        previous[entity] = sample
    return {'status': 'PASS' if not findings else 'FAIL', 'rule_max_speed_kmh': MAX_SPEED_KMH,
            'checked': len(samples), 'findings': findings}


# VP-04: independent scenario logic check. The event log is independent of movement
# samples: missing events must never be inferred from visually interpolated paths.
def check_checkpoint_run(samples: list[dict[str, Any]], scenario_events: list[dict[str, Any]],
                         checkpoint: dict[str, Any]) -> dict:
    """Require one CHECKPOINT_ENTER event at the first raw transition into zone."""
    telemetry=check_run(samples)
    findings=list(telemetry['findings'])
    cid=checkpoint['id'];entity=checkpoint['entity_id']
    radius=checkpoint['radius_m'];tolerance=checkpoint.get('event_tolerance_s',1)
    if not isinstance(cid,str) or not cid or not isinstance(entity,str) or not entity:
        raise ValueError('Valid checkpoint ID and entity required')
    if not isinstance(radius,(int,float)) or not math.isfinite(radius) or radius<=0:
        raise ValueError('Positive finite checkpoint radius required')
    target={'lat':checkpoint['lat'],'lon':checkpoint['lon']}
    if any(not isinstance(target[k],(int,float)) or not math.isfinite(target[k]) for k in ('lat','lon')):
        raise ValueError('Finite checkpoint location required')
    matching=[s for s in samples if s.get('entity_id')==entity and all(k in s for k in ('lat','lon','t'))]
    valid=[s for s in matching if all(isinstance(s[k],(int,float)) and math.isfinite(s[k]) for k in ('lat','lon','t'))]
    transition=None
    # Input is already ordered by original arrival order; never sort to hide TIME_ORDER issues.
    for previous,current in zip(valid,valid[1:]):
        if current['t']<=previous['t']:continue
        if distance_m(previous,target)>radius and distance_m(current,target)<=radius:
            transition=(previous,current);break
    if transition is None:
        findings.append({'rule':'CHECKPOINT_NOT_REACHED','entity_id':entity,
                         'checkpoint_id':cid,'message':'No raw entry transition into required checkpoint',
                         'previous':valid[-1] if valid else None,'current':valid[-1] if valid else None,
                         'speed_kmh':None})
    else:
        prev,curr=transition
        valid_events=[e for e in scenario_events if e.get('event_type')=='CHECKPOINT_ENTER'
                      and e.get('checkpoint_id')==cid and e.get('entity_id')==entity
                      and isinstance(e.get('t'),(int,float)) and not isinstance(e['t'],bool)
                      and math.isfinite(e['t']) and curr['t']<=e['t']<=curr['t']+tolerance]
        if len(valid_events)!=1:
            missing=len(valid_events)==0
            findings.append({'rule':'CHECKPOINT_EVENT_MISSING' if missing else 'CHECKPOINT_EVENT_DUPLICATE',
                             'entity_id':entity,'checkpoint_id':cid,
                             'expected_event':'CHECKPOINT_ENTER','expected_t':curr['t'],
                             'observed_t':None if missing else [e['t'] for e in valid_events],
                             'message':(f'{entity} entered {cid} at T+{curr["t"]:g}s, but CHECKPOINT_ENTER was not recorded' if missing else f'{entity} entered {cid} at T+{curr["t"]:g}s; expected one CHECKPOINT_ENTER, observed {len(valid_events)} valid event(s)'),
                             'previous':prev,'current':curr,'speed_kmh':None})
    return {'status':'FAIL' if findings else 'PASS',
            'checked':len(samples),'findings':findings,'rule_max_speed_kmh':MAX_SPEED_KMH,
            'event_checked':len(scenario_events),'checkpoint_id':cid}


# VP-05: test causal event ordering from the original event log.
# Times in the source log are authoritative. Rendering and arrival order
# must not silently correct a completion recorded before its start.
def check_event_order_run(samples: list[dict[str, Any]], scenario_events: list[dict[str, Any]],
                          entity_id: str = 'ECHO-ALPHA') -> dict:
    """Require exactly one START then one COMPLETE event, in simulation time."""
    baseline = check_run(samples)
    findings = list(baseline['findings'])
    start_type, end_type = 'OBJECTIVE_STARTED', 'OBJECTIVE_COMPLETED'
    relevant = [e for e in scenario_events if e.get('entity_id') == entity_id and
                e.get('event_type') in (start_type, end_type)]
    starts = [e for e in relevant if e['event_type'] == start_type]
    ends = [e for e in relevant if e['event_type'] == end_type]
    valid = lambda e: isinstance(e.get('t'), (int, float)) and not isinstance(e['t'], bool) and math.isfinite(e['t'])
    if len(starts) != 1 or len(ends) != 1 or not all(map(valid, relevant)):
        rule='EVENT_SEQUENCE_INVALID'
        message=f'Expected exactly one finite {start_type} and one {end_type} for {entity_id}'
        failure_t=next((e['t'] for e in relevant if valid(e)), 0)
        start_t=next((e['t'] for e in starts if valid(e)), None)
        end_t=next((e['t'] for e in ends if valid(e)), None)
    elif ends[0]['t'] <= starts[0]['t']:
        rule='EVENT_ORDER_VIOLATION'
        start_t, end_t = starts[0]['t'], ends[0]['t']
        failure_t=end_t
        message=f'{end_type} at T+{end_t:g}s precedes or equals {start_type} at T+{start_t:g}s'
    else:
        rule=None
    if rule:
        original=[e for e in samples if e.get('entity_id')==entity_id and isinstance(e.get('t'),(int,float))]
        # Point marker at the time the invalid event was recorded. This source
        # sample is visual context; the actual QA oracle is the event log.
        current=min(original,key=lambda e:abs(e['t']-failure_t)) if original else None
        previous=original[max(0,original.index(current)-1)] if current else None
        findings.append({'rule':rule,'entity_id':entity_id,'expected_event':end_type,
                         'objective_start_t':start_t,'objective_completed_t':end_t,'violation_t':failure_t,
                         'message':message,'previous':previous,'current':current,
                         'speed_kmh':None})
    return {'status':'FAIL' if findings else 'PASS','checked':len(samples),
            'findings':findings,
            'event_checked':len(scenario_events)}
