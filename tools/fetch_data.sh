#!/usr/bin/env bash
# Download the raw map data used by build_map.py.
# Usage: tools/fetch_data.sh [data-dir]   (default: tools/data, which is git-ignored)
set -euo pipefail

DATA="${1:-$(dirname "$0")/data}"
mkdir -p "$DATA/osm"
UA="pickmeup-landing-build/1.0"
OVERPASS="https://overpass-api.de/api/interpreter"

overpass() { # $1 = output file, $2 = query
  for i in 1 2 3 4; do
    curl -s -m 200 -A "$UA" --data-urlencode "data=$2" "$OVERPASS" -o "$1"
    if head -c 1 "$1" | grep -q '{'; then echo "  ok  $1"; return 0; fi
    echo "  Overpass busy, retrying ($i)…"; sleep $((i * 15))
  done
  echo "  failed: $1" >&2; return 1
}

echo "Yeouido detail (roads, buildings, water, parks) — OpenStreetMap"
B='37.512,126.900,37.537,126.955'
overpass "$DATA/osm/y.json" "[out:json][timeout:90];(way[\"highway\"~\"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|service|living_street)\$\"]($B);way[\"natural\"=\"water\"]($B);relation[\"natural\"=\"water\"]($B);way[\"leisure\"=\"park\"]($B);relation[\"leisure\"=\"park\"]($B);way[\"building\"]($B););out geom($B);"
overpass "$DATA/osm/water.json" "[out:json][timeout:120];(relation[\"natural\"=\"water\"]($B);way[\"natural\"=\"water\"]($B);relation[\"leisure\"=\"park\"]($B););out geom;"

echo "Done → $DATA"
