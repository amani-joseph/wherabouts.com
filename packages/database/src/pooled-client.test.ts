import { describe, expect, it } from "vitest";
import { statementTimeoutSql } from "./pooled-client.ts";

describe("statementTimeoutSql", () => {
	it("formats an integer millisecond budget as a SET LOCAL statement", () => {
		expect(statementTimeoutSql(3000)).toBe(
			"SET LOCAL statement_timeout = 3000"
		);
	});
	it("rejects non-positive budgets", () => {
		expect(() => statementTimeoutSql(0)).toThrow();
		expect(() => statementTimeoutSql(-1)).toThrow();
	});
});
