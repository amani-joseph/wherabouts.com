import { os } from "@orpc/server";

import type { Context } from "./context.ts";

export const o = os.$context<Context>();
