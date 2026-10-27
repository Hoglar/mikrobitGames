#!/usr/bin/env python3
"""Pinned CODAL bootstrap and artifact/provenance staging. Run on Linux/WSL."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
LOCK = json.loads((ROOT / "toolchain/lock.json").read_text(encoding="utf-8"))


def run(*args, cwd=None, capture=False, env=None):
    result = subprocess.run(args, cwd=cwd, env=env, check=True, text=True,
                            stdout=subprocess.PIPE if capture else None)
    return result.stdout.strip() if capture else ""


def checkout(path, entry):
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        run("git", "clone", entry["url"], str(path))
        run("git", "checkout", "--detach", entry["commit"], cwd=path)
    actual = run("git", "rev-parse", "HEAD", cwd=path, capture=True)
    if actual != entry["commit"]:
        raise RuntimeError(f"Wrong pinned revision at {path}: {actual}; expected {entry['commit']}")
    run("git", "submodule", "update", "--init", "--recursive", cwd=path)
    # Configuration is generated only in the bootstrap. Runtime dependencies must stay pristine.
    return actual


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prepare-only", action="store_true")
    args = parser.parse_args()
    if os.name == "nt":
        parser.error("Use Linux/WSL for the CODAL cross-build; host CMake tests also run on Windows.")
    bootstrap = ROOT / ".build/codal"
    checkout(bootstrap, LOCK["bootstrap"])
    for name, entry in LOCK["libraries"].items():
        path = bootstrap / "libraries" / name
        checkout(path, entry)
        if run("git", "-c", "core.autocrlf=true", "status", "--porcelain", cwd=path, capture=True):
            raise RuntimeError(f"Runtime dependency has local changes: {path}")
    for name, expected in LOCK["submodules"].items():
        actual = run("git", "rev-parse", "HEAD", cwd=bootstrap / "libraries" / name, capture=True)
        if actual != expected:
            raise RuntimeError(f"Wrong pinned submodule revision: {name}")
    config = {
        "target": {"name": "codal-microbit-v2", "url": LOCK["libraries"]["codal-microbit-v2"]["url"],
                   "branch": LOCK["libraries"]["codal-microbit-v2"]["commit"], "type": "git"},
        "application": "../../src",
        "config": {"DEVICE_BLE": 0, "MICROBIT_BLE_ENABLED": 0, "MICROBIT_BLE_PAIRING_MODE": 0,
                   "CODAL_DEBUG": "CODAL_DEBUG_DISABLED", "DMESG_SERIAL_DEBUG": 0,
                   "SCHEDULER_TICK_PERIOD_US": 1000}
    }
    (bootstrap / "codal.json").write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    cmake_file = bootstrap / "CMakeLists.txt"
    hook = '\ninclude("../../toolchain/application.cmake")\n'
    cmake_text = run("git", "show", "HEAD:CMakeLists.txt", cwd=bootstrap, capture=True)
    cmake_file.write_text(cmake_text + hook, encoding="utf-8")
    if args.prepare_only:
        print("Pinned sources ready:", bootstrap)
        return
    for tool in ("cmake", "make", "arm-none-eabi-g++", "arm-none-eabi-size", "arm-none-eabi-nm"):
        if not shutil.which(tool):
            raise RuntimeError(f"Required tool not found: {tool}")
    env = os.environ.copy()
    env.setdefault("CMAKE_POLICY_VERSION_MINIMUM", "3.5")
    run(sys.executable, "build.py", cwd=bootstrap, env=env)
    out = ROOT / "build/v2"
    out.mkdir(parents=True, exist_ok=True)
    (out / "MICROBIT.bin").unlink(missing_ok=True)  # Remove only the legacy generated staged BIN.
    artifacts = []
    # Upstream's raw BIN spans the distant UICR address and is ~256 MiB; stage HEX/ELF instead.
    for source in (bootstrap / "MICROBIT.hex", bootstrap / "build/MICROBIT", bootstrap / "build/MICROBIT.map",
                   bootstrap / "build/compile_commands.json", bootstrap / "build/codal_extra_definitions.h"):
        if source.is_file():
            destination = out / source.name
            shutil.copy2(source, destination)
            artifacts.append({"file": destination.name, "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
                              "bytes": destination.stat().st_size})
    if not (out / "MICROBIT.hex").exists():
        raise RuntimeError("CODAL did not produce MICROBIT.hex")
    sources = sorted((ROOT / "src").rglob("*.cpp")) + sorted((ROOT / "src").rglob("*.h")) + sorted((ROOT / "toolchain").glob("*.*"))
    source_hashes = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sources if p.is_file()}
    symbols = {}
    for line in run("arm-none-eabi-nm", "-n", str(out / "MICROBIT"), capture=True).splitlines():
        fields = line.split()
        if len(fields) == 3 and fields[2] in ("__data_start__", "__data_end__", "__bss_start__", "__bss_end__", "__end__", "__StackTop"):
            symbols[fields[2]] = int(fields[0], 16)
    provenance = {"builtAt": datetime.now(timezone.utc).isoformat(), "dependencies": LOCK, "configuration": config, "host": platform.platform(), "sourceSha256": source_hashes,
                  "python": sys.version, "compiler": run("arm-none-eabi-g++", "--version", capture=True),
                  "cmake": run("cmake", "--version", capture=True),
                  "git": run("git", "--version", capture=True),
                  "size": run("arm-none-eabi-size", str(out / "MICROBIT"), capture=True),
                  "linkerSymbols": symbols,
                  "projectCommit": run("git", "rev-parse", "HEAD", cwd=ROOT, capture=True),
                  "projectStatus": run("git", "-c", "core.autocrlf=true", "status", "--short", cwd=ROOT, capture=True), "artifacts": artifacts}
    (out / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
    print("Firmware and provenance:", out)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
