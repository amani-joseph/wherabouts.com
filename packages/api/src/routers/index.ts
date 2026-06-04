import { apiExplorerRouter } from "./domains/api-explorer.ts";
import { apiKeysRouter } from "./domains/api-keys.ts";
import { authRouter } from "./domains/auth.ts";
import { dashboardRouter } from "./domains/dashboard.ts";
import { projectsRouter } from "./domains/projects.ts";
import { zonesRouter } from "./domains/zones.ts";

export const appRouter = {
	apiExplorer: apiExplorerRouter,
	apiKeys: apiKeysRouter,
	auth: authRouter,
	dashboard: dashboardRouter,
	projects: projectsRouter,
	zones: zonesRouter,
};

export type AppRouter = typeof appRouter;
