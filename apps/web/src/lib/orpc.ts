import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouter } from "@wherabouts.com/api";

const getRpcUrl = (): string => {
	if (typeof window !== "undefined") {
		return new URL("/rpc", window.location.origin).toString();
	}

	const baseUrl = process.env.WEB_BASE_URL?.trim() || "http://localhost:3001";
	return new URL("/rpc", baseUrl).toString();
};

const link = new RPCLink({
	url: getRpcUrl(),
	fetch(url, options) {
		return fetch(url, {
			...options,
			credentials: "include",
		});
	},
});

export const orpcClient = createORPCClient(link) as RouterClient<AppRouter>;

/** TanStack Query utils for type-safe query keys and cache management */
export const orpc = createTanstackQueryUtils(orpcClient);
