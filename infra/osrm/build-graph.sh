#!/usr/bin/env bash
# Builds the OSRM car graph from the latest Australia OSM extract.
# Run locally (needs ~8GB RAM, Docker). Outputs australia-latest.osrm* into ./data.
set -euo pipefail

DATA_DIR="${1:-./data}"
OSRM_IMAGE="ghcr.io/project-osrm/osrm-backend:v5.27.1"
EXTRACT_URL="https://download.geofabrik.de/australia-oceania/australia-latest.osm.pbf"

mkdir -p "$DATA_DIR"
cd "$DATA_DIR"

echo "Downloading Australia OSM extract..."
curl -fSL "$EXTRACT_URL" -o australia-latest.osm.pbf

run() { docker run --rm -v "${PWD}:/data" "$OSRM_IMAGE" "$@"; }

echo "Extracting (car profile)..."
run osrm-extract -p /opt/car.lua /data/australia-latest.osm.pbf
echo "Partitioning..."
run osrm-partition /data/australia-latest.osrm
echo "Customizing..."
run osrm-customize /data/australia-latest.osrm

echo "Done. Artifacts in $DATA_DIR (australia-latest.osrm*)."
