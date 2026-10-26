"""Independent source-log validation tests for event causal order (synthetic)."""
import copy
import json
import unittest
from pathlib import Path
from core.qa import check_event_order_run

DATA=Path(__file__).resolve().parents[1]/'public'/'data'


def read(name):
    return json.loads((DATA/(name+'.json')).read_text(encoding='utf-8'))


class EventOrderQATests(unittest.TestCase):
    def setUp(self):
        self.reference=read('sequence_clean')
        self.fault=read('sequence_fault')

    def test_pass_vs_fault_and_original_movement_immutable(self):
        self.assertEqual(self.reference['qa']['status'], 'PASS')
        self.assertEqual(self.fault['qa']['status'], 'FAIL')
        self.assertEqual([f['rule'] for f in self.fault['qa']['findings']],['EVENT_ORDER_VIOLATION'])
        self.assertEqual(self.reference['events'],self.fault['events'])
        self.assertEqual(self.reference['events'],read('clean')['events'])
        self.assertEqual((self.fault['qa']['findings'][0]['objective_completed_t'], self.fault['qa']['findings'][0]['objective_start_t']), (35,45))

    def test_event_order_contract_is_unambiguous_and_has_no_speed_limit(self):
        result=check_event_order_run(self.fault['events'],self.fault['scenario_events'])
        finding=result['findings'][0]
        self.assertNotIn('expected_t',finding)
        self.assertNotIn('start_t',finding)
        self.assertNotIn('end_t',finding)
        self.assertNotIn('rule_max_speed_kmh',result)
        self.assertEqual((finding['objective_start_t'],finding['objective_completed_t'],finding['violation_t']),(45,35,35))
        self.assertEqual(finding['violation_t'],finding['current']['t'])
        self.assertEqual(finding['objective_start_t'],self.fault['scenario_events'][0]['t'])
        self.assertEqual(finding['objective_completed_t'],self.fault['scenario_events'][1]['t'])
        clean=check_event_order_run(self.reference['events'],self.reference['scenario_events'])
        self.assertNotIn('rule_max_speed_kmh',clean)
        self.assertEqual(clean['findings'],[])

    def test_equal_timestamps_rejected(self):
        events=copy.deepcopy(self.reference['scenario_events'])
        events[1]['t']=45
        result=check_event_order_run(self.reference['events'],events)
        self.assertEqual(result['findings'][0]['rule'],'EVENT_ORDER_VIOLATION')

    def test_missing_duplicate_and_invalid_event_rejected(self):
        source=self.reference['events']
        for events in ([],self.reference['scenario_events'][:1],
                       self.reference['scenario_events']+[self.reference['scenario_events'][-1]],
                       [{'event_type':'OBJECTIVE_STARTED','entity_id':'ECHO-ALPHA','t':45},
                        {'event_type':'OBJECTIVE_COMPLETED','entity_id':'ECHO-ALPHA','t':float('nan')}],
                       [{'event_type':'OBJECTIVE_STARTED','entity_id':'ECHO-BRAVO','t':45},
                        {'event_type':'OBJECTIVE_COMPLETED','entity_id':'ECHO-BRAVO','t':85}]):
            result=check_event_order_run(source,events)
            self.assertEqual(result['status'],'FAIL')
            self.assertEqual(result['findings'][0]['rule'],'EVENT_SEQUENCE_INVALID')

    def test_same_events_unmodified_after_validation(self):
        events=copy.deepcopy(self.fault['scenario_events'])
        original=copy.deepcopy(events)
        check_event_order_run(self.fault['events'],events)
        self.assertEqual(events,original)


if __name__=='__main__':unittest.main()
