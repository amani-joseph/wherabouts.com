import { describe, expect, it } from "vitest";
import { resolveDirectionsInput } from "./routing.ts";

describe("resolveDirectionsInput", () => {
	const db = {} as never;

	it("uses coords when from/to provided", async () => {
		const result = await resolveDirectionsInput(db, {
			from: "-37.8136,144.9631",
			to: "-33.8688,151.2093",
		});
		expect(result).toEqual({
			from: { lat: -37.8136, lng: 144.9631 },
			to: { lat: -33.8688, lng: 151.2093 },
		});
	});

	it("throws bad_request when neither coords nor addressId given for an endpoint", async () => {
		await expect(
			resolveDirectionsInput(db, { to: "-33.8688,151.2093" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("throws bad_request when both coords and addressId given", async () => {
		await expect(
			resolveDirectionsInput(db, {
				from: "-37.8,144.9",
				fromAddressId: 5,
				to: "-33.8,151.2",
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("throws bad_request on malformed coords", async () => {
		await expect(
			resolveDirectionsInput(db, { from: "nope", to: "-33.8,151.2" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
