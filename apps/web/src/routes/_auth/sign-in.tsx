import { createFileRoute, redirect } from "@tanstack/react-router";
import LoginForm from "@/components/shadcn-space/blocks/login-03/login";

export const Route = createFileRoute("/_auth/sign-in")({
	beforeLoad: ({ context }) => {
		if (context.isAuthenticated) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	return <LoginForm />;
}
