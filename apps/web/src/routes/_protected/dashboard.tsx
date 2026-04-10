import { UserButton, useUser } from "@clerk/tanstack-react-start";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "@wherabouts.com/backend/convex/_generated/api";
import {
	Authenticated,
	AuthLoading,
	Unauthenticated,
	useQuery,
} from "convex/react";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";

export const Route = createFileRoute("/_protected/dashboard")({
	component: RouteComponent,
});

function RouteComponent() {
	const privateData = useQuery(api.privateData.get);
	const user = useUser();

	return (
		<>
			<Authenticated>
				<div className="flex flex-col gap-6">
					<div className="flex flex-wrap items-center justify-between gap-4">
						<div>
							<h1 className="font-semibold text-2xl tracking-tight">
								Dashboard
							</h1>
							<p className="text-muted-foreground text-sm">
								Welcome
								{user.user?.fullName ? `, ${user.user.fullName}` : ""}
							</p>
							{privateData !== undefined && privateData !== null ? (
								<p className="mt-1 text-muted-foreground text-sm">
									{privateData.message}
								</p>
							) : null}
						</div>
						<UserButton />
					</div>
					<DashboardSkeleton />
				</div>
			</Authenticated>
			<Unauthenticated>
				<div className="flex flex-col items-center gap-3 py-8 text-center">
					<p className="text-muted-foreground text-sm">
						Sign in to view your dashboard.
					</p>
					<Link
						className="font-medium text-foreground text-sm underline-offset-4 hover:underline"
						to="/sign-in/$"
					>
						Go to sign in
					</Link>
				</div>
			</Unauthenticated>
			<AuthLoading>
				<DashboardSkeleton />
			</AuthLoading>
		</>
	);
}
