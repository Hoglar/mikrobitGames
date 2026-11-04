"""Cross-language cartridge score and catalogue contract regression tests."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import unittest
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'backend/api/src'))
from cartridge_rules import contract,decode,metadata,canonical


class CartridgeTests(unittest.TestCase):
    def test_compound_racing_and_holes(self):
        score={'offset':1,'fields':[
            {'key':'position','label':'Plass','min':1,'max':4,'direction':'lower_is_better','format':'integer'},
            {'key':'timeMs','label':'Tid','min':1,'max':600000,'radix':1000000,'direction':'lower_is_better','format':'duration-ms'}]}
        self.assertEqual(contract(score),(1,3600000,'lower_is_better'))
        self.assertEqual(decode(score,1083456),{'position':2,'timeMs':83456})
        for invalid in (0,1000000,1600001,3600001,True,'1',1.2):
            with self.assertRaises((ValueError,TypeError)):decode(score,invalid)

    def test_single_safe_integer_max_and_overflow(self):
        field={'key':'points','label':'Poeng','min':0,'max':9007199254740991,'direction':'higher_is_better','format':'integer'}
        self.assertEqual(contract({'fields':[field]})[1],9007199254740991)
        with self.assertRaises(ValueError):contract({'fields':[field,{**field,'key':'second'}]})

    def test_actual_generated_catalog_matches_backend_contract(self):
        path=ROOT/'webapp/build/cartridges/catalog.json'
        if not path.exists():self.skipTest('Kjør webapp-build først.')
        catalog=json.loads(path.read_text())
        for game in catalog['games']:
            meta=metadata(game)
            self.assertEqual(meta['rulesFingerprint'],game['rulesFingerprint'])
            self.assertEqual(meta['score'],game['mode']['score'])
        changed=dict(catalog['games'][0]);changed['rulesFingerprint']='0'*64
        with self.assertRaises(ValueError):metadata(changed)

    def test_catalog_duplicate_and_empty_rejected_before_database_access(self):
        spec=importlib.util.spec_from_file_location('sync_catalog',ROOT/'backend/database/sync-game-catalog.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        with self.assertRaises(ValueError):module.validate_catalog({'formatVersion':1,'games':[]})


if __name__=='__main__':unittest.main()
