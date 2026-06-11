# Serves prebuilt OSRM car/bike/foot graphs behind a Caddy reverse proxy that
# enforces a bearer token (OSRM_AUTH_TOKEN) and routes by profile path segment.
# The osrm-routed instances bind to localhost only. Graphs are built separately
# by build-graph.sh and mounted into /data/{car,bike,foot}.
FROM ghcr.io/project-osrm/osrm-backend:v5.27.1

# Install Caddy (auth-enforcing public entrypoint).
RUN apt-get update \
	&& apt-get install -y --no-install-recommends curl gnupg ca-certificates debian-keyring debian-archive-keyring apt-transport-https \
	&& curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg \
	&& curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list \
	&& apt-get update \
	&& apt-get install -y --no-install-recommends caddy \
	&& rm -rf /var/lib/apt/lists/*

COPY Caddyfile /etc/caddy/Caddyfile
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Public port served by Caddy; osrm-routed listens only on localhost:5001.
EXPOSE 5000

WORKDIR /data

CMD ["/usr/local/bin/entrypoint.sh"]
