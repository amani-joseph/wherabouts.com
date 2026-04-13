import { createClient } from "@convex-dev/better-auth";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: unknown) => {
	return betterAuth({
		baseURL: process.env.VITE_CONVEX_SITE_URL,
		database: authComponent.adapter(ctx),
		emailAndPassword: {
			enabled: true,
		},
	});
};
