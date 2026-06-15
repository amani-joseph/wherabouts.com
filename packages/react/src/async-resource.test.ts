import { describe, expect, it, vi } from "vitest";
import { runResource } from "./async-resource.ts";

function actions() {
	return {
		onSuccess: vi.fn(),
		onError: vi.fn(),
		onSettled: vi.fn(),
	};
}

describe("runResource", () => {
	it("routes a resolved value through onSuccess then onSettled", async () => {
		const a = actions();
		await runResource(Promise.resolve(42), { aborted: false }, a);
		expect(a.onSuccess).toHaveBeenCalledWith(42);
		expect(a.onError).not.toHaveBeenCalled();
		expect(a.onSettled).toHaveBeenCalledTimes(1);
	});

	it("routes a rejection through onError (as an Error) then onSettled", async () => {
		const a = actions();
		await runResource(Promise.reject("boom"), { aborted: false }, a);
		expect(a.onSuccess).not.toHaveBeenCalled();
		expect(a.onError).toHaveBeenCalledTimes(1);
		const err = a.onError.mock.calls[0]?.[0];
		expect(err).toBeInstanceOf(Error);
		expect((err as Error).message).toBe("boom");
		expect(a.onSettled).toHaveBeenCalledTimes(1);
	});

	it("suppresses all callbacks once the signal is aborted", async () => {
		const a = actions();
		await runResource(Promise.resolve(1), { aborted: true }, a);
		expect(a.onSuccess).not.toHaveBeenCalled();
		expect(a.onError).not.toHaveBeenCalled();
		expect(a.onSettled).not.toHaveBeenCalled();
	});

	it("suppresses callbacks when aborted after a rejection", async () => {
		const a = actions();
		await runResource(Promise.reject(new Error("x")), { aborted: true }, a);
		expect(a.onError).not.toHaveBeenCalled();
		expect(a.onSettled).not.toHaveBeenCalled();
	});
});
