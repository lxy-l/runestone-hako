#!/usr/bin/env python3
"""Wrap an SVG in a square viewport while preserving its artwork ratio."""

import copy
import re
import sys
import xml.etree.ElementTree as ET


SVG_NS = "http://www.w3.org/2000/svg"
GEOMETRY_ATTRIBUTES = {"x", "y", "width", "height", "viewBox", "preserveAspectRatio"}
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")


def number(value):
    match = re.match(r"^\s*([+-]?(?:\d+\.?\d*|\.\d+))", value)
    if not match:
        raise ValueError(f"Cannot read SVG dimension: {value}")
    return match.group(1)


def square_svg(source, destination, size=144):
    original = ET.parse(source).getroot()
    view_box = original.get("viewBox")
    if not view_box:
        width = number(original.get("width", ""))
        height = number(original.get("height", ""))
        view_box = f"0 0 {width} {height}"

    outer = ET.Element(
        f"{{{SVG_NS}}}svg",
        {"width": str(size), "height": str(size), "viewBox": f"0 0 {size} {size}"},
    )
    nested_attributes = {
        key: value
        for key, value in original.attrib.items()
        if key not in GEOMETRY_ATTRIBUTES
    }
    nested_attributes.update(
        {
            "x": "0",
            "y": "0",
            "width": str(size),
            "height": str(size),
            "viewBox": view_box,
            "preserveAspectRatio": "xMidYMid meet",
        }
    )
    nested = ET.SubElement(outer, f"{{{SVG_NS}}}svg", nested_attributes)
    nested.extend(copy.deepcopy(list(original)))
    ET.ElementTree(outer).write(destination, encoding="utf-8", xml_declaration=True)


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        raise SystemExit("Usage: square-svg.py INPUT.svg OUTPUT.svg [SIZE]")
    size = int(sys.argv[3]) if len(sys.argv) == 4 else 144
    square_svg(sys.argv[1], sys.argv[2], size)
