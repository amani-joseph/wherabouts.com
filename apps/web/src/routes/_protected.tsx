import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_protected")({
	beforeLoad: ({ context }) => {
		// During SSR the web Worker cannot access the auth cookie (it lives on
		// the server Worker's domain). Skip the redirect so the page shell
		// renders; the client-side beforeLoad in __root.tsx will verify the
		// session directly with the auth server and update isAuthenticated.
		if (typeof window === "undefined") {
			return;
		}

		if (!context.isAuthenticated) {
			throw redirect({ to: "/sign-in" });
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<AppShell>
			<Outlet />
		</AppShell>
	);
}
