import type {
	accounts,
	sessions,
	users,
	verifications,
} from "@wherabouts.com/database";
import type { InferSelectModel } from "drizzle-orm";
import type { HonoRequest } from "hono";
import { auth } from "./auth.ts";
import { db } from "./db.ts";

export interface CreateContextOptions {
	req: HonoRequest;
}

export const createContext = async ({ req }: CreateContextOptions) => {
	const session = await auth.api.getSession({
		headers: req.raw.headers,
	});

	return {
		db,
		req,
		session,
	};
};

export type Context = Awaited<ReturnType<typeof createContext>>;
export type AuthAccount = InferSelectModel<typeof accounts>;
export type AuthSession = InferSelectModel<typeof sessions>;
export type AuthUser = InferSelectModel<typeof users>;
export type AuthVerification = InferSelectModel<typeof verifications>;
