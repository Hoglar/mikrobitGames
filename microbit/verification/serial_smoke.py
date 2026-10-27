#!/usr/bin/env python3
"""Wire-level V2 smoke test. Physical input/output and instrumentation remain manual."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import platform
import time

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT.parent / "spec/contracts/microbit-webapp/fixtures/conformance.json"
U32 = 2**32


def validate_snapshot(s):
    bounds = {k: (0, U32 - 1) for k in ("n", "u", "ac", "bc", "qc")}
    bounds.update({k: (0, 1) for k in ("a", "b", "q")})
    bounds.update({k: (-8192, 8192) for k in ("x", "y", "z")})
    bounds.update(t=(-40, 125), l=(0, 255), m=(0, 255))
    assert set(s) == set(bounds), f"Unexpected snapshot keys: {s}"
    for k, (low, high) in bounds.items():
        assert type(s[k]) is int and low <= s[k] <= high, f"Invalid {k}: {s[k]}"


def percentiles(values):
    values = sorted(values)
    if not values:
        return {}
    return {name: values[min(len(values) - 1, int((len(values) - 1) * p))]
            for name, p in (("p50", .5), ("p95", .95), ("p99", .99), ("max", 1))}


class Link:
    def __init__(self, port):
        self.port, self.next_write = port, 0
        self.pending = bytearray()

    def write(self, data):
        for start in range(0, len(data), 16):
            time.sleep(max(0, self.next_write - time.monotonic()))
            began = time.monotonic()
            chunk = data[start:start + 16]
            assert self.port.write(chunk) == len(chunk), "Partial host write"
            self.port.flush()
            self.next_write = began + .005
        return time.monotonic()

    def line(self, deadline):
        while time.monotonic() < deadline:
            byte = self.port.read(1)
            if not byte:
                continue
            if byte == b"\n":
                line = bytes(self.pending)
                self.pending.clear()
                assert len(line) <= 1024 and all(32 <= c <= 126 for c in line), "Invalid wire bytes"
                return line.decode("ascii")
            self.pending.extend(byte)
            assert len(self.pending) <= 1025, "Oversized device line"
        raise TimeoutError("Device line deadline expired")

    def expect(self, expected, deadline):
        while True:
            line = self.line(deadline)
            if line == expected:
                return time.monotonic()
            s = json.loads(line)
            validate_snapshot(s)

    def handshake(self):
        ended = self.write(b"HELLO|1\n")
        deadline = ended + 3
        while True:
            line = self.line(deadline)
            obj = json.loads(line)
            if obj.get("type") == "deviceInfo":
                break
            validate_snapshot(obj)  # An old committed snapshot may precede the barrier.
        expected = json.loads(CORPUS.read_text())["deviceInfo"]["v2"]
        assert {k: v for k, v in obj.items() if k != "capabilities"} == {k: v for k, v in expected.items() if k != "capabilities"}
        assert obj["capabilities"]["sensors"] == expected["capabilities"]["sensors"]
        outputs = obj["capabilities"]["outputs"]
        for target in ("ledDisplay", "speaker"):
            assert outputs[target] == expected["capabilities"]["outputs"][target]
        assert outputs["builtInSounds"] == ["hello", "happy"]
        first = json.loads(self.line(deadline))
        validate_snapshot(first)
        return obj, first


def run(link, duration, checks, measurements):
    info, _ = link.handshake()
    checks["handshakeAndMandatoryCapabilities"] = "PASS"
    measurements["deviceInfo"] = info
    previous, last_host = None, None
    acquisition, arrival, gaps, count, byte_count = [], [], 0, 0, 0
    start = time.monotonic()
    while time.monotonic() - start < duration:
        line = link.line(time.monotonic() + .5)
        now = time.monotonic()
        s = json.loads(line)
        validate_snapshot(s)
        if previous is not None:
            dn, du = (s["n"] - previous["n"]) % U32, (s["u"] - previous["u"]) % U32
            assert 0 < dn < U32 // 2 and 0 < du < U32 // 2, "Non-forward snapshot"
            gaps += dn - 1
            for key in ("ac", "bc", "qc"):
                assert (s[key] - previous[key]) % U32 < U32 // 2, "Counter regression"
            acquisition.append(du)
            arrival.append((now - last_host) * 1000)
        previous, last_host = s, now
        count += 1
        byte_count += len(line) + 1
    measurements.update(snapshotCount=count, sequenceGaps=gaps, acquisitionMs=percentiles(acquisition),
                        hostArrivalMs=percentiles(arrival), bytesPerSecond=byte_count / (time.monotonic() - start))
    assert acquisition and gaps == 0 and percentiles(acquisition)["p95"] <= 25 and max(acquisition) <= 100
    checks["snapshotSchemaProgressionAndIdleCadence"] = "PASS"

    latencies = []
    cases = json.loads(CORPUS.read_text())["commandCases"]
    for case in cases:
        link.handshake()
        high = case.get("highestId", 0)
        if high:
            ended = link.write(f"C|1|{high}|D|CLEAR\n".encode())
            link.expect(f"R|1|{high}|OK", ended + 1)
        ended = link.write((case["line"] + "\r\n").encode("ascii"))
        received = link.expect(case["result"], ended + 1)
        latencies.append((received - ended) * 1000)
    measurements["fixtureResultHostLatencyMs"] = percentiles(latencies)
    checks["sharedCommandFixtures"] = "PASS"
    link.handshake()
    ended = link.write(b"C|1|1|D|TEXT|" + b"A" * 1000 + b"\n")
    link.expect("R|1|1|ERR|LINE_TOO_LONG", ended + 1)
    ended = link.write(b"C|1|2|D|CLEAR\nC|1|3|S|STOP\n")
    link.expect("R|1|2|OK", ended + 1)
    link.expect("R|1|3|OK", ended + 1)
    checks["oversizedLineRecoveryAndBatchedCommands"] = "PASS"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", help="Explicit port, e.g. COM5 or /dev/ttyACM0")
    parser.add_argument("--board-revision")
    parser.add_argument("--interface-version")
    parser.add_argument("--provenance", type=Path)
    parser.add_argument("--duration", type=float, default=60)
    parser.add_argument("--report", type=Path, default=ROOT / "results/serial-smoke.json")
    args = parser.parse_args()
    report = {"recordedAt": datetime.now(timezone.utc).isoformat(), "host": platform.platform(), "port": args.port, "boardRevision": args.board_revision,
              "interfaceVersion": args.interface_version, "checks": {}, "measurements": {},
              "fixtureSha256": hashlib.sha256(CORPUS.read_bytes()).hexdigest(),
              "physicalVerification": "SKIPPED: run manual/instrumented HW-01 through HW-22; this tool checks wire behavior only"}
    if args.provenance:
        report["buildProvenance"] = json.loads(args.provenance.read_text())
    failed = False
    try:
        if not args.port:
            report["status"] = "SKIPPED"
            report["reason"] = "micro:bit not connected"
        else:
            if not args.board_revision or not args.interface_version or not args.provenance or args.duration <= 0:
                parser.error("With --port, provide --board-revision, --interface-version, --provenance and a positive duration")
            import serial
            with serial.Serial(args.port, 115200, timeout=.02, write_timeout=1, xonxoff=False, rtscts=False, dsrdtr=False) as port:
                run(Link(port), args.duration, report["checks"], report["measurements"])
            report["status"] = "PASS"
    except Exception as error:
        failed = True
        report.update(status="FAIL", reason=str(error))
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(report["status"], args.report)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
