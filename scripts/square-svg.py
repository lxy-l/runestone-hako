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


def square_svg(source, destination):
    original = ET.parse(source).getroot()
    view_box = original.get("viewBox")
    if not view_box:
        width = number(original.get("width", ""))
        height = number(original.get("height", ""))
        view_box = f"0 0 {width} {height}"

    outer = ET.Element(
        f"{{{SVG_NS}}}svg",
        {"width": "144", "height": "144", "viewBox": "0 0 144 144"},
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
            "width": "144",
            "height": "144",
            "viewBox": view_box,
            "preserveAspectRatio": "xMidYMid meet",
        }
    )
    nested = ET.SubElement(outer, f"{{{SVG_NS}}}svg", nested_attributes)
    nested.extend(copy.deepcopy(list(original)))
    ET.ElementTree(outer).write(destination, encoding="utf-8", xml_declaration=True)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: square-svg.py INPUT.svg OUTPUT.svg")
    square_svg(sys.argv[1], sys.argv[2])
