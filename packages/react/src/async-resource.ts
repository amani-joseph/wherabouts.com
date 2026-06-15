/** Minimal view of AbortSignal — only the `aborted` flag is needed here. */
export interface AbortLike {
	aborted: boolean;
}

export interface ResourceActions<T> {
	onError: (error: Error) => void;
	onSettled: () => void;
	onSuccess: (data: T) => void;
}

/**
 * Await `promise` and route the outcome through `actions`, skipping every
 * callback once `signal` is aborted (so a stale request can't clobber the
 * state of a newer one). Shared by the data-fetching hooks.
 */
export async function runResource<T>(
	promise: Promise<T>,
	signal: AbortLike,
	actions: ResourceActions<T>
): Promise<void> {
	try {
		const data = await promise;
		if (!signal.aborted) {
			actions.onSuccess(data);
		}
	} catch (e) {
		if (!signal.aborted) {
			actions.onError(e instanceof Error ? e : new Error(String(e)));
		}
	} finally {
		if (!signal.aborted) {
			actions.onSettled();
		}
	}
}
