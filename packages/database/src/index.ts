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
	NewTeam,
	NewTeamInvitation,
	NewTeamMember,
	Project,
	Team,
	TeamInvitation,
	TeamMember,
} from "./schema/index.ts";
export {
	accounts,
	addresses,
	apiKeys,
	apiUsageDaily,
	authSchema,
	projects,
	sessions,
	teamInvitations,
	teamMembers,
	teams,
	users,
	verifications,
} from "./schema/index.ts";
