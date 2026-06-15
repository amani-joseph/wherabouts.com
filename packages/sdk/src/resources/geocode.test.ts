import { describe, expect, it, vi } from "vitest";
import type { GeocodeAddress } from "./geocode.ts";
import { createGeocode } from "./geocode.ts";

function fakeRequest() {
	return vi.fn((_opts: unknown) => Promise.resolve({} as never));
}

describe("createGeocode", () => {
	describe("forward", () => {
		it("issues GET to /api/v1/addresses/geocode with unstructured params", async () => {
			const request = fakeRequest();
			const geocode = createGeocode(request);
			await geocode.forward({ q: "123 Main St Sydney" });
			expect(request).toHaveBeenCalledWith({
				method: "GET",
				path: "/api/v1/addresses/geocode",
				query: {
					q: "123 Main St Sydney",
					structured: undefined,
					street: undefined,
					locality: undefined,
					state: undefined,
					postcode: undefined,
					country: undefined,
				},
			});
		});

		it("issues GET to /api/v1/addresses/geocode with structured params", async () => {
			const request = fakeRequest();
			const geocode = createGeocode(request);
			await geocode.forward({
				structured: "true",
				street: "123 Main St",
				locality: "Sydney",
				state: "NSW",
				postcode: "2000",
				country: "AU",
			});
			expect(request).toHaveBeenCalledWith({
				method: "GET",
				path: "/api/v1/addresses/geocode",
				query: {
					q: undefined,
					structured: "true",
					street: "123 Main St",
					locality: "Sydney",
					state: "NSW",
					postcode: "2000",
					country: "AU",
				},
			});
		});
	});

	describe("batch.submit", () => {
		it("issues POST to /api/v1/geocode/batch with body", async () => {
			const request = fakeRequest();
			const geocode = createGeocode(request);
			const body = { addresses: ["123 Main St Sydney NSW 2000"] };
			await geocode.batch.submit(body);
			expect(request).toHaveBeenCalledWith({
				method: "POST",
				path: "/api/v1/geocode/batch",
				body,
			});
		});
	});

	describe("batch.poll", () => {
		it("issues GET to interpolated batch job path", async () => {
			const request = fakeRequest();
			const geocode = createGeocode(request);
			await geocode.batch.poll("job_1");
			expect(request).toHaveBeenCalledWith({
				method: "GET",
				path: "/api/v1/geocode/batch/job_1",
			});
		});
	});

	describe("batch.results", () => {
		it("issues GET to interpolated batch results path", async () => {
			const request = fakeRequest();
			const geocode = createGeocode(request);
			await geocode.batch.results("job_1");
			expect(request).toHaveBeenCalledWith({
				method: "GET",
				path: "/api/v1/geocode/batch/job_1/results",
			});
		});
	});

	describe("GeocodeAddress type", () => {
		it("has streetName, streetNumber, and streetType fields (type-level)", () => {
			// Compile-time check: assign a literal that includes the new fields.
			// If the interface is missing any field, TypeScript will error here.
			const addr: GeocodeAddress = {
				country: "AU",
				formattedAddress: "34 Boxgrove Avenue, Epping NSW 2121",
				id: 1,
				latitude: -33.77,
				locality: "EPPING",
				longitude: 151.08,
				postcode: "2121",
				state: "NSW",
				streetAddress: "34 BOXGROVE AVENUE",
				streetName: "BOXGROVE",
				streetNumber: "34",
				streetType: "AVENUE",
			};
			expect(addr.streetName).toBe("BOXGROVE");
			expect(addr.streetNumber).toBe("34");
			expect(addr.streetType).toBe("AVENUE");
		});

		it("allows null values for streetName, streetNumber, and streetType", () => {
			const addr: GeocodeAddress = {
				country: "AU",
				formattedAddress: "Lot 1 Some Road, Rural NSW 2800",
				id: 2,
				latitude: -33.0,
				locality: "RURAL",
				longitude: 150.0,
				postcode: "2800",
				state: "NSW",
				streetAddress: "LOT 1 SOME ROAD",
				streetName: null,
				streetNumber: null,
				streetType: null,
			};
			expect(addr.streetName).toBeNull();
			expect(addr.streetNumber).toBeNull();
			expect(addr.streetType).toBeNull();
		});
	});
});
