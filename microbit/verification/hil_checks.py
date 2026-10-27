#!/usr/bin/env python3
"""Additional serial HIL checks and operator-guided captures on a flashed V2."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import statistics
import time
import serial
from serial_smoke import Link, validate_snapshot, percentiles, U32


class RecordingLink(Link):
    def __init__(self, port, trace):
        super().__init__(port)
        self.trace = trace
        self.samples = []
        self.results = []

    def line(self, deadline):
        line = super().line(deadline)
        now = time.monotonic()
        self.trace.write(json.dumps({"hostTime": now, "line": line}) + "\n")
        self.trace.flush()
        if line.startswith("{"):
            obj = json.loads(line)
            if "n" in obj:
                validate_snapshot(obj)
                self.samples.append((now, obj))
        else:
            self.results.append((now, line))
        return line

    def snapshots_for(self, seconds):
        end = time.monotonic() + seconds
        while time.monotonic() < end:
            obj = json.loads(self.line(time.monotonic() + 3))
            validate_snapshot(obj)


def summary(samples):
    if not samples:
        return {"count": 0}
    values = [s for _, s in samples]
    acquisition = [(b["u"] - a["u"]) % U32 for a, b in zip(values, values[1:])]
    dn = [(b["n"] - a["n"]) % U32 for a, b in zip(values, values[1:])]
    assert all(0 < v < U32 // 2 for v in acquisition), "Timestamp/reset discontinuity"
    assert all(0 < v < U32 // 2 for v in dn), "Sequence/reset discontinuity"
    output = {"count": len(values), "first": values[0], "last": values[-1],
              "sequenceGaps": sum(v - 1 for v in dn), "acquisitionMs": percentiles(acquisition),
              "hostArrivalMs": percentiles([(b[0] - a[0]) * 1000 for a, b in zip(samples, samples[1:])]),
              "ranges": {k: {"min": min(s[k] for s in values), "max": max(s[k] for s in values),
                              "median": statistics.median(s[k] for s in values)} for k in values[0]}}
    for key, counter in (("a", "ac"), ("b", "bc"), ("q", "qc")):
        output[key] = {"pressDelta": (values[-1][counter] - values[0][counter]) % U32,
                       "observedRisingEdges": sum(not a[key] and b[key] for a, b in zip(values, values[1:])),
                       "observedFallingEdges": sum(a[key] and not b[key] for a, b in zip(values, values[1:]))}
    return output


def automatic(link, report, load_seconds):
    checks = report["checks"]
    link.handshake()
    # Repeated HELLO must preserve the boot clock/sequence/counters.
    _, before = link.handshake()
    _, after = link.handshake()
    assert 0 < (after["n"] - before["n"]) % U32 < U32 // 2
    assert 0 < (after["u"] - before["u"]) % U32 < U32 // 2
    for key in ("ac", "bc", "qc"):
        assert (after[key] - before[key]) % U32 < U32 // 2
    checks["repeatedHandshakePreservesBootCounters"] = "PASS"

    # Every split point in a short action and HELLO, with actual paced USB writes.
    for wire, expected in ((b"HELLO|1\n", None), (b"C|1|1|D|CLEAR\r\n", "R|1|1|OK")):
        for cut in range(1, len(wire)):
            if expected:
                link.handshake()
            link.write(wire[:cut])
            ended = link.write(wire[cut:])
            if expected:
                link.expect(expected, ended + 1)
            else:
                while True:
                    obj = json.loads(link.line(ended + 3))
                    if obj.get("type") == "deviceInfo":
                        break
                    validate_snapshot(obj)
                validate_snapshot(json.loads(link.line(ended + 3)))
    checks["fragmentedHelloAndCommandsAllSplitPositions"] = "PASS"

    link.handshake()
    for wire, result in (("C|1|10|D|CLEAR", "R|1|10|OK"),
                         ("C|1|10|D|CLEAR", "R|1|10|ERR|DUPLICATE_ID"),
                         ("C|1|9|D|CLEAR", "R|1|9|ERR|DUPLICATE_ID"),
                         ("C|1|11|S|TONE|1|100|128", "R|1|11|ERR|OUT_OF_RANGE"),
                         ("C|1|11|D|CLEAR", "R|1|11|ERR|DUPLICATE_ID"),
                         ("C|1|12|D|CLEAR", "R|1|12|OK")):
        ended = link.write((wire + "\n").encode())
        link.expect(result, ended + 1)
    checks["duplicateOlderAndConsumedInvalidIds"] = "PASS"

    # A paced oversized unterminated prefix cannot execute; LF reports one error.
    link.handshake()
    prefix_start = len(link.results)
    link.write(b"C|1|1|D|TEXT|" + b"A" * 2048)
    link.snapshots_for(.15)
    assert len(link.results) == prefix_start
    ended = link.write(b"\n")
    link.expect("R|1|1|ERR|LINE_TOO_LONG", ended + 1)
    for wire, expected in ((b"C|1|2|D|TEXT|A\x03B\n", "R|1|2|ERR|MALFORMED_COMMAND"),
                           (b"C|1|3|D|CLEAR\n", "R|1|3|OK")):
        ended = link.write(wire)
        link.expect(expected, ended + 1)
    checks["unterminatedOverflowInvalidBytesAndRecovery"] = "PASS"

    # Unsupported/malformed handshakes must cancel and silence snapshot traffic.
    for hello, expected in ((b"HELLO|2\n", "ERR|UNSUPPORTED_VERSION"),
                            (b"HELLO|01\n", "ERR|MALFORMED_COMMAND")):
        ended = link.write(hello)
        link.expect(expected, ended + 1)
        time.sleep(.05)
        assert not link.port.read(1024), "Streaming continued after invalid HELLO"
        link.handshake()
    checks["invalidHandshakeStopsStreamAndValidHelloRecovers"] = "PASS"

    actions = ["D|TEXT|READY", "D|IMAGE|9000009000009000009000009", "D|CLEAR",
               "S|TONE|440|200|64", "S|MELODY|64|440:50,0:50,660:50", "S|SOUND|hello", "S|STOP"]
    per_action = {action.split("|")[1]: {"firstByteToResultMs": [], "lfToResultMs": []} for action in actions}
    link.handshake()
    command_id = 0
    for _ in range(30):
        for action in actions:
            command_id += 1
            began = time.monotonic()
            ended = link.write(f"C|1|{command_id}|{action}\n".encode())
            received = link.expect(f"R|1|{command_id}|OK", ended + 1)
            entry = per_action[action.split("|")[1]]
            entry["firstByteToResultMs"].append((received - began) * 1000)
            entry["lfToResultMs"].append((received - ended) * 1000)
    report["latency"] = {action: {name: percentiles(values) for name, values in entry.items()} for action, entry in per_action.items()}
    checks["thirtyCommandsPerAction"] = "PASS"

    # Firmware clock is the acquisition measure; host timing includes writer/read scheduling.
    link.handshake()
    began = time.monotonic()
    start_sample = len(link.samples)
    command_id = 0
    next_output = began
    replacements = ["D|TEXT|ABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
                    "S|TONE|440|1000|40", "D|IMAGE|9000009000009000009000009",
                    "S|MELODY|40|440:300,0:100,660:300", "D|CLEAR", "S|STOP", "S|SOUND|happy"]
    while time.monotonic() - began < load_seconds:
        now = time.monotonic()
        if now >= next_output:
            action = replacements[command_id % len(replacements)]
            command_id += 1
            ended = link.write(f"C|1|{command_id}|{action}\n".encode())
            link.expect(f"R|1|{command_id}|OK", ended + 1)
            next_output = now + .35
        else:
            validate_snapshot(json.loads(link.line(now + 3)))
    measurement = summary(link.samples[start_sample:])
    report["load"] = {"requestedSeconds": load_seconds, "commands": command_id, **measurement}
    assert measurement["sequenceGaps"] == 0
    assert measurement["acquisitionMs"]["p95"] <= 25 and measurement["acquisitionMs"]["max"] <= 100
    checks["concurrentOutputLoadCadenceAndSoak"] = "PASS"
    link.handshake()  # Finish with blank display and stopped audio.


def capture(link, report, args):
    info, first = link.handshake()
    report["deviceInfo"] = info
    print("CAPTURE READY", args.label, json.dumps(first), flush=True)
    began = time.monotonic()
    handled, command_id = None, 0
    report["outputCommands"] = []
    while time.monotonic() - began < args.seconds:
        if args.command_file and args.command_file.exists():
            request = json.loads(args.command_file.read_text(encoding="utf-8-sig"))
            if request["request"] != handled:
                for item in request["actions"]:
                    if isinstance(item, dict):
                        link.snapshots_for(item.get("waitMs", 0) / 1000)
                        action = item["action"]
                    else:
                        action = item
                    command_id += 1
                    ended = link.write(f"C|1|{command_id}|{action}\n".encode("ascii"))
                    expected = f"R|1|{command_id}|" + request.get("result", "OK")
                    received = link.expect(expected, ended + 1)
                    record = {"request": request["request"], "id": command_id, "action": action,
                              "result": expected, "hostLatencyMs": (received - ended) * 1000}
                    report["outputCommands"].append(record)
                    print("OUTPUT", json.dumps(record), flush=True)
                handled = request["request"]
        validate_snapshot(json.loads(link.line(time.monotonic() + 3)))
        if args.stop_file and args.stop_file.exists():
            break
    report["capture"] = summary(link.samples)
    report["capture"]["elapsedSeconds"] = time.monotonic() - began
    report["operatorConfirmationRequired"] = True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("automatic", "capture"))
    parser.add_argument("--port", required=True)
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--label", default="automatic")
    parser.add_argument("--seconds", type=float, default=120)
    parser.add_argument("--load-seconds", type=float, default=300)
    parser.add_argument("--stop-file", type=Path)
    parser.add_argument("--command-file", type=Path)
    args = parser.parse_args()
    args.directory.mkdir(parents=True, exist_ok=True)
    report = {"recordedAt": datetime.now(timezone.utc).isoformat(), "label": args.label, "port": args.port,
              "checks": {}, "status": "RUNNING", "physicalLatency": "NOT MEASURED; manual stimuli are not timed instrumentation"}
    provenance = Path(__file__).resolve().parents[1] / "build/v2/provenance.json"
    report["buildProvenanceSha256"] = hashlib.sha256(provenance.read_bytes()).hexdigest()
    failed = False
    try:
        with (args.directory / (args.label + ".ndjson")).open("w", encoding="utf-8") as trace:
            with serial.Serial(args.port, 115200, timeout=.02, write_timeout=1) as port:
                link = RecordingLink(port, trace)
                if args.mode == "automatic":
                    automatic(link, report, args.load_seconds)
                else:
                    capture(link, report, args)
            report["status"] = "PASS" if args.mode == "automatic" else "CAPTURED"
    except Exception as error:
        failed = True
        report.update(status="FAIL", reason=repr(error))
    destination = args.directory / (args.label + ".json")
    destination.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(report["status"], destination, flush=True)
    if failed:
        print(report["reason"], flush=True)
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
