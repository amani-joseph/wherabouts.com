import { existsSync } from "node:fs";
import path from "node:path";

import { createEnv } from "@t3-oss/env-core";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

const resolveEnvSearchRoots = (): string[] => {
	const roots = new Set<string>();
	let currentDirectory = process.cwd();

	roots.add(currentDirectory);

	while (true) {
		const parentDirectory = path.dirname(currentDirectory);
		if (parentDirectory === currentDirectory) {
			break;
		}
		roots.add(parentDirectory);
		currentDirectory = parentDirectory;
	}

	return [...roots];
};

const loadWorkspaceEnv = () => {
	const candidateFiles = [
		".env",
		".env.local",
		path.join("apps", "web", ".env"),
		path.join("apps", "web", ".env.local"),
		path.join("apps", "server", ".env"),
		path.join("apps", "server", ".env.local"),
	];
	const matchedEnvFiles: string[] = [];

	for (const rootDirectory of resolveEnvSearchRoots()) {
		for (const candidateFile of candidateFiles) {
			const envPath = path.join(rootDirectory, candidateFile);
			if (!existsSync(envPath)) {
				continue;
			}
			matchedEnvFiles.push(envPath);

			loadEnv({
				path: envPath,
				override: true,
			});
		}
	}
};

loadWorkspaceEnv();

export const serverEnv = createEnv({
	server: {
		DATABASE_URL: z.string().url(),
		BETTER_AUTH_SECRET: z.string().min(1),
		BETTER_AUTH_URL: z.string().url(),
		GITHUB_CLIENT_ID: z.string().min(1),
		GITHUB_CLIENT_SECRET: z.string().min(1),
		WEB_BASE_URL: z.string().url(),
		PORT: z.coerce.number().int().positive().default(3002),
	},
	runtimeEnv: {
		...process.env,
		// TanStack Start's local worker picks up `apps/web/.env`, which doesn't define
		// this yet. Keep local SSR bootable and still allow explicit override elsewhere.
		WEB_BASE_URL: process.env.WEB_BASE_URL ?? "http://localhost:3001",
	},
	emptyStringAsUndefined: true,
});
