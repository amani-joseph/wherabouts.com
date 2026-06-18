import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";

type Env = { WHERABOUTS_API_BASE_URL: string };
type Props = { apiKey: string };

export class WheraboutsMcp extends McpAgent<Env, unknown, Props> {
	server = new McpServer({ name: "wherabouts", version: "0.1.0" });

	async init() {
		this.server.registerTool(
			"ping",
			{ description: "Health check", inputSchema: {} },
			async () => ({ content: [{ type: "text", text: "ok" }] })
		);
	}
}

export default WheraboutsMcp.serve("/mcp", { binding: "MCP_OBJECT" });
