#!/usr/bin/env python3
"""Reject mixed firmware object layouts before flashing (requires pyelftools)."""
import argparse
from collections import defaultdict
import json
from pathlib import Path
from elftools.elf.elffile import ELFFile


def audit(path):
    layouts = defaultdict(set)
    with Path(path).open("rb") as source:
        elf = ELFFile(source)
        if not elf.has_dwarf_info():
            raise ValueError("ELF has no debug information for the layout audit")
        for cu in elf.get_dwarf_info().iter_CUs():
            for die in cu.iter_DIEs():
                if die.tag not in ("DW_TAG_class_type", "DW_TAG_structure_type"):
                    continue
                name, size = die.attributes.get("DW_AT_name"), die.attributes.get("DW_AT_byte_size")
                if not name or not size:
                    continue
                parent = die.get_parent()
                namespace = parent.attributes.get("DW_AT_name") if parent else None
                if not parent or parent.tag != "DW_TAG_namespace" or not namespace or namespace.value != b"mikrobit":
                    continue
                members = tuple((child.attributes["DW_AT_name"].value.decode(), child.attributes["DW_AT_data_member_location"].value)
                                for child in die.iter_children() if child.tag == "DW_TAG_member"
                                and "DW_AT_name" in child.attributes and "DW_AT_data_member_location" in child.attributes)
                layouts[name.value.decode()].add((size.value, members))
    conflicts = {name: sorted(values) for name, values in layouts.items() if len(values) != 1}
    if conflicts:
        raise ValueError("Inconsistent compiled type layouts: " + json.dumps(conflicts))
    if "Application" not in layouts or "Firmware" not in layouts:
        raise ValueError("Application/Firmware debug types missing")
    return {name: next(iter(values))[0] for name, values in sorted(layouts.items())}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("elf", type=Path)
    args = parser.parse_args()
    print(json.dumps(audit(args.elf), indent=2))
