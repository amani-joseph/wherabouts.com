import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@wherabouts.com/ui/components/badge";
import { Button } from "@wherabouts.com/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@wherabouts.com/ui/components/card";
import { Progress } from "@wherabouts.com/ui/components/progress";
import {
	CheckIcon,
	CreditCardIcon,
	DownloadIcon,
	SparklesIcon,
} from "lucide-react";

export const Route = createFileRoute("/_protected/billing")({
	component: RouteComponent,
});

const plans = [
	{
		name: "Free",
		price: "$0",
		period: "/month",
		features: [
			"1,000 requests/month",
			"1 API key",
			"Community support",
			"Basic analytics",
		],
		current: false,
	},
	{
		name: "Pro",
		price: "$49",
		period: "/month",
		features: [
			"100,000 requests/month",
			"10 API keys",
			"Priority support",
			"Advanced analytics",
			"Webhooks",
			"Team members (5)",
		],
		current: true,
	},
	{
		name: "Enterprise",
		price: "Custom",
		period: "",
		features: [
			"Unlimited requests",
			"Unlimited API keys",
			"Dedicated support",
			"Custom SLA",
			"On-premise option",
			"Unlimited team members",
		],
		current: false,
	},
];

const invoices = [
	{ date: "Apr 1, 2026", amount: "$49.00", status: "Paid", id: "INV-2026-04" },
	{ date: "Mar 1, 2026", amount: "$49.00", status: "Paid", id: "INV-2026-03" },
	{ date: "Feb 1, 2026", amount: "$49.00", status: "Paid", id: "INV-2026-02" },
	{ date: "Jan 1, 2026", amount: "$49.00", status: "Paid", id: "INV-2026-01" },
];

function RouteComponent() {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="font-semibold text-2xl tracking-tight">Billing</h1>
				<p className="text-muted-foreground text-sm">
					Manage your subscription, usage, and payment methods
				</p>
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Current Plan</CardTitle>
							<CardDescription>
								You're on the <strong>Pro</strong> plan
							</CardDescription>
						</div>
						<Badge className="gap-1">
							<SparklesIcon className="size-3" />
							Pro
						</Badge>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">
								API Requests This Month
							</span>
							<span className="font-medium">68,402 / 100,000</span>
						</div>
						<Progress className="h-2" value={68} />
					</div>
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">Next billing date</span>
						<span className="font-medium">May 1, 2026</span>
					</div>
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">Payment method</span>
						<span className="flex items-center gap-1.5 font-medium">
							<CreditCardIcon className="size-4" />
							Visa ending in 4242
						</span>
					</div>
				</CardContent>
			</Card>

			<div>
				<h2 className="mb-4 font-semibold text-lg">Plans</h2>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
					{plans.map((plan) => (
						<Card
							className={plan.current ? "border-primary" : ""}
							key={plan.name}
						>
							<CardHeader>
								<CardTitle className="flex items-center justify-between">
									{plan.name}
									{plan.current && <Badge variant="secondary">Current</Badge>}
								</CardTitle>
								<div className="flex items-baseline gap-1">
									<span className="font-bold text-3xl">{plan.price}</span>
									<span className="text-muted-foreground text-sm">
										{plan.period}
									</span>
								</div>
							</CardHeader>
							<CardContent className="space-y-4">
								<ul className="space-y-2">
									{plan.features.map((feature) => (
										<li
											className="flex items-center gap-2 text-sm"
											key={feature}
										>
											<CheckIcon className="size-4 shrink-0 text-green-500" />
											{feature}
										</li>
									))}
								</ul>
								<Button
									className="w-full"
									disabled={plan.current}
									variant={plan.current ? "outline" : "default"}
								>
									{plan.current
										? "Current Plan"
										: plan.name === "Enterprise"
											? "Contact Sales"
											: "Upgrade"}
								</Button>
							</CardContent>
						</Card>
					))}
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Invoice History</CardTitle>
					<CardDescription>Download past invoices and receipts</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="divide-y">
						{invoices.map((invoice) => (
							<div
								className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
								key={invoice.id}
							>
								<div>
									<p className="font-medium text-sm">{invoice.id}</p>
									<p className="text-muted-foreground text-xs">
										{invoice.date}
									</p>
								</div>
								<div className="flex items-center gap-3">
									<span className="font-medium text-sm">{invoice.amount}</span>
									<Badge variant="secondary">{invoice.status}</Badge>
									<Button className="size-8" size="icon" variant="ghost">
										<DownloadIcon className="size-4" />
									</Button>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
