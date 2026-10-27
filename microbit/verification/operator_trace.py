#!/usr/bin/env python3
"""Mark and evaluate manual button steps in a running HIL trace."""
import argparse
import json
import math
from pathlib import Path
import time
from hil_checks import summary


def samples(trace):
    # A running writer may have flushed only part of its last record.
    text = trace.read_text(encoding="utf-8").rsplit("\n", 1)[0]
    result = []
    for line in text.splitlines():
        record = json.loads(line)
        if record["line"].startswith("{"):
            obj = json.loads(record["line"])
            if "n" in obj:
                result.append((record["hostTime"], obj))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("mark", "finish", "pose"))
    parser.add_argument("--trace", type=Path, required=True)
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--label", required=True)
    parser.add_argument("--buttons", nargs="+", choices=("a", "b", "q"), default=["a"])
    parser.add_argument("--presses", type=int, default=3)
    parser.add_argument("--pose", choices=("flat", "right", "bottom", "shake", "light-exposed", "light-covered", "mic-quiet", "mic-loud"))
    parser.add_argument("--reference", help="Label of an exposed-light or quiet-microphone baseline")
    args = parser.parse_args()
    mark_path = args.directory / (args.label + "-mark.json")
    rows = samples(args.trace)
    if args.mode == "mark":
        if not rows:
            raise RuntimeError("Capture has not flushed its first snapshot yet; retry marking before prompting the operator")
        mark_path.write_text(json.dumps({"label": args.label, "beganHostTime": time.monotonic(), "baseline": rows[-1][1]}, indent=2))
        print("MARKED", args.label)
        return 0
    if args.mode == "pose":
        if not args.pose:
            parser.error("--pose is required for pose evaluation")
        if args.pose in ("shake", "mic-loud"):
            mark = json.loads(mark_path.read_text())
            selected = [r for r in rows if r[0] >= mark["beganHostTime"]]
        else:
            selected = [r for r in rows if r[0] >= rows[-1][0] - 2]
        if len(selected) < 50:
            raise ValueError("Too few samples for an operator step")
        result = summary(selected)
        result.update(operatorConfirmed=True, pose=args.pose, status="PASS")
        values = result["ranges"]
        if args.pose == "flat":
            passed = abs(values["x"]["median"]) <= 250 and abs(values["y"]["median"]) <= 250 and values["z"]["median"] < -700
        elif args.pose == "right":
            passed = values["x"]["median"] > 350
        elif args.pose == "bottom":
            passed = values["y"]["median"] > 350
        elif args.pose == "shake":
            peak = max(math.sqrt(sum(s[k] ** 2 for k in ("x", "y", "z"))) for _, s in selected)
            result["peakAccelerationMg"] = peak
            passed = peak >= 1600
        elif args.pose in ("light-exposed", "mic-quiet"):
            result["status"] = "BASELINE"
            passed = True
        elif args.pose == "light-covered":
            baseline = json.loads((args.directory / ((args.reference or "light-exposed") + ".json")).read_text())
            result["exposedMedian"] = baseline["ranges"]["l"]["median"]
            passed = values["l"]["median"] <= result["exposedMedian"] - 10
        else:
            baseline = json.loads((args.directory / ((args.reference or "mic-quiet") + ".json")).read_text())
            result["quietMedian"] = baseline["ranges"]["m"]["median"]
            result["quietMaximum"] = baseline["ranges"]["m"]["max"]
            passed = values["m"]["max"] >= max(50, result["quietMedian"] + 30, result["quietMaximum"] + 20)
        if not passed:
            result["status"] = "FAIL"
        (args.directory / (args.label + ".json")).write_text(json.dumps(result, indent=2))
        print(json.dumps({"status": result["status"], "pose": args.pose, "ranges": {k:values[k] for k in ("x","y","z","l","m")}}, indent=2))
        return int(not passed)
    mark = json.loads(mark_path.read_text())
    selected = [(mark["beganHostTime"], mark["baseline"])] + [r for r in rows if r[0] >= mark["beganHostTime"]]
    result = summary(selected)
    result.update(operatorConfirmed=True, status="PASS", expectedPresses=args.presses, requestedButtons=args.buttons)
    for button in ("a", "b", "q"):
        expected = args.presses if button in args.buttons else 0
        evidence = result[button]
        if evidence["pressDelta"] != expected or evidence["observedRisingEdges"] != expected or evidence["observedFallingEdges"] != expected or result["last"][button] != 0:
            result["status"] = "FAIL"
    (args.directory / (args.label + ".json")).write_text(json.dumps(result, indent=2))
    print(json.dumps({k: result[k] for k in ("status", "a", "b", "q")}, indent=2))
    return int(result["status"] != "PASS")


if __name__ == "__main__":
    raise SystemExit(main())
