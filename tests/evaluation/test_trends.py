"""History must not turn interrupted or untrusted runs into improvements."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scoring import summarize
from test_reporting import report
from trends import baseline_indices, build_overview, metric_result, overview, unit_result


def measured(run_id='one'):
    data = report(run_id)
    data['checks'] = [dict(id=name, category='function', status='PASS', score=100,
                           counts=dict(tests=10, passed=10, failed=0, skipped=0))
                      for name in ('web-unit', 'input-unit', 'backend-unit')]
    data['checks'].append(dict(id='games-benchmark', category='performance', status='PASS', score=100))
    data['metrics'] = [dict(name='snake', value=.05, budget=16.67, score=100, unit='ms')]
    data['summary'] = summarize(data, dict(score=8))
    return data


class TrendTests(unittest.TestCase):
    def test_publication_checks_do_not_become_fom_or_unit_measurements(self):
        current = measured()
        original = copy.deepcopy(current)
        with tempfile.TemporaryDirectory() as directory, patch('trend_plots.plots', return_value=set()):
            root = Path(directory)
            publication = dict(date='2026-11-04', commit='abc12345',
                checks=[dict(area='Browser', result='45/46', detail='One retained failure')],
                deviation='Known failure approved', limitations='No new FoM', report='deployment.md')
            (root / 'publication.json').write_text(json.dumps(publication))
            document = overview(root, [current])
            self.assertIn('separat fra FoM', document)
            self.assertIn('45/46', document)
            self.assertIn('Known failure approved', (root / 'overview.md').read_text())
            self.assertEqual(current, original)
            self.assertEqual(build_overview([current])['latest']['summary']['fom'], 96)

    def test_archived_baseline_is_reference_not_an_extra_fom_point(self):
        current, archive = measured(), measured('archive')
        archive['environment'] = {'cpu': 'Different machine'}
        archive['summary'] = summarize(archive)
        archive['metrics'][0]['value'] = .04
        with tempfile.TemporaryDirectory() as directory, patch('trend_plots.plots', return_value=set()) as charts:
            root = Path(directory)
            path = root / 'baseline-summary-2026-10-30.json'
            path.write_text(json.dumps(archive))
            original = path.read_bytes()
            document = overview(root, [current])
            self.assertIn('Arkivbaseline p95 ms', document)
            self.assertIn('0,0400', document)
            self.assertIn('Different machine', document)
            self.assertEqual(charts.call_args.args[1], [current])
            self.assertEqual(path.read_bytes(), original)
            self.assertEqual(build_overview([current])['latest'], current)

    def test_only_complete_fom_can_be_baseline_and_each_series_has_its_own(self):
        blocked, first, second, other = [measured(str(i)) for i in range(4)]
        blocked['checks'].append(dict(id='interrupted', category='function', status='BLOCKED', score=None))
        blocked['summary'] = summarize(blocked, dict(score=5))
        other['series'] = 'different'
        self.assertEqual(baseline_indices([blocked, first, second, other]), {1, 3})
        overview_data = build_overview([blocked, first])
        self.assertIn('bare én komplett', overview_data['message'])
        self.assertIn('96,00', overview_data['message'])
        self.assertIsNone(blocked['summary']['fom'])

    def test_partial_run_can_retain_completed_groups_but_bad_selftest_cannot(self):
        data = measured()
        data['checks'].append(dict(id='interrupted', category='function', status='BLOCKED', score=None))
        data['summary'] = summarize(data)
        self.assertTrue(unit_result(data)['valid'])
        self.assertTrue(metric_result(data, 'snake')['valid'])
        data['selftest'] = 'FAIL'
        self.assertFalse(unit_result(data)['valid'])
        self.assertFalse(metric_result(data, 'snake')['valid'])
        self.assertEqual(metric_result(data, 'snake')['metric']['value'], .05)

    def test_missing_group_is_not_zero_or_a_valid_measurement(self):
        data = measured()
        data['checks'] = data['checks'][1:]
        self.assertFalse(unit_result(data)['valid'])
        data['checks'][-1]['status'] = 'BLOCKED'
        self.assertFalse(metric_result(data, 'snake')['valid'])
        self.assertIsNone(metric_result(data, 'tetris')['metric'])

    def test_unit_counts_exclude_firmware_integration_and_keep_failures(self):
        data = measured()
        data['checks'].append(dict(id='firmware', category='function', status='PASS', score=100,
                                   counts=dict(tests=3, passed=3, failed=0, skipped=0)))
        data['checks'][0].update(status='FAIL', score=80, counts=dict(tests=10, passed=8, failed=1, skipped=1))
        result = unit_result(data)
        self.assertTrue(result['valid'])
        self.assertEqual((result['tests'], result['passed'], result['failed'], result['skipped']), (30, 28, 1, 1))

    def test_overview_is_read_only_and_does_not_link_stale_charts_without_plot_library(self):
        data = measured()
        data['label'] = '<script>unsafe</script>'
        original = copy.deepcopy(data)
        with tempfile.TemporaryDirectory() as directory, patch('trend_plots.plots', return_value=set()):
            root = Path(directory)
            (root / 'fom-development.svg').write_text('old image')
            document = overview(root, [data])
            self.assertNotIn('src="fom-development.svg"', document)
            self.assertIn('&lt;script&gt;unsafe&lt;/script&gt;', document)
            self.assertTrue((root / 'overview.md').is_file())
            self.assertEqual(data, original)


if __name__ == '__main__':
    unittest.main()
