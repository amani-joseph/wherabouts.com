import { apiExplorerRouter } from "./domains/api-explorer.ts";
import { apiKeysRouter } from "./domains/api-keys.ts";
import { authRouter } from "./domains/auth.ts";
import { dashboardRouter } from "./domains/dashboard.ts";
import { geocodeRouter } from "./domains/geocode.ts";
import { projectsRouter } from "./domains/projects.ts";
import { webhooksRouter } from "./domains/webhooks.ts";
import { zonesRouter } from "./domains/zones.ts";

export const appRouter = {
	apiExplorer: apiExplorerRouter,
	apiKeys: apiKeysRouter,
	auth: authRouter,
	dashboard: dashboardRouter,
	geocode: geocodeRouter,
	projects: projectsRouter,
	zones: zonesRouter,
	webhooks: webhooksRouter,
};

export type AppRouter = typeof appRouter;
