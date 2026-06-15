#!/usr/bin/env bash
# Builds OSRM car + bike + foot graphs from the latest Australia OSM extract.
# Run locally (needs ~8GB RAM during build, Docker). Outputs one MLD graph per
# profile into ./data/{car,bike,foot}/australia-latest.osrm* so the three graph
# sets coexist and can be served side-by-side (see entrypoint.sh + Caddyfile).
set -euo pipefail

DATA_DIR="${1:-./data}"
OSRM_IMAGE="ghcr.io/project-osrm/osrm-backend:v5.27.1"
EXTRACT_URL="https://download.geofabrik.de/australia-oceania/australia-latest.osm.pbf"

mkdir -p "$DATA_DIR"
cd "$DATA_DIR"

echo "Downloading Australia OSM extract..."
curl -fSL "$EXTRACT_URL" -o australia-latest.osm.pbf

run() { docker run --rm -v "${PWD}:/data" "$OSRM_IMAGE" "$@"; }

# OSRM names its outputs after the input basename, so each profile gets a private
# copy of the pbf under /data/<profile>/. The stock image ships car.lua,
# bicycle.lua and foot.lua under /opt.
build_profile() {
	local profile="$1" lua="$2"
	echo "=== Building ${profile} graph (${lua}) ==="
	mkdir -p "$profile"
	cp australia-latest.osm.pbf "${profile}/australia-latest.osm.pbf"
	run osrm-extract -p "/opt/${lua}" "/data/${profile}/australia-latest.osm.pbf"
	run osrm-partition "/data/${profile}/australia-latest.osrm"
	run osrm-customize "/data/${profile}/australia-latest.osrm"
	# The per-profile pbf copy is only needed during extract; drop it to save disk.
	rm -f "${profile}/australia-latest.osm.pbf"
}

build_profile car car.lua
build_profile bike bicycle.lua
build_profile foot foot.lua

echo "Done. Graphs in ${DATA_DIR}/{car,bike,foot}/australia-latest.osrm*."
