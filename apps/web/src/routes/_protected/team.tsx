import { useUser } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { Avatar, AvatarFallback } from "@wherabouts.com/ui/components/avatar";
import { Badge } from "@wherabouts.com/ui/components/badge";
import { Button } from "@wherabouts.com/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@wherabouts.com/ui/components/card";
import {
	MailIcon,
	MoreHorizontalIcon,
	ShieldIcon,
	UserPlusIcon,
} from "lucide-react";

export const Route = createFileRoute("/_protected/team")({
	component: RouteComponent,
});

const teamMembers = [
	{
		name: "You",
		email: "",
		role: "Owner",
		status: "active" as const,
		isSelf: true,
	},
	{
		name: "Alex Rivera",
		email: "alex@example.com",
		role: "Admin",
		status: "active" as const,
	},
	{
		name: "Sam Chen",
		email: "sam@example.com",
		role: "Developer",
		status: "active" as const,
	},
	{
		name: "Jordan Lee",
		email: "jordan@example.com",
		role: "Viewer",
		status: "pending" as const,
	},
];

const roleColors: Record<string, string> = {
	Owner: "default",
	Admin: "default",
	Developer: "secondary",
	Viewer: "outline",
};

function RouteComponent() {
	const { user } = useUser();

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="font-semibold text-2xl tracking-tight">Team</h1>
					<p className="text-muted-foreground text-sm">
						Manage team members and their access permissions
					</p>
				</div>
				<Button>
					<UserPlusIcon className="size-4" />
					Invite Member
				</Button>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<ShieldIcon className="size-5" />
						Members
					</CardTitle>
					<CardDescription>
						{teamMembers.length} members in your workspace
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="divide-y">
						{teamMembers.map((member) => {
							const displayName = member.isSelf
								? (user?.fullName ?? "You")
								: member.name;
							const displayEmail = member.isSelf
								? (user?.primaryEmailAddress?.emailAddress ?? "")
								: member.email;
							const initials = displayName
								.split(" ")
								.map((n) => n[0])
								.join("")
								.toUpperCase()
								.slice(0, 2);

							return (
								<div
									className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
									key={member.name}
								>
									<div className="flex items-center gap-3">
										<Avatar className="size-9">
											<AvatarFallback className="text-xs">
												{initials}
											</AvatarFallback>
										</Avatar>
										<div>
											<p className="font-medium text-sm">
												{displayName}
												{member.isSelf && (
													<span className="ml-1.5 text-muted-foreground text-xs">
														(you)
													</span>
												)}
											</p>
											<p className="text-muted-foreground text-xs">
												{displayEmail}
											</p>
										</div>
									</div>
									<div className="flex items-center gap-3">
										{member.status === "pending" && (
											<Badge className="text-amber-600" variant="outline">
												Pending
											</Badge>
										)}
										<Badge
											variant={
												roleColors[member.role] as
													| "default"
													| "secondary"
													| "outline"
											}
										>
											{member.role}
										</Badge>
										{!member.isSelf && (
											<Button className="size-8" size="icon" variant="ghost">
												<MoreHorizontalIcon className="size-4" />
											</Button>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<MailIcon className="size-5" />
						Pending Invitations
					</CardTitle>
					<CardDescription>
						Invitations that haven't been accepted yet
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-between rounded-md border px-4 py-3">
						<div>
							<p className="font-medium text-sm">jordan@example.com</p>
							<p className="text-muted-foreground text-xs">
								Invited 2 days ago as Viewer
							</p>
						</div>
						<div className="flex gap-2">
							<Button size="sm" variant="outline">
								Resend
							</Button>
							<Button size="sm" variant="ghost">
								Revoke
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
