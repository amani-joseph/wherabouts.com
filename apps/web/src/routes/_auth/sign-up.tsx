import { createFileRoute, redirect } from "@tanstack/react-router";
import RegisterForm from "@/components/shadcn-space/blocks/register-03/register";

export const Route = createFileRoute("/_auth/sign-up")({
	beforeLoad: ({ context }) => {
		if (context.isAuthenticated) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	return <RegisterForm />;
}
