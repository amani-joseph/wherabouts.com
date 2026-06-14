import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema/index.ts";

/** Build the SET LOCAL statement (exported for unit testing). */
export function statementTimeoutSql(budgetMs: number): string {
	if (!Number.isFinite(budgetMs) || budgetMs <= 0) {
		throw new Error(`Invalid statement_timeout budget: ${budgetMs}`);
	}
	return `SET LOCAL statement_timeout = ${Math.floor(budgetMs)}`;
}

export function createPooledDb(databaseUrl: string) {
	const pool = new Pool({ connectionString: databaseUrl });
	return drizzle({ client: pool, schema });
}

export type PooledDatabase = ReturnType<typeof createPooledDb>;

/**
 * Run `fn` inside a transaction bounded by a server-side statement_timeout.
 * A runaway query is cancelled by Postgres (stops Neon compute billing)
 * rather than left running after the Worker aborts the HTTP wait.
 */
export async function withStatementTimeout<T>(
	db: PooledDatabase,
	budgetMs: number,
	fn: (tx: PooledDatabase) => Promise<T>
): Promise<T> {
	return db.transaction(async (tx) => {
		await tx.execute(sql.raw(statementTimeoutSql(budgetMs)));
		return fn(tx as unknown as PooledDatabase);
	});
}
