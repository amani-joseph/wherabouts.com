import { createFileRoute } from "@tanstack/react-router";
import ResetPassword from "@/components/shadcn-space/blocks/reset-password-03/reset-password";

interface ResetPasswordSearch {
	token?: string;
}

export const Route = createFileRoute("/_auth/reset-password")({
	validateSearch: (search: Record<string, unknown>): ResetPasswordSearch => ({
		token: typeof search.token === "string" ? search.token : undefined,
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const { token } = Route.useSearch();
	return <ResetPassword token={token} />;
}
