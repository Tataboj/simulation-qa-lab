import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from core.qa import check_run
from scripts.build_fixtures import generate

class TestScenario(unittest.TestCase):
    def test_clean_passes(self):
        run = generate(False)
        self.assertEqual(run['qa']['status'], 'PASS')
        self.assertEqual(run['qa']['findings'], [])
        self.assertEqual(run['qa']['checked'], 242)

    def test_fault_fails_with_one_reproducible_jump(self):
        run = generate(True)
        self.assertEqual(run['qa']['status'], 'FAIL')
        self.assertEqual(len(run['qa']['findings']), 1)
        f = run['qa']['findings'][0]
        self.assertEqual((f['rule'], f['entity_id'], f['current']['t']),
                         ('POSITION_JUMP', 'ECHO-BRAVO', 65))
        self.assertEqual(f['previous']['t'], 64)
        self.assertGreater(f['speed_kmh'], 90)

    def test_missing_coordinate_is_not_silently_defaulted(self):
        data = [{'entity_id': 'X', 't': 0, 'lon': 17, 'lat': 49},
                {'entity_id': 'X', 't': 1, 'lat': 49}]
        self.assertEqual(check_run(data)['findings'][0]['rule'], 'SCHEMA_REQUIRED')

    def test_time_reverse(self):
        data = [{'entity_id': 'X', 't': 2, 'lon': 17, 'lat': 49},
                {'entity_id': 'X', 't': 1, 'lon': 17, 'lat': 49}]
        self.assertEqual(check_run(data)['findings'][0]['rule'], 'TIME_ORDER')

    def test_per_entity_time_is_independent(self):
        data = [{'entity_id': 'A', 't': 4, 'lon': 17, 'lat': 49},
                {'entity_id': 'B', 't': 0, 'lon': 17, 'lat': 49},
                {'entity_id': 'A', 't': 5, 'lon': 17, 'lat': 49}]
        self.assertEqual(check_run(data)['status'], 'PASS')

    def test_invalid_coordinates_do_not_crash(self):
        data = [{'entity_id':'X','t':0,'lon':float('nan'),'lat':49}]
        self.assertEqual(check_run(data)['findings'][0]['rule'], 'SCHEMA_INVALID')

if __name__ == '__main__':
    unittest.main()
