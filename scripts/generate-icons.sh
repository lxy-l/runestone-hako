#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/assets/icons"
DST="$SRC/png"

mkdir -p "$DST"
find "$DST" -type f -name '*.png' -delete

while IFS= read -r -d '' src; do
  name="$(basename "$src" .svg)"
  size=144
  if [[ "$name" == "apple-intelligence" || "$name" == "microsoft" ]]; then
    size=288
  fi
  tmp="$(mktemp "${TMPDIR:-/tmp}/runestone-icon.XXXXXX.svg")"
  python3 "$ROOT/scripts/square-svg.py" "$src" "$tmp" "$size"
  rsvg-convert \
    --width="$size" \
    --height="$size" \
    --keep-aspect-ratio \
    --format=png \
    --output "$DST/$name.png" \
    "$tmp"
  rm "$tmp"
done < <(find "$SRC" -maxdepth 1 -type f -name '*.svg' -print0 | sort -z)

echo "Generated $(find "$DST" -type f -name '*.png' | wc -l | tr -d ' ') PNG icons (144x144 default; Apple Intelligence and Microsoft at 288x288)."
