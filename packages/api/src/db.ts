import { createDb, createPooledDb } from "@wherabouts.com/database";
import { serverEnv } from "@wherabouts.com/env/server";

export const db = createDb(serverEnv.DATABASE_URL);

// Session-capable pooled client for hot paths that need a per-request
// statement_timeout backstop (geocode/autocomplete). neon-http is stateless,
// so a SET there does not persist; the pooled WebSocket driver holds a session.
export const pooledDb = createPooledDb(serverEnv.DATABASE_URL);
