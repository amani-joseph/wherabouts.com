import { getRequestHeaders } from "@tanstack/react-start/server";

const getServerUrl = (): string | null =>
	// In local dev, the web Worker can see Wrangler vars from `wrangler.toml`,
	// which point at production. Prefer the server-side auth URL first so SSR
	// and proxy routes stay on the local backend when `pnpm dev` runs both apps.
	process.env.BETTER_AUTH_URL?.trim() ||
	process.env.VITE_SERVER_URL?.trim() ||
	import.meta.env.VITE_SERVER_URL?.trim() ||
	null;

export const getServerTargetUrl = (
	path: string,
	requestUrl?: string
): URL | null => {
	const serverUrl = getServerUrl();
	if (!serverUrl) {
		return null;
	}

	if (requestUrl) {
		const sourceUrl = new URL(requestUrl);
		return new URL(`${path}${sourceUrl.search}`, serverUrl);
	}

	return new URL(path, serverUrl);
};

export const proxyRequestToServer = async (
	request: Request
): Promise<Response> => {
	const targetUrl = getServerTargetUrl(
		new URL(request.url).pathname,
		request.url
	);
	if (!targetUrl) {
		return Response.json(
			{ error: "Backend server URL is not configured." },
			{ status: 503 }
		);
	}

	const headers = new Headers(request.headers);
	headers.delete("host");
	const body =
		request.method === "GET" || request.method === "HEAD"
			? undefined
			: await request.arrayBuffer();

	return fetch(targetUrl, {
		method: request.method,
		headers,
		body,
		redirect: "manual",
		signal: AbortSignal.timeout(30_000),
	});
};

export const handler = proxyRequestToServer;

export interface BetterAuthSession {
	session: {
		id: string;
		userId: string;
	};
	user: {
		email?: string | null;
		id: string;
		image?: string | null;
		name?: string | null;
	};
}

export const getSession = async (): Promise<BetterAuthSession | null> => {
	const targetUrl = getServerTargetUrl("/api/auth/get-session");
	if (!targetUrl) {
		return null;
	}

	const headers = new Headers(getRequestHeaders());
	headers.delete("content-length");
	headers.delete("transfer-encoding");
	headers.set("accept-encoding", "identity");

	const response = await fetch(targetUrl, { cache: "no-store", headers });

	if (!response.ok) {
		return null;
	}

	const session = (await response.json()) as BetterAuthSession | null;
	return session;
};
