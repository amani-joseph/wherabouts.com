import { SignUp } from "@clerk/tanstack-react-start";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/sign-up/$")({
	component: SignUpPage,
});

function SignUpPage() {
	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-4">
			<SignUp forceRedirectUrl="/dashboard" signInUrl="/sign-in/$" />
			<p className="text-center text-muted-foreground text-sm">
				Already have an account?{" "}
				<Link
					className="font-medium text-foreground underline-offset-4 hover:underline"
					to="/sign-in/$"
				>
					Sign in
				</Link>
			</p>
		</div>
	);
}
