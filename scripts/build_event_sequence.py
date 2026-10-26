"""Build VP-05 fixtures without touching any pre-existing baseline evidence."""
from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from scripts.build_fixtures import generate
from core.qa import check_event_order_run


def generate_sequence(fault: bool) -> dict:
    raw=generate(False)['events']
    source=[{'entity_id':'ECHO-ALPHA','event_type':'OBJECTIVE_STARTED',
             't':45,'source':'SYNTHETIC_EVENT_LOG'},
            {'entity_id':'ECHO-ALPHA','event_type':'OBJECTIVE_COMPLETED',
             't':35 if fault else 85,'source':'SYNTHETIC_EVENT_LOG'}]
    return {'scenario_id':'ECHO-EV01','variant':'sequence_fault' if fault else 'sequence_clean',
            'description':'Fictional mission event-order validation. Original movement samples are unchanged.',
            'duration_s':120,'events':raw,'scenario_events':source,
            'qa':check_event_order_run(raw,source)}


def main() -> None:
    for fault in (False,True):
        name='sequence_fault.json' if fault else 'sequence_clean.json'
        run=generate_sequence(fault)
        path=ROOT/'public'/'data'/name
        path.write_text(json.dumps(run,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(name,run['qa']['status'],len(run['qa']['findings']))

if __name__=='__main__':main()
