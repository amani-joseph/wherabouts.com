export interface DeleteConfirmationInput {
	accountEmail: string | null | undefined;
	password: string;
	totpCode: string;
	twoFactorEnabled: boolean;
	typedEmail: string;
}

const SIX_DIGITS = /^\d{6}$/;

/** Validate the multi-step delete-account form before allowing submission. */
export function validateDeleteConfirmation(input: DeleteConfirmationInput): {
	valid: boolean;
	errors: Record<string, string>;
} {
	const errors: Record<string, string> = {};
	const account = (input.accountEmail ?? "").trim().toLowerCase();
	if (!account || input.typedEmail.trim().toLowerCase() !== account) {
		errors.email = "Type your account email exactly to confirm.";
	}
	if (!input.password) {
		errors.password = "Password is required.";
	}
	if (input.twoFactorEnabled && !SIX_DIGITS.test(input.totpCode.trim())) {
		errors.totpCode = "Enter the 6-digit code from your authenticator.";
	}
	return { valid: Object.keys(errors).length === 0, errors };
}
