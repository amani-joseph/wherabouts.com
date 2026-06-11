import {
	boolean,
	date,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { teams } from "./teams.ts";

export const billingAccounts = pgTable(
	"billing_accounts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** "team" | "user" — exactly one of teamId / userId is set */
		ownerType: text("owner_type").notNull(),
		teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
		userId: text("user_id"),
		stripeCustomerId: text("stripe_customer_id"),
		stripeSubscriptionId: text("stripe_subscription_id"),
		/** "free" | "active" | "past_due" | "canceled" */
		status: text("status").notNull().default("free"),
		hasPaymentMethod: boolean("has_payment_method").notNull().default(false),
		freeAllotment: integer("free_allotment").notNull().default(10_000),
		currentPeriodStart: date("current_period_start", { mode: "string" }),
		currentPeriodRequests: integer("current_period_requests")
			.notNull()
			.default(0),
		blocked: boolean("blocked").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("uq_billing_accounts_team").on(table.teamId),
		uniqueIndex("uq_billing_accounts_user").on(table.userId),
		uniqueIndex("uq_billing_accounts_stripe_customer").on(
			table.stripeCustomerId
		),
	]
);

export const billingMeterReports = pgTable(
	"billing_meter_reports",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		billingAccountId: uuid("billing_account_id")
			.notNull()
			.references(() => billingAccounts.id, { onDelete: "cascade" }),
		usageDate: date("usage_date", { mode: "string" }).notNull(),
		/** Running total already reported to Stripe for this (account, date) */
		reportedCount: integer("reported_count").notNull().default(0),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("uq_billing_meter_reports_account_date").on(
			table.billingAccountId,
			table.usageDate
		),
		index("idx_billing_meter_reports_account").on(table.billingAccountId),
	]
);

export type BillingAccount = typeof billingAccounts.$inferSelect;
export type NewBillingAccount = typeof billingAccounts.$inferInsert;
export type BillingMeterReport = typeof billingMeterReports.$inferSelect;
export type NewBillingMeterReport = typeof billingMeterReports.$inferInsert;
