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
import { CreditCardIcon, SparklesIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { orpcClient } from "@/lib/orpc";

export const Route = createFileRoute("/_protected/billing")({
	component: RouteComponent,
});

type Account = Awaited<ReturnType<typeof orpcClient.billing.getAccount>>;
type Summary = Awaited<ReturnType<typeof orpcClient.billing.getUsageSummary>>;

function RouteComponent() {
	const [teamId] = useState<string | null>(null);
	const [account, setAccount] = useState<Account | null>(null);
	const [summary, setSummary] = useState<Summary | null>(null);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		const [acc, sum] = await Promise.all([
			orpcClient.billing.getAccount({ teamId }),
			orpcClient.billing.getUsageSummary({ teamId }),
		]);
		setAccount(acc);
		setSummary(sum);
	}, [teamId]);

	useEffect(() => {
		load();
	}, [load]);

	const startCheckout = useCallback(async () => {
		setBusy(true);
		try {
			const { url } = await orpcClient.billing.createCheckoutSession({
				teamId,
			});
			window.location.href = url;
		} finally {
			setBusy(false);
		}
	}, [teamId]);

	const openPortal = useCallback(async () => {
		setBusy(true);
		try {
			const { url } = await orpcClient.billing.createPortalSession({ teamId });
			window.location.href = url;
		} finally {
			setBusy(false);
		}
	}, [teamId]);

	const usedPct = account
		? Math.min(
				100,
				Math.round(
					(account.currentPeriodRequests / account.freeAllotment) * 100
				)
			)
		: 0;
	const estimate = summary ? (summary.estimatedCents / 100).toFixed(2) : "0.00";

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="font-semibold text-2xl tracking-tight">Billing</h1>
				<p className="text-muted-foreground text-sm">
					Pay-as-you-go — 10,000 requests/month free, then $1.00 per 1,000
					requests.
				</p>
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Current usage</CardTitle>
							<CardDescription>
								{account?.hasPaymentMethod
									? "Card on file — usage billed monthly"
									: "Free tier"}
							</CardDescription>
						</div>
						<Badge className="gap-1">
							<SparklesIcon className="size-3" />
							{account?.status ?? "free"}
						</Badge>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">Requests this month</span>
							<span className="font-medium">
								{account?.currentPeriodRequests ?? 0} /{" "}
								{account?.freeAllotment ?? 0} free
							</span>
						</div>
						<Progress className="h-2" value={usedPct} />
					</div>
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">
							Estimated cost this month
						</span>
						<span className="font-medium">${estimate}</span>
					</div>
					{account?.blocked ? (
						<p className="text-destructive text-sm">
							Free tier exhausted. Add a payment method to resume API access.
						</p>
					) : null}
					<div className="flex gap-2">
						{account?.hasPaymentMethod ? (
							<Button disabled={busy} onClick={openPortal} variant="outline">
								<CreditCardIcon className="size-4" /> Manage billing
							</Button>
						) : (
							<Button disabled={busy} onClick={startCheckout}>
								<CreditCardIcon className="size-4" /> Add payment method
							</Button>
						)}
					</div>
				</CardContent>
			</Card>

			{summary && summary.byEndpoint.length > 0 ? (
				<Card>
					<CardHeader>
						<CardTitle>Usage by endpoint</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2">
						{summary.byEndpoint.map((row) => (
							<div
								className="flex items-center justify-between text-sm"
								key={row.endpoint}
							>
								<span className="text-muted-foreground">{row.endpoint}</span>
								<span className="font-medium">{row.count}</span>
							</div>
						))}
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
