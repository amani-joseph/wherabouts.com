import { createFileRoute, redirect } from "@tanstack/react-router";
import ForgotPassword from "@/components/shadcn-space/blocks/forgot-password-03/forgot-password";

export const Route = createFileRoute("/_auth/forgot-password")({
	beforeLoad: ({ context }) => {
		if (context.isAuthenticated) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	return <ForgotPassword />;
}
