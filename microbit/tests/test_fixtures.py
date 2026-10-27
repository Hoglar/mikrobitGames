"""Drive the compiled C++ firmware with the shared wire examples (no JSON parser in firmware)."""
import json
from pathlib import Path
import subprocess
import sys
import unittest

SIMULATOR, CORPUS = sys.argv[1:3]
del sys.argv[1:3]
FIXTURES = json.loads(Path(CORPUS).read_text(encoding="utf-8"))


def invoke(*arguments, wire=None):
    return subprocess.run([SIMULATOR, *arguments], input=wire, capture_output=True, check=True, text=True).stdout


class SharedFirmwareFixtures(unittest.TestCase):
    def test_all_command_results(self):
        for case in FIXTURES["commandCases"]:
            with self.subTest(case=case["id"]):
                self.assertEqual(invoke("--command", str(case.get("highestId", 0)), case["line"]), case["result"] + "\n")

    def test_metadata_encoder(self):
        self.assertEqual(json.loads(invoke("--info")), FIXTURES["deviceInfo"]["v2"])

    def test_valid_snapshot_encodings(self):
        keys = "n u a b ac bc x y z t l m q qc".split()
        for case in FIXTURES["snapshotCases"]:
            if not case["accepted"] or case["id"] == "unknown-key":
                continue  # Unknown fields and rejected JSON are browser-parser tests.
            snapshot = dict(FIXTURES["snapshots"][case["base"]], **case.get("set", {}))
            with self.subTest(case=case["id"]):
                self.assertEqual(json.loads(invoke("--snapshot", *(str(snapshot[k]) for k in keys))), snapshot)

    def test_batched_commands_and_crlf(self):
        wire = "HELLO|1\r\n" + "".join(c["line"] + "\r\n" for c in FIXTURES["commandCases"][:7])
        lines = invoke(wire=wire).splitlines()
        self.assertEqual(json.loads(lines[0]), FIXTURES["deviceInfo"]["v2"])
        self.assertEqual(lines[1:], [c["result"] for c in FIXTURES["commandCases"][:7]])


if __name__ == "__main__":
    unittest.main()
