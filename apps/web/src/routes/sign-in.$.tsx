import { SignIn } from "@clerk/tanstack-react-start";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/sign-in/$")({
	component: SignInPage,
});

function SignInPage() {
	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-4">
			<SignIn forceRedirectUrl="/dashboard" signUpUrl="/sign-up/$" />
			<p className="text-center text-muted-foreground text-sm">
				No account yet?{" "}
				<Link
					className="font-medium text-foreground underline-offset-4 hover:underline"
					to="/sign-up/$"
				>
					Sign up
				</Link>
			</p>
		</div>
	);
}
