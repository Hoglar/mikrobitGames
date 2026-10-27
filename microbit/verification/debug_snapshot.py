#!/usr/bin/env python3
"""Brief SWD diagnostic snapshots; never run during timing benchmarks."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from elftools.elf.elffile import ELFFile
from pyocd.core.helpers import ConnectHelper
from audit_layout import audit


def metadata(path):
    audit(path)
    layouts = {}
    with path.open("rb") as source:
        elf = ELFFile(source)
        symbols = {s.name: s["st_value"] for s in elf.get_section_by_name(".symtab").iter_symbols() if s["st_value"]}
        for cu in elf.get_dwarf_info().iter_CUs():
            for die in cu.iter_DIEs():
                if die.tag not in ("DW_TAG_class_type", "DW_TAG_structure_type") or "DW_AT_byte_size" not in die.attributes:
                    continue
                name = die.attributes.get("DW_AT_name")
                if name:
                    layouts[name.value.decode()] = {c.attributes["DW_AT_name"].value.decode(): c.attributes["DW_AT_data_member_location"].value
                                                   for c in die.iter_children() if c.tag == "DW_TAG_member"
                                                   and "DW_AT_name" in c.attributes and "DW_AT_data_member_location" in c.attributes}
    return symbols, layouts


def inspect(target, symbols, layouts):
    app = target.read32(symbols["application"])
    report = {"applicationAddress": hex(app), "pc": hex(target.read_core_register("pc")),
              "faultStatus": hex(target.read32(0xE000ED28)), "hardFaultStatus": hex(target.read32(0xE000ED2C)),
              "recordedAt": datetime.now(timezone.utc).isoformat(), "debuggerPause": True}
    report["digital"] = {name: {"rawStableInitialized": hex(target.read32(app + layouts["Application"][name])),
                                "changedAt": target.read32(app + layouts["Application"][name] + 4),
                                "presses": target.read32(app + layouts["Application"][name] + 8)}
                         for name in ("a_", "b_", "logo_")}
    report["gpio"] = {"p0in": hex(target.read32(0x50000510)), "aPinConfig": hex(target.read32(0x50000738)),
                      "bPinConfig": hex(target.read32(0x5000075c))}
    for name, type_name in (("stats", "RuntimeStats"), ("firmware", "Firmware")):
        base = app + layouts["Application"][name]
        if name == "firmware":
            base += layouts[type_name]["diagnostics_"]
            type_name = "Diagnostics"
        report[name] = {key: target.read32(base + offset) for key, offset in layouts[type_name].items()}
    report["heap"] = []
    for index in range(target.read8(symbols["heap_count"])):
        start, end = target.read_memory_block32(symbols["heap"] + index * 8, 2)
        memory = target.read_memory_block32(start, (end - start) // 4)
        position, free, used, largest, blocks = 0, 0, 0, 0, 0
        while position < len(memory):
            header = memory[position]
            words = header & 0x7fffffff
            if not words or position + words > len(memory):
                raise ValueError(f"Invalid heap block at {start + position * 4:#x}")
            if header & 0x80000000:
                free += (words - 1) * 4
                largest = max(largest, (words - 1) * 4)
            else:
                used += words * 4
            blocks += 1
            position += words
        report["heap"].append({"arenaBytes": end - start, "freePayloadBytes": free, "usedBlockBytes": used,
                               "largestFreePayloadBytes": largest, "blocks": blocks})
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--elf", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--uid", required=True)
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()
    symbols, layouts = metadata(args.elf)
    session = ConnectHelper.session_with_chosen_probe(unique_id=args.uid, options={"target_override": "nrf52833", "connect_mode": "attach"})
    if session is None:
        raise RuntimeError("Selected debug probe unavailable")
    with session:
        target = session.target
        target.halt()
        try:
            report = inspect(target, symbols, layouts)
            if args.reset:
                target.reset()
                report["resetRequested"] = True
        finally:
            target.resume()
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
