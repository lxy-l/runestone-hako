#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/assets/icons"
DST="$SRC/png"

mkdir -p "$DST"
find "$DST" -type f -name '*.png' -delete

while IFS= read -r -d '' src; do
  name="$(basename "$src" .svg)"
  tmp="$(mktemp "${TMPDIR:-/tmp}/runestone-icon.XXXXXX.svg")"
  python3 "$ROOT/scripts/square-svg.py" "$src" "$tmp"
  rsvg-convert \
    --width=144 \
    --height=144 \
    --keep-aspect-ratio \
    --format=png \
    --output "$DST/$name.png" \
    "$tmp"
  rm "$tmp"
done < <(find "$SRC" -maxdepth 1 -type f -name '*.svg' -print0 | sort -z)

echo "Generated $(find "$DST" -type f -name '*.png' | wc -l | tr -d ' ') 144x144 PNG icons."
