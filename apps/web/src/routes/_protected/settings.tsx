import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@wherabouts.com/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@wherabouts.com/ui/components/card";
import { Input } from "@wherabouts.com/ui/components/input";
import { Label } from "@wherabouts.com/ui/components/label";
import { Separator } from "@wherabouts.com/ui/components/separator";
import { Switch } from "@wherabouts.com/ui/components/switch";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@wherabouts.com/ui/components/tabs";
import {
	BellIcon,
	GlobeIcon,
	PaletteIcon,
	ShieldIcon,
	UserIcon,
} from "lucide-react";
import { useSession } from "@/lib/auth-client";

export const Route = createFileRoute("/_protected/settings")({
	component: RouteComponent,
});

function RouteComponent() {
	const { data: session } = useSession();
	const user = session?.user;

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
				<p className="text-muted-foreground text-sm">
					Manage your account and workspace preferences
				</p>
			</div>

			<Tabs className="space-y-4" defaultValue="profile">
				<TabsList>
					<TabsTrigger value="profile">
						<UserIcon className="mr-1.5 size-4" />
						Profile
					</TabsTrigger>
					<TabsTrigger value="notifications">
						<BellIcon className="mr-1.5 size-4" />
						Notifications
					</TabsTrigger>
					<TabsTrigger value="appearance">
						<PaletteIcon className="mr-1.5 size-4" />
						Appearance
					</TabsTrigger>
					<TabsTrigger value="security">
						<ShieldIcon className="mr-1.5 size-4" />
						Security
					</TabsTrigger>
				</TabsList>

				<TabsContent value="profile">
					<Card>
						<CardHeader>
							<CardTitle>Profile Information</CardTitle>
							<CardDescription>
								Update your personal details and workspace name
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="firstName">First Name</Label>
									<Input
										defaultValue={user?.name?.split(" ")[0] ?? ""}
										id="firstName"
										placeholder="First name"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="lastName">Last Name</Label>
									<Input
										defaultValue={
											user?.name?.split(" ").slice(1).join(" ") ?? ""
										}
										id="lastName"
										placeholder="Last name"
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="email">Email</Label>
								<Input
									defaultValue={user?.email ?? ""}
									disabled
									id="email"
									type="email"
								/>
								<p className="text-muted-foreground text-xs">
									Email is managed through your authentication provider
								</p>
							</div>
							<div className="space-y-2">
								<Label htmlFor="workspace">Workspace Name</Label>
								<Input
									defaultValue="My Workspace"
									id="workspace"
									placeholder="Workspace name"
								/>
							</div>
							<Separator />
							<div className="space-y-2">
								<Label htmlFor="timezone">
									<GlobeIcon className="mr-1.5 inline size-4" />
									Default Region
								</Label>
								<Input
									defaultValue="Auto-detect"
									id="timezone"
									placeholder="Region preference"
								/>
								<p className="text-muted-foreground text-xs">
									Used as the default region bias for geocoding requests
								</p>
							</div>
							<div className="flex justify-end">
								<Button>Save Changes</Button>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="notifications">
					<Card>
						<CardHeader>
							<CardTitle>Notification Preferences</CardTitle>
							<CardDescription>
								Choose what alerts and updates you receive
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							{[
								{
									title: "Usage Alerts",
									description: "Get notified when approaching your plan limits",
									defaultChecked: true,
								},
								{
									title: "Error Notifications",
									description:
										"Receive alerts for elevated error rates on your endpoints",
									defaultChecked: true,
								},
								{
									title: "Weekly Summary",
									description:
										"Receive a weekly email digest of your API usage",
									defaultChecked: false,
								},
								{
									title: "Product Updates",
									description:
										"Stay informed about new features and improvements",
									defaultChecked: true,
								},
								{
									title: "Billing Reminders",
									description: "Get notified before your subscription renews",
									defaultChecked: true,
								},
							].map((pref) => (
								<div
									className="flex items-center justify-between"
									key={pref.title}
								>
									<div>
										<p className="font-medium text-sm">{pref.title}</p>
										<p className="text-muted-foreground text-xs">
											{pref.description}
										</p>
									</div>
									<Switch defaultChecked={pref.defaultChecked} />
								</div>
							))}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="appearance">
					<Card>
						<CardHeader>
							<CardTitle>Appearance</CardTitle>
							<CardDescription>
								Customize how Wherabouts looks for you
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="space-y-3">
								<Label>Theme</Label>
								<div className="flex gap-3">
									{["Light", "Dark", "System"].map((theme) => (
										<Button
											key={theme}
											size="sm"
											variant={theme === "System" ? "default" : "outline"}
										>
											{theme}
										</Button>
									))}
								</div>
							</div>
							<Separator />
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium text-sm">Compact Mode</p>
									<p className="text-muted-foreground text-xs">
										Reduce spacing in the sidebar and navigation
									</p>
								</div>
								<Switch />
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="security">
					<Card>
						<CardHeader>
							<CardTitle>Security</CardTitle>
							<CardDescription>
								Manage your security settings and sessions
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium text-sm">
										Two-Factor Authentication
									</p>
									<p className="text-muted-foreground text-xs">
										Add an extra layer of security to your account
									</p>
								</div>
								<Button size="sm" variant="outline">
									Enable
								</Button>
							</div>
							<Separator />
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium text-sm">Active Sessions</p>
									<p className="text-muted-foreground text-xs">
										Manage devices where you're signed in
									</p>
								</div>
								<Button size="sm" variant="outline">
									View Sessions
								</Button>
							</div>
							<Separator />
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium text-destructive text-sm">
										Delete Account
									</p>
									<p className="text-muted-foreground text-xs">
										Permanently delete your account and all data
									</p>
								</div>
								<Button size="sm" variant="destructive">
									Delete
								</Button>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
