"""VP-04 independently verifies the raw checkpoint-event contract."""
import copy
import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from core.qa import check_checkpoint_run
from scripts.build_fixtures import generate_checkpoint

class TestCheckpointEvents(unittest.TestCase):
    def test_clean_passes_and_fault_is_missing_event_at_t58(self):
        clean=generate_checkpoint(False);fault=generate_checkpoint(True)
        self.assertEqual(clean['qa']['status'],'PASS')
        self.assertEqual(clean['qa']['findings'],[])
        self.assertEqual(fault['qa']['status'],'FAIL')
        self.assertEqual(len(fault['qa']['findings']),1)
        f=fault['qa']['findings'][0]
        self.assertEqual((f['rule'],f['entity_id'],f['expected_t']),('CHECKPOINT_EVENT_MISSING','ECHO-ALPHA',58))
        self.assertEqual(clean['events'],fault['events'])
        self.assertEqual(len(fault['events']),242)
    def test_wrong_entity_or_checkpoint_never_satisfies_trigger(self):
        run=generate_checkpoint(False)
        for change in ({'entity_id':'ECHO-BRAVO'},{'checkpoint_id':'CP-WRONG'},
                       {'event_type':'CHECKPOINT_EXIT'},{'t':57},{'t':60},{'t':float('nan')}):
            with self.subTest(change=change):
                events=copy.deepcopy(run['scenario_events'])
                events[0].update(change)
                result=check_checkpoint_run(run['events'],events,run['checkpoint'])
                self.assertEqual(result['findings'][0]['rule'],'CHECKPOINT_EVENT_MISSING')
    def test_event_one_second_after_entry_is_accepted(self):
        run=generate_checkpoint(False)
        events=copy.deepcopy(run['scenario_events']);events[0]['t']=59
        self.assertEqual(check_checkpoint_run(run['events'],events,run['checkpoint'])['status'],'PASS')
    def test_duplicate_trigger_cannot_be_silently_accepted(self):
        run=generate_checkpoint(False)
        events=run['scenario_events']*2
        result=check_checkpoint_run(run['events'],events,run['checkpoint'])
        self.assertEqual(result['findings'][0]['rule'],'CHECKPOINT_EVENT_DUPLICATE')
    def test_missing_entry_is_not_reported_as_missing_event(self):
        run=generate_checkpoint(False)
        far=copy.deepcopy(run['checkpoint']);far['lat']+=0.2
        result=check_checkpoint_run(run['events'],run['scenario_events'],far)
        self.assertEqual(result['findings'][0]['rule'],'CHECKPOINT_NOT_REACHED')

if __name__=='__main__':unittest.main()
