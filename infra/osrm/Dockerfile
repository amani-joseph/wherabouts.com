# Serves a prebuilt OSRM car graph. The graph is built separately by
# build-graph.sh and mounted/copied into /data at deploy time.
FROM ghcr.io/project-osrm/osrm-backend:v5.27.1

# Auth is enforced by a lightweight proxy in front (see README); osrm-routed
# itself is bound only to the internal network.
EXPOSE 5000

# /data holds australia-latest.osrm* artifacts (Fly volume or COPY).
WORKDIR /data

CMD ["osrm-routed", "--algorithm", "mld", "/data/australia-latest.osrm", "--max-table-size", "10000"]
