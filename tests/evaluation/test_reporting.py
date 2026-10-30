"""Offline reports combine automatic measurements and guided user feedback."""
import copy
from html.parser import HTMLParser
from pathlib import Path
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parent))
from reporting import chart, load_runs, render, review_html, review_text, save_json
from scoring import POLICY, summarize


def report(run_id):
    return dict(id=run_id, timestamp='2026-10-30T12:00:00Z', label='Baseline',
                profile='local-core', series='same', commit='abc', dirty=True,
                source_digest='source', policy=POLICY, selftest='PASS',
                limitations=['Ingen fysisk USB'], metrics=[],
                checks=[dict(id='unit', category='function', status='PASS', score=100, log='unit.log'),
                        dict(id='speed', category='performance', status='PASS', score=80, log='speed.log')])


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.targets = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == 'a' and attributes.get('target') == '_top':
            self.targets.append(attributes['href'])


class CombinedReportTests(unittest.TestCase):
    def test_stored_policy_controls_formula_inputs_and_contributions(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / 'runs' / 'historic'
            folder.mkdir(parents=True)
            data = report('historic')
            data['policy'] = copy.deepcopy(POLICY)
            data['policy']['weights'] = dict(function=.6, performance=.1, ux=.3)
            data['checks'] += [dict(id='cross-component', category='function', status='FAIL', score=50, log='cross.log'),
                               dict(id='games-benchmark', category='performance', status='FAIL', score=40, log='games.log')]
            save_json(folder / 'report.json', data)
            save_json(folder / 'feedback-1.json', dict(timestamp='now', reviewer='Team', score=7, comment='Observations'))
            render(root)
            document = (folder / 'report.html').read_text(encoding='utf-8')
            self.assertIn('60 % × F + 10 % × P + 30 % × U', document)
            self.assertIn('(100.00 + 50.00) / 2 = 75.00', document)
            self.assertIn('(80.00 + 40.00) / 2 = 60.00', document)
            self.assertIn('7/10 × 10 = 70.00', document)
            for value in ('45.00', '6.00', '21.00'):
                self.assertIn(f'<td>{value}</td>', document)
            self.assertIn('FoM 72.00', document)
            self.assertEqual(load_runs(root)[0]['summary']['fom'], 72)
            index = (root / 'index.html').read_text(encoding='utf-8')
            for heading in ('F / 100', 'P / 100', 'U / 100'):
                self.assertIn(heading, index)
            self.assertEqual(POLICY['weights'], dict(function=.5, performance=.3, ux=.2))

    def test_distinct_sections_retain_failed_benchmarks_and_selftest_diagnostics(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / 'runs' / 'run-1'
            folder.mkdir(parents=True)
            data = report('run-1')
            data.update(selftest='FAIL', selftest_detail='Selftest assertions failed', selftest_log='evaluation-selftest.log')
            data['checks'] = [dict(id='web-unit', category='function', status='PASS', score=100, log='unit.log'),
                dict(id='cross-component', category='function', status='FAIL', score=75, log='cross.log'),
                dict(id='platform-capacity', category='function', status='FAIL', score=0, log='platform-benchmark.log'),
                dict(id='games-benchmark', category='performance', status='FAIL', score=50, log='games-benchmark.log'),
                dict(id='input-benchmark', category='performance', status='BLOCKED', score=None, log='input-benchmark.log')]
            save_json(folder / 'report.json', data)
            save_json(folder / 'games-benchmark.json', {'measurements': []})
            (folder / 'games-benchmark.log').write_text('OLD_DIAGNOSTIC_PREFIX' + 'x' * 6000 + 'AssertionError: <failed>', encoding='utf-8')
            (folder / 'input-benchmark.log').write_text('Dependency missing <runtime>', encoding='utf-8')
            (folder / 'evaluation-selftest.log').write_text('A selftest <assertion> failed', encoding='utf-8')
            render(root)
            document = (folder / 'report.html').read_text(encoding='utf-8')
            sections = {name: document.split(f'<section id="{name}"', 1)[1].split('</section>', 1)[0]
                        for name in ('unit-tests', 'functional-tests', 'benchmarks', 'ux', 'diagnostics')}
            self.assertIn('check-web-unit', sections['unit-tests'])
            self.assertNotIn('check-cross-component', sections['unit-tests'])
            self.assertIn('check-cross-component', sections['functional-tests'])
            self.assertNotIn('check-games-benchmark', sections['functional-tests'])
            for check_id in ('platform-capacity', 'games-benchmark', 'input-benchmark'):
                self.assertIn(f'check-{check_id}', sections['benchmarks'])
            for value in ('F – funksjon / kapasitet', 'P – ytelse', 'href="games-benchmark.json"',
                          'href="games-benchmark.log"', 'href="input-benchmark.log"',
                          'Rådata ikke produsert', 'Dependency missing &lt;runtime&gt;', 'AssertionError: &lt;failed&gt;'):
                self.assertIn(value, sections['benchmarks'])
            self.assertNotIn('OLD_DIAGNOSTIC_PREFIX', document)
            for value in ('3 FAIL · 1 BLOCKED', 'Selvtest: FAIL', 'Selftest assertions failed',
                          'href="evaluation-selftest.log"', 'A selftest &lt;assertion&gt; failed'):
                self.assertIn(value, sections['diagnostics'])
            self.assertIn('FoM —', document)
            self.assertNotIn('<circle', (root / 'history.svg').read_text(encoding='utf-8'))

    def test_blocked_graph_run_has_status_link_without_score_point(self):
        data = report('blocked')
        data['checks'][0].update(status='BLOCKED', score=None)
        data['summary'] = summarize(data)
        svg = chart([data])
        self.assertIn('BLOCKED', svg)
        self.assertIn('href="runs/blocked/report.html"', svg)
        self.assertNotIn('<circle', svg)

    def test_per_run_graph_links_resolve_to_existing_reports(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for run_id in ('run-1', 'run-2'):
                folder = root / 'runs' / run_id
                folder.mkdir(parents=True)
                save_json(folder / 'report.json', report(run_id))
                save_json(folder / 'feedback-1.json', dict(timestamp='now', score=7, comment='Useful', reviewer='Team'))
            render(root)
            for run_id in ('run-1', 'run-2'):
                folder = root / 'runs' / run_id
                document = (folder / 'report.html').read_text(encoding='utf-8')
                self.assertIn('<svg', document)
                self.assertIn('FoM 88.00', document)
                links = Links()
                links.feed(document)
                self.assertEqual(len(links.targets), 4)
                for href in links.targets:
                    self.assertTrue((folder / href).resolve().is_file(), href)
            links = Links()
            links.feed((root / 'index.html').read_text(encoding='utf-8'))
            for href in links.targets:
                self.assertTrue((root / href).resolve().is_file(), href)

    def test_structured_feedback_and_session_survive_report_and_handoff(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / 'runs' / 'run-1'
            folder.mkdir(parents=True)
            data = report('run-1')
            data['session'] = dict(reviewer='Group <A>', context='<script>context</script>')
            save_json(folder / 'report.json', data)
            save_json(folder / 'feedback-1.json', dict(timestamp='now', score=8, comment='<script>comment</script>', reviewer='Group <A>',
                worked='Clear <menu>', improve='Missing <pause>', priority='Fix <pause> first',
                tasks=[dict(id='connect', title='Connect <device>', status='problem', comment='<script>task</script>'),
                       dict(id='ai', title='AI chat', status='skipped', comment='No backend')]))
            render(root)
            document = (folder / 'report.html').read_text(encoding='utf-8')
            handoff = (folder / 'next-iteration.md').read_text(encoding='utf-8')
            for value in ('context', 'comment', 'task'):
                self.assertIn(f'&lt;script&gt;{value}&lt;/script&gt;', document)
                self.assertIn(f'<script>{value}</script>', handoff)
            self.assertNotIn('<script>', document)
            for value in ('Group &lt;A&gt;', 'Clear &lt;menu&gt;', 'Missing &lt;pause&gt;', 'Fix &lt;pause&gt; first', 'Connect &lt;device&gt;', 'Ikke prøvd'):
                self.assertIn(value, document)
            for value in ('Group <A>', 'Clear <menu>', 'Missing <pause>', 'Fix <pause> first', 'Connect <device>: Problem', 'AI chat: Ikke prøvd'):
                self.assertIn(value, handoff)

    def test_empty_graph_is_accessible_and_does_not_invent_points(self):
        svg = chart([])
        tree = ET.fromstring(svg)
        self.assertEqual(tree.attrib['role'], 'img')
        self.assertIn('aria-describedby', tree.attrib)
        self.assertIn('Ingen komplette målepunkter', svg)
        self.assertNotIn('<circle', svg)

    def test_partial_input_is_visible_but_never_becomes_ux_score(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / 'runs' / 'run-1'
            folder.mkdir(parents=True)
            save_json(folder / 'report.json', report('run-1'))
            save_json(folder / 'user-input-1.json', dict(timestamp='now', status='interrupted', reviewer='Group',
                worked='Clear menu', tasks=[dict(id='menu', title='Find a game', status='done', comment='Easy')]))
            render(root)
            loaded = load_runs(root)[0]
            self.assertEqual(loaded['summary']['status'], 'AWAITING_UX')
            self.assertIsNone(loaded['summary']['fom'])
            self.assertEqual(len(loaded['manual_inputs']), 1)
            for path in (folder / 'report.html', folder / 'next-iteration.md'):
                document = path.read_text(encoding='utf-8')
                for text in ('Avbrutt vurdering', 'uten UX-skår', 'Clear menu', 'Find a game', 'Easy'):
                    self.assertIn(text, document)

    def test_source_changed_review_explains_why_score_is_excluded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / 'runs' / 'run-1'
            folder.mkdir(parents=True)
            save_json(folder / 'report.json', report('run-1'))
            save_json(folder / 'user-input-1.json', dict(timestamp='now', status='source-changed', reviewer='Group',
                proposed_score=9, reason='Changed <source>; rerun evaluation.', worked='Easy controls'))
            render(root)
            self.assertIsNone(load_runs(root)[0]['summary']['fom'])
            html = (folder / 'report.html').read_text(encoding='utf-8')
            self.assertIn('Changed &lt;source&gt;; rerun evaluation.', html)
            for path in (folder / 'report.html', folder / 'next-iteration.md'):
                text = path.read_text(encoding='utf-8')
                self.assertIn('vurderingen brukes ikke i FoM', text)
                self.assertIn('9/10 (ikke brukt i FoM)', text)

    def test_structured_answers_do_not_repeat_generated_comment(self):
        review = dict(timestamp='now', reviewer='Team', score=8,
                      worked='Clear menu', improve='Pause was unclear', priority='Improve pause',
                      comment='Fungerte godt: Clear menu\nForbedringsbehov: Pause was unclear\nPrioritet neste iterasjon: Improve pause')
        for rendered in (review_html(review), review_text(review)):
            self.assertEqual(rendered.count('Clear menu'), 1)
            self.assertEqual(rendered.count('Pause was unclear'), 1)
            self.assertEqual(rendered.count('Improve pause'), 1)
        review['comment'] = 'An additional observation'
        self.assertIn('An additional observation', review_html(review))
        self.assertIn('An additional observation', review_text(review))


if __name__ == '__main__':
    unittest.main()
