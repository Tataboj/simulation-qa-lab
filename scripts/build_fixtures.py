"""Generate reproducible reference / fault cases and independently evaluated QA results."""
from __future__ import annotations
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from core.qa import check_run, check_checkpoint_run, distance_m

PUBLIC = ROOT / 'public' / 'data'
PUBLIC.mkdir(parents=True, exist_ok=True)


def position(entity: str, t: int) -> tuple[float, float]:
    if entity == 'ECHO-ALPHA':
        return 17.714 + .000057*t + .00008*math.sin(t/17), 49.560 + .000018*t + .00007*math.sin(t/22)
    return 17.728 + .000042*t + .00010*math.sin(t/20), 49.578 - .000016*t + .000045*math.cos(t/16)


def generate(fault: bool) -> dict:
    samples = []
    for t in range(121):
        for entity in ('ECHO-ALPHA', 'ECHO-BRAVO'):
            lon, lat = position(entity, t)
            if fault and entity == 'ECHO-BRAVO' and t >= 65:
                lon += .0125
                lat += .006
            samples.append({'entity_id': entity, 't': t, 'lon': round(lon, 8),
                            'lat': round(lat, 8), 'source': 'SYNTHETIC_REPLAY'})
    return {'scenario_id': 'ECHO-01', 'variant': 'fault' if fault else 'clean',
            'description': 'Fictional training exercise; trajectories are synthetic, not real-world telemetry.',
            'duration_s': 120, 'events': samples, 'qa': check_run(samples)}


def main() -> None:
    for variant in (False, True):
        run = generate(variant)
        path = PUBLIC / ('fault.json' if variant else 'clean.json')
        path.write_text(json.dumps(run, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'{path.name}: {run["qa"]["status"]}, {run["qa"]["checked"]} samples, '
              f'{len(run["qa"]["findings"])} finding(s)')



# VP-04 standalone fixtures; old clean/fault remain untouched.
def generate_checkpoint(fault: bool) -> dict:
    original=generate(False)
    entity='ECHO-ALPHA';crossing_t=60
    lon,lat=position(entity,crossing_t)
    checkpoint={'id':'CP-ALPHA','entity_id':entity,'lat':round(lat,8),'lon':round(lon,8),
                'radius_m':12.0,'event_tolerance_s':1}
    samples=[e for e in original['events'] if e['entity_id']==entity]
    entry=next(s['t'] for p,s in zip(samples,samples[1:]) if
               distance_m(p,checkpoint)>12 and distance_m(s,checkpoint)<=12)
    events=[] if fault else [{'event_type':'CHECKPOINT_ENTER','checkpoint_id':'CP-ALPHA',
                              'entity_id':entity,'t':entry,'source':'SYNTHETIC_EVENT_LOG'}]
    return {'scenario_id':'ECHO-CP01','variant':'checkpoint_fault' if fault else 'checkpoint_clean',
            'description':'Fictional checkpoint trigger validation; all units and events synthetic.',
            'duration_s':120,'events':original['events'],'scenario_events':events,
            'checkpoint':checkpoint,
            'qa':check_checkpoint_run(original['events'],events,checkpoint)}


def write_checkpoint_fixtures() -> None:
    for fault in (False,True):
        run=generate_checkpoint(fault)
        filename='checkpoint_fault.json' if fault else 'checkpoint_clean.json'
        (PUBLIC/filename).write_text(json.dumps(run,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(f'{filename}: {run["qa"]["status"]}, {len(run["qa"]["findings"])} finding(s)')

if __name__ == '__main__':
    main()
    write_checkpoint_fixtures()
