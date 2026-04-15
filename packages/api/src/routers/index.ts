import { apiExplorerRouter } from "./domains/api-explorer.ts";
import { apiKeysRouter } from "./domains/api-keys.ts";
import { authRouter } from "./domains/auth.ts";
import { dashboardRouter } from "./domains/dashboard.ts";
import { projectsRouter } from "./domains/projects.ts";

export const appRouter = {
	apiExplorer: apiExplorerRouter,
	apiKeys: apiKeysRouter,
	auth: authRouter,
	dashboard: dashboardRouter,
	projects: projectsRouter,
};

export type AppRouter = typeof appRouter;
