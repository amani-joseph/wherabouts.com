import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	clientPrefix: "VITE_",
	client: {
		VITE_SERVER_URL: z.url(),
		VITE_MAPTILER_KEY: z.string().optional(),
	},
	runtimeEnv: import.meta.env,
	emptyStringAsUndefined: true,
});
