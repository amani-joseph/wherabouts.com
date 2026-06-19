import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { buildClient } from "./client.ts";
import { registerTools } from "./register.ts";
import type { Props } from "./types.ts";

type Env = { WHERABOUTS_API_BASE_URL: string };

export class WheraboutsMcp extends McpAgent<Env, unknown, Props> {
	server = new McpServer({ name: "wherabouts", version: "0.1.0" });

	async init() {
		registerTools(this.server, () =>
			buildClient(this.props!.apiKey, this.env.WHERABOUTS_API_BASE_URL)
		);
	}
}

const extractApiKey = (request: Request): string | null => {
	const auth = request.headers.get("authorization");
	if (auth?.toLowerCase().startsWith("bearer ")) {
		return auth.slice(7).trim() || null;
	}
	return request.headers.get("x-api-key")?.trim() || null;
};

const mcpHandler = WheraboutsMcp.serve("/mcp", { binding: "MCP_OBJECT" });

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		const apiKey = extractApiKey(request);
		if (!apiKey) {
			return new Response(
				JSON.stringify({
					error: "Missing API key. Send Authorization: Bearer <key>.",
				}),
				{
					status: 401,
					headers: {
						"content-type": "application/json",
						"WWW-Authenticate": "Bearer",
					},
				}
			);
		}
		(ctx as ExecutionContext & { props: Props }).props = { apiKey };
		return mcpHandler.fetch(request, env, ctx);
	},
};
