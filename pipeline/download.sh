#!/usr/bin/env bash
# Downloads input data: the GTFS feed, the OSM networks (Geofabrik + pyosmium)
# and MapLibre GL. Everything is cached — re-running only fetches what is
# missing.
#
# ONE feed makes this map, and it is not a Barcelona feed: the open transport
# data of Catalonia (ATM / Generalitat, published through MobilityDatabase as
# mdb-2832) carries 1 615 routes of 180 operators, from TMB's metro to a
# village coach in the Pyrenees. pipeline/scope.mjs cuts the Barcelona share of
# it by distance from Plaça de Catalunya — see its header for the thresholds —
# and writes data/scope.json, which build.mjs then treats as the allowlist.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/gtfs data/osm/tiles web/vendor

# 1) GTFS — the Catalan bundle
if [ ! -f data/gtfs/routes.txt ]; then
  echo "== GTFS Catalunya (mdb-2832) =="
  curl -fL --retry 3 --max-time 900 -o data/gtfs.zip \
    "https://files.mobilitydatabase.org/mdb-2832/latest.zip"
  unzip -o data/gtfs.zip -d data/gtfs
fi

# 2) scope: which of those routes are on a Barcelona sheet, plus line keys
if [ ! -f data/scope.json ]; then
  node --max-old-space-size=8192 pipeline/scope.mjs
fi

# 3) OSM — from the Geofabrik cataluña extract, not Overpass: the sheet is
#    72 × 67 km of roads, far past what a public mirror will serve.
#    pipeline/pbf-tiles.py (needs `pip3 install --user osmium`) cuts a 3 × 3
#    road grid and one rail box — the rail box is much larger than the road
#    grid, because the trains are drawn whole and run to Manresa and Maçanet.
if [ ! -f data/osm/tiles/t9.json ] || [ ! -f data/osm/barcelona-rail.json ]; then
  python3 -c "import osmium" 2>/dev/null || { echo "brak pakietu osmium — zainstaluj: pip3 install --user osmium" >&2; exit 1; }
  if [ ! -f data/cataluna-latest.osm.pbf ]; then
    echo "== Geofabrik cataluna-latest.osm.pbf =="
    curl -fL --retry 5 --retry-delay 5 -C - --max-time 3600 -o data/cataluna-latest.osm.pbf \
      "https://download.geofabrik.de/europe/spain/cataluna-latest.osm.pbf"
  fi
  echo "== cutting OSM out of the extract =="
  python3 pipeline/pbf-tiles.py
fi

# 4) MapLibre GL (vendored, no CDN at runtime)
if [ ! -f web/vendor/maplibre-gl.js ]; then
  echo "== MapLibre GL =="
  curl -fL --retry 3 -o web/vendor/maplibre-gl.js  https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js
  curl -fL --retry 3 -o web/vendor/maplibre-gl.css https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.css
fi

echo "OK — data ready:"
du -sh data/gtfs data/osm 2>/dev/null || true
