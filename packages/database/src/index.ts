export type { Database } from "./client.ts";
export { createDb } from "./client.ts";
export type { PooledDatabase } from "./pooled-client.ts";
export { createPooledDb, withStatementTimeout } from "./pooled-client.ts";

import type { Database } from "./client.ts";
import type { PooledDatabase } from "./pooled-client.ts";
export type AnyDatabase = Database | PooledDatabase;
export type {
	Address,
	ApiKey,
	ApiUsageDaily,
	BillingAccount,
	BillingMeterReport,
	NewAddress,
	NewApiKey,
	NewApiUsageDaily,
	NewBillingAccount,
	NewBillingMeterReport,
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
	billingAccounts,
	billingMeterReports,
	projects,
	sessions,
	teamInvitations,
	teamMembers,
	teams,
	users,
	verifications,
} from "./schema/index.ts";
