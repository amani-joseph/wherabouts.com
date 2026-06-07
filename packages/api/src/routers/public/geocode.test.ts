import { describe, expect, it } from "vitest";
import { buildGeocodeQuery } from "./geocode-query.ts";

describe("buildGeocodeQuery", () => {
	describe("unstructured mode", () => {
		it("returns q as-is", () => {
			const result = buildGeocodeQuery({
				structured: "false",
				q: "123 Main St Sydney NSW",
			});
			expect(result).toBe("123 Main St Sydney NSW");
		});
	});

	describe("structured mode", () => {
		it("joins street, locality, and state with ', '", () => {
			const result = buildGeocodeQuery({
				structured: "true",
				street: "123 Main St",
				locality: "Sydney",
				state: "NSW",
			});
			expect(result).toBe("123 Main St, Sydney, NSW");
		});

		it("joins only street and locality when state is omitted", () => {
			const result = buildGeocodeQuery({
				structured: "true",
				street: "123 Main St",
				locality: "Sydney",
			});
			expect(result).toBe("123 Main St, Sydney");
		});

		it("joins only street and locality when state is undefined", () => {
			const result = buildGeocodeQuery({
				structured: "true",
				street: "456 Queen St",
				locality: "Brisbane",
				state: undefined,
			});
			expect(result).toBe("456 Queen St, Brisbane");
		});
	});
});
