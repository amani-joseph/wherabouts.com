import { z } from "zod";
import { ok } from "../errors.ts";
import type { ToolDef } from "../types.ts";

export const deviceTools: ToolDef[] = [
	{
		name: "device_zones",
		description: "Get the current zone membership for a device by its id.",
		inputSchema: { deviceId: z.string().min(1).max(255) },
		annotations: { readOnlyHint: true },
		handler: (client, args) =>
			client.devices.zones(args.deviceId as string).then(ok),
	},
];
