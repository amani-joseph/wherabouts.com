import { describe, expect, it } from "vitest";
import { API_KEY_PREFIX } from "../../api-key-auth.ts";
import { decryptSecret } from "../../secret-crypto.ts";
import { createApiKeyRecord } from "./api-keys-shared.ts";

type DbArg = Parameters<typeof createApiKeyRecord>[0];

/**
 * Builds a fake db that captures the row passed to `insert(...).values(...)`,
 * so we can assert what `createApiKeyRecord` persists without touching Postgres.
 */
function createCapturingDb() {
	const captured: { row: Record<string, unknown> | null } = { row: null };
	const db = {
		insert: () => ({
			values: (row: Record<string, unknown>) => {
				captured.row = row;
				return Promise.resolve();
			},
		}),
	} as unknown as DbArg;
	return { captured, db };
}

describe("createApiKeyRecord", () => {
	it("stores a ciphertext that decrypts back to the returned plaintext key", async () => {
		const { captured, db } = createCapturingDb();

		const record = await createApiKeyRecord(db, {
			userId: "user-1",
			name: "Production",
			projectId: null,
		});

		expect(record.key.startsWith(API_KEY_PREFIX)).toBe(true);

		const ciphertext = captured.row?.secretCiphertext as string | undefined;
		expect(ciphertext).toBeTruthy();
		// The stored value must be encrypted, not the raw key.
		expect(ciphertext).not.toBe(record.key);
		expect(ciphertext).not.toContain(record.key);
		// And it must round-trip to exactly the key shown once at creation.
		expect(decryptSecret(ciphertext as string)).toBe(record.key);
	});

	it("never persists the plaintext key or salt as the hash", async () => {
		const { captured, db } = createCapturingDb();

		const record = await createApiKeyRecord(db, {
			userId: "user-2",
			name: "Staging",
			projectId: null,
		});

		expect(captured.row?.secretHash).not.toBe(record.key);
		expect(captured.row?.secretSalt).toBeTruthy();
		expect(captured.row?.secretDisplaySuffix).toBeTruthy();
	});
});
