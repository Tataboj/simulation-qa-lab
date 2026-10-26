#!/usr/bin/env python3
"""Independent release check of the six shipped synthetic source fixtures.

Read-only: validates published QA verdicts by recomputing from original raw data.
No browser/map interpolation, no live feeds and no fixture regeneration.
"""
import copy
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from core.qa import check_run, check_checkpoint_run, check_event_order_run

CASES = (
    ('movement', 'clean', 'PASS', None, 0),
    ('movement', 'fault', 'FAIL', 'POSITION_JUMP', 65),
    ('checkpoint', 'checkpoint_clean', 'PASS', None, 0),
    ('checkpoint', 'checkpoint_fault', 'FAIL', 'CHECKPOINT_EVENT_MISSING', 58),
    ('sequence', 'sequence_clean', 'PASS', None, 0),
    ('sequence', 'sequence_fault', 'FAIL', 'EVENT_ORDER_VIOLATION', 35),
)


def recompute(group, run):
    data = copy.deepcopy(run['events'])
    if group == 'movement':
        result = check_run(data)
    elif group == 'checkpoint':
        result = check_checkpoint_run(data, copy.deepcopy(run['scenario_events']), copy.deepcopy(run['checkpoint']))
    else:
        result = check_event_order_run(data, copy.deepcopy(run['scenario_events']))
    if data != run['events']:
        raise AssertionError('QA mutated original raw telemetry')
    return result


def main():
    failures = []
    data_by_name = {}
    print('VP-08 | SIX SOURCE FIXTURES | INDEPENDENT QA RECOMPUTATION')
    for group, filename, expected_status, expected_rule, expected_t in CASES:
        path = ROOT / 'public' / 'data' / (filename + '.json')
        raw = path.read_bytes()
        fixture = json.loads(raw)
        data_by_name[filename] = fixture
        try:
            result = recompute(group, fixture)
            assert result == fixture['qa'], 'Recomputed QA differs from stored QA evidence'
            assert fixture['variant'] == filename, 'Unexpected fixture identity'
            assert result['status'] == expected_status, f'Expected {expected_status}'
            assert len(fixture['events']) == result['checked'] == 242, 'Expected 242 raw telemetry samples'
            assert len(result['findings']) == (1 if expected_rule else 0), 'Wrong finding count'
            if expected_rule:
                finding = result['findings'][0]
                assert finding['rule'] == expected_rule, 'Wrong finding rule'
                t = (finding.get('violation_t') if group == 'sequence'
                     else finding.get('expected_t') if group == 'checkpoint'
                     else finding.get('current', {}).get('t'))
                assert t == expected_t, f'Wrong incident time: {t}'
                if group == 'sequence':
                    assert 'expected_t' not in finding, 'Ambiguous expected_t still present'
                    assert 'rule_max_speed_kmh' not in result, 'Unrelated speed metadata still present'
                    assert finding['objective_start_t'] == 45
                    assert finding['objective_completed_t'] == 35
            print(f'PASS | {group:<10} | {filename:<19} | {expected_status:<4} | sha256={hashlib.sha256(raw).hexdigest()[:16]}...')
        except (AssertionError, KeyError, TypeError, ValueError) as err:
            failures.append(f'{filename}: {err}')
            print(f'FAIL | {filename}: {err}', file=sys.stderr)
    for first, second in [('checkpoint_clean','checkpoint_fault'),('sequence_clean','sequence_fault')]:
        try:
            assert data_by_name[first]['events'] == data_by_name[second]['events'], f'{first}/{second}: raw movement changed'
            print(f'PASS | telemetry immutable between {first} / {second}')
        except AssertionError as err:
            failures.append(str(err))
    if failures:
        print(f'VP08_SCENARIO_GATE=FAIL | failures={len(failures)}', file=sys.stderr)
        return 1
    print('VP08_SCENARIO_GATE=PASS | 6/6 source scenarios | 2/2 movement invariance checks')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
