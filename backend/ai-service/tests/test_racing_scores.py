"""Racing score presentation; pure tests need no database or model packages."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from score_presentation import describe_racing, racing_details


class RacingScores(unittest.TestCase):
    def test_sdk_racing_metadata_keeps_place_then_time_presentation(self):
        result=describe_racing({'unit':'racing_rank_v1','sdk_metadata':{'score':{'offset':1,'fields':[
            {'key':'position','label':'Plass','min':1,'max':4,'direction':'lower_is_better','format':'integer','unit':'. plass'},
            {'key':'timeMs','label':'Tid','min':1,'max':600000,'radix':1000000,'direction':'lower_is_better','format':'duration-ms'}]}},
            'records':[{'value':1083456}]})
        self.assertEqual(result['records'][0]['display_value'],'2. plass · 01:23.456')
        self.assertEqual(result['records'][0]['score'],{'position':2,'timeMs':83456})

    def test_sdk_metadata_formats_other_games_without_packed_gap_claims(self):
        result=describe_racing({'unit':'sdk_rank_v1','sdk_metadata':{'score':{'fields':[
            {'key':'points','label':'Poeng','min':0,'max':100,'direction':'higher_is_better','format':'integer','unit':'poeng'},
            {'key':'timeMs','label':'Tid','min':0,'max':999,'direction':'lower_is_better','format':'duration-ms'}]}},
            'records':[{'value':12949,'rank':1,'gap_to_best':10}]})
        self.assertEqual(result['records'][0]['score'],{'points':12,'timeMs':50})
        self.assertEqual(result['records'][0]['display_value'],'12 poeng · 00:00.050')
        self.assertIsNone(result['records'][0]['gap_to_best'])

    def test_place_and_time_decode_and_invalid_holes(self):
        self.assertEqual(racing_details(1083456)['display_value'], '2. plass · 01:23.456')
        self.assertEqual(racing_details(3600000)['race_time_ms'], 600000)
        for value in (None, True, 0, -1, 700000, 1000000, 1600001, 4600000):
            self.assertEqual(racing_details(value), {'result_valid': False})

    def test_packed_gap_is_not_a_duration_across_placements(self):
        source = {'unit': 'racing_rank_v1', 'records': [
            {'player': 'A', 'value': 600000, 'gap_to_best': 0},
            {'player': 'B', 'value': 1070000, 'gap_to_best': 470000},
        ]}
        output = describe_racing(source)
        self.assertIsNone(output['records'][1]['gap_to_best'])
        self.assertEqual(output['records'][1]['position_gap_to_best'], 1)
        self.assertIsNone(output['records'][1]['time_gap_to_best_ms'])
        self.assertEqual(source['records'][1]['gap_to_best'], 470000)

    def test_same_place_has_time_gap_and_history_keeps_decoded_results(self):
        result = describe_racing({'unit': 'racing_rank_v1', 'records': [
            {'value': 1080000}, {'value': 1083456}],
            'history': [{'value': 1090000}, {'value': 100000}], 'improvement': 990000})
        self.assertEqual(result['records'][1]['time_gap_to_best_ms'], 3456)
        self.assertEqual(result['history'][0]['race_position'], 2)
        self.assertEqual(result['history'][1]['race_position'], 1)
        self.assertIsNone(result['improvement'])

    def test_other_games_are_unchanged(self):
        source = {'unit': 'meters', 'value': 100}
        self.assertIs(describe_racing(source), source)


if __name__ == '__main__':
    unittest.main()
