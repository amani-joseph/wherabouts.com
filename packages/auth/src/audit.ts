const ACTION_BY_SUFFIX: Record<string, string> = {
	"/two-factor/enable": "two_factor.enable",
	"/two-factor/disable": "two_factor.disable",
	"/two-factor/verify-totp": "two_factor.verify",
	"/two-factor/verify-backup-code": "two_factor.verify",
	"/two-factor/generate-backup-codes": "two_factor.regenerate_backup_codes",
	"/revoke-session": "session.revoke",
	"/revoke-sessions": "session.revoke_all",
	"/revoke-other-sessions": "session.revoke_others",
	"/delete-user": "account.delete",
};

const SIGN_IN_PREFIX = "/sign-in/";

/**
 * Map a BetterAuth endpoint path to a stable audit action name. Returns null
 * for paths that should not be recorded. Tolerates an optional `/api/auth`
 * base prefix so it works whether or not the handler strips it.
 */
export function mapAuditAction(path: string): string | null {
	const normalized = path.replace(/^\/api\/auth/, "");
	for (const [suffix, action] of Object.entries(ACTION_BY_SUFFIX)) {
		if (normalized === suffix) {
			return action;
		}
	}
	if (normalized.startsWith(SIGN_IN_PREFIX)) {
		return "auth.sign_in";
	}
	return null;
}
