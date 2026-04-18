import { authSchema, teamMembers, teams } from "@wherabouts.com/database";
import { serverEnv } from "@wherabouts.com/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { Resend } from "resend";
import { db } from "./db.ts";

const TRAILING_SLASH_REGEX = /\/$/;
const SLUG_SANITIZE_REGEX = /[^a-z0-9]+/g;
const SLUG_TRIM_REGEX = /^-+|-+$/g;
const DEPLOYED_WEB_ORIGIN =
	process.env.DEPLOYED_WEB_ORIGIN ?? "https://wherabouts.com";

const trustedOrigins = Array.from(
	new Set([
		serverEnv.WEB_BASE_URL.replace(TRAILING_SLASH_REGEX, ""),
		DEPLOYED_WEB_ORIGIN,
		"http://localhost:3001",
		"https://wherabouts.com",
		"https://api.wherabouts.com",
	])
);

const cookieDomain = serverEnv.AUTH_COOKIE_DOMAIN?.trim();

type InviteTemplateParams = {
	teamName: string;
	inviterName: string;
	inviterEmail: string;
	inviteUrl: string;
};

/**
 * Build the HTML body for the Resend invitation email.
 *
 * Follows 08-UI-SPEC Email Template Contract: single-column, 600px max,
 * white bg #ffffff, dark text #1a1a1a, mono font stack, CTA bg #dedede
 * text #1a1a1a radius 8px, heading 24px semibold, body 14px/1.5,
 * footer 12px/#6b6b6b.
 */
function buildInviteHtml({
	teamName,
	inviterName,
	inviterEmail,
	inviteUrl,
}: InviteTemplateParams): string {
	const fontStack = "ui-monospace, 'Courier New', monospace";
	return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Invitation to ${teamName} on Wherabouts</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;color:#1a1a1a;font-family:${fontStack};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
            <tr>
              <td style="padding:0 0 24px 0;font-family:${fontStack};font-size:14px;font-weight:600;color:#1a1a1a;letter-spacing:0.02em;">
                Wherabouts
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 16px 0;font-family:${fontStack};font-size:24px;font-weight:600;line-height:1.3;color:#1a1a1a;">
                ${inviterName} has invited you to join ${teamName} on Wherabouts
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 24px 0;font-family:${fontStack};font-size:14px;line-height:1.5;color:#1a1a1a;">
                Click the button below to accept this invitation. This link expires in 72 hours.
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 24px 0;">
                <a href="${inviteUrl}" style="display:inline-block;background:#dedede;color:#1a1a1a;text-decoration:none;padding:12px 24px;border-radius:8px;font-family:${fontStack};font-size:14px;font-weight:600;">Accept invitation</a>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 0 0 0;border-top:1px solid #ececec;font-family:${fontStack};font-size:12px;line-height:1.5;color:#6b6b6b;">
                If you weren't expecting this, you can ignore this email. This invitation was sent by ${inviterEmail}.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Plain-text fallback. Includes team name, inviter name, and full URL on
 * its own line so email clients without HTML can still accept invites.
 */
function buildInviteText({
	teamName,
	inviterName,
	inviteUrl,
}: Omit<InviteTemplateParams, "inviterEmail">): string {
	return [
		`${inviterName} has invited you to join ${teamName} on Wherabouts.`,
		"",
		"Accept this invitation by opening the link below. It expires in 72 hours.",
		"",
		inviteUrl,
		"",
		"If you weren't expecting this, you can ignore this email.",
	].join("\n");
}

export const auth = betterAuth({
	baseURL: serverEnv.BETTER_AUTH_URL,
	secret: serverEnv.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: authSchema,
	}),
	trustedOrigins,
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
	},
	socialProviders: {
		github: {
			clientId: serverEnv.GITHUB_CLIENT_ID,
			clientSecret: serverEnv.GITHUB_CLIENT_SECRET,
		},
	},
	advanced: {
		defaultCookieAttributes: {
			sameSite: "none",
			secure: true,
			httpOnly: true,
			...(cookieDomain ? { domain: cookieDomain } : {}),
		},
	},
	rateLimit: {
		enabled: true,
		window: 10,
		max: 100,
	},
	plugins: [
		organization({
			allowUserToCreateOrganization: true,
			organizationLimit: 10,
			invitationExpiresIn: 60 * 60 * 72, // 72 hours
			sendInvitationEmail: async (data) => {
				const resend = new Resend(serverEnv.RESEND_API_KEY);
				const inviteUrl = `${serverEnv.WEB_BASE_URL.replace(TRAILING_SLASH_REGEX, "")}/invite/${data.id}`;
				const inviterName =
					data.inviter.user.name ?? data.inviter.user.email;
				await resend.emails.send({
					from: serverEnv.EMAIL_FROM,
					to: data.email,
					subject: `${inviterName} invited you to ${data.organization.name} on Wherabouts`,
					html: buildInviteHtml({
						teamName: data.organization.name,
						inviterName,
						inviterEmail: data.inviter.user.email,
						inviteUrl,
					}),
					text: buildInviteText({
						teamName: data.organization.name,
						inviterName,
						inviteUrl,
					}),
				});
			},
		}),
	],
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					const displayName =
						user.name ?? user.email.split("@")[0] ?? "user";
					const baseSlug = displayName
						.toLowerCase()
						.replace(SLUG_SANITIZE_REGEX, "-")
						.replace(SLUG_TRIM_REGEX, "");
					const slug = `${baseSlug || "user"}-${user.id.slice(0, 8)}`;
					const [team] = await db
						.insert(teams)
						.values({
							name: `${displayName}'s Personal`,
							slug,
						})
						.returning();
					if (!team) {
						throw new Error(
							"Failed to auto-create Personal team for new user"
						);
					}
					await db.insert(teamMembers).values({
						teamId: team.id,
						userId: user.id,
						role: "owner",
					});
				},
			},
		},
	},
});
