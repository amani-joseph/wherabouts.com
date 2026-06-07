import { describe, expect, it, vi } from "vitest";
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
});
