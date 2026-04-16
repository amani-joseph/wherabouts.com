export type { Database } from "./client.ts";
export { createDb } from "./client.ts";
export type {
	Address,
	ApiKey,
	ApiUsageDaily,
	NewAddress,
	NewApiKey,
	NewApiUsageDaily,
	NewProject,
	Project,
} from "./schema/index.ts";
export {
	accounts,
	addresses,
	apiKeys,
	apiUsageDaily,
	authSchema,
	projects,
	sessions,
	users,
	verifications,
} from "./schema/index.ts";
