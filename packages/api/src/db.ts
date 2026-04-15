import { createDb } from "@wherabouts.com/database";
import { serverEnv } from "@wherabouts.com/env/server";

export const db = createDb(serverEnv.DATABASE_URL);
