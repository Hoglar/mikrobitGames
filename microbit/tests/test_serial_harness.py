"""Regression checks for host-side framing used by physical HIL tests."""
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "verification"))
from serial_smoke import CORPUS, Link
import time


class FakePort:
    def __init__(self, chunks):
        self.chunks = [bytearray(c) for c in chunks]
        self.written = bytearray()

    @property
    def in_waiting(self):
        return len(self.chunks[0]) if self.chunks else 0

    def read(self, count):
        if not self.chunks:
            return b""
        result = bytes(self.chunks[0][:count])
        del self.chunks[0][:count]
        if not self.chunks[0]:
            self.chunks.pop(0)
        return result

    def write(self, data):
        self.written.extend(data)
        return len(data)

    def flush(self):
        pass


class SerialHarnessTests(unittest.TestCase):
    def test_reopen_discards_partial_old_snapshot_and_result_before_barrier(self):
        corpus = json.loads(CORPUS.read_text())
        info, snapshot = corpus["deviceInfo"]["v2"], corpus["snapshots"]["v2"]
        wire = b'52,"qc":0}\nR|1|99|OK\n' + json.dumps(info).encode() + b"\n" + json.dumps(snapshot).encode() + b"\n"
        port = FakePort([wire[:3], wire[3:10], wire[10:]])
        self.assertEqual(Link(port).handshake(), (info, snapshot))
        self.assertEqual(port.written, b"HELLO|1\n")

    def test_many_messages_in_one_chunk_preserve_complete_lines(self):
        link = Link(FakePort([b"one\ntwo\nthree\n"]))
        self.assertEqual([link.line(time.monotonic() + 1) for _ in range(3)], ["one", "two", "three"])

    def test_queued_data_is_drained_after_host_scheduling_pause(self):
        link = Link(FakePort([b"already-available\n"]))
        self.assertEqual(link.line(time.monotonic() - 1), "already-available")
        with self.assertRaises(TimeoutError):
            link.line(time.monotonic() - 1)

    def test_active_line_bounds_and_invalid_bytes_are_not_hidden(self):
        for wire in (b"X" * 1025 + b"\n", b"A\x03B\n"):
            with self.subTest(wire=wire[:10]):
                with self.assertRaises(AssertionError):
                    Link(FakePort([wire])).line(time.monotonic() + 1)


if __name__ == "__main__":
    unittest.main()
