import { ORPCError } from "@orpc/server";

import { o } from "./builder.ts";

export const publicProcedure = o;

export const protectedProcedure = publicProcedure.use(({ context, next }) => {
	if (!context.session) {
		throw new ORPCError("UNAUTHORIZED");
	}

	return next({
		context: {
			...context,
			session: context.session,
		},
	});
});
