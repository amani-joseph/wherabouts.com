import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@wherabouts.com/ui/components/badge";
import { buttonVariants } from "@wherabouts.com/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@wherabouts.com/ui/components/card";
import { cn } from "@wherabouts.com/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import Footer from "@/components/shadcn-space/blocks/footer-02/footer";

export const Route = createFileRoute("/pricing")({
	component: PricingPage,
});

// DRAFT — public pricing page generated from .planning/FEATURE-AUDIT.md.
// Tiers mirror the (currently hardcoded) plans in routes/_protected/billing.tsx.
// Annual prices are ILLUSTRATIVE (2 months free); the report has no annual data.
// When the billing backend lands (FEATURE-AUDIT Phase 4) both this page and the
// billing dashboard should read tiers from one shared source instead of these
// duplicated literals, and the CTAs should drive real checkout.

type BillingPeriod = "monthly" | "annual";

type Price = {
	amount: string;
	suffix: string;
	note?: string;
};

type Tier = {
	name: string;
	tagline: string;
	features: readonly string[];
	cta: { label: string; to: string };
	prices: Record<BillingPeriod, Price>;
	featured?: boolean;
};

const TIERS: readonly Tier[] = [
	{
		name: "Free",
		tagline: "For side projects and trying out the API.",
		features: [
			"1,000 requests/month",
			"1 API key",
			"Community support",
			"Basic analytics",
		],
		cta: { label: "Start for free", to: "/sign-up" },
		prices: {
			monthly: { amount: "$0", suffix: "/mo" },
			annual: { amount: "$0", suffix: "/mo" },
		},
	},
	{
		name: "Pro",
		tagline: "For production apps that need room to grow.",
		features: [
			"100,000 requests/month",
			"10 API keys",
			"Priority support",
			"Advanced analytics",
			"Webhooks",
			"Team members (5)",
		],
		cta: { label: "Start Pro trial", to: "/sign-up" },
		featured: true,
		prices: {
			monthly: { amount: "$49", suffix: "/mo" },
			annual: { amount: "$41", suffix: "/mo", note: "billed annually ($490)" },
		},
	},
	{
		name: "Enterprise",
		tagline: "For teams with scale, compliance, and SLA needs.",
		features: [
			"Unlimited requests",
			"Unlimited API keys",
			"Dedicated support",
			"Custom SLA",
			"On-premise option",
			"Unlimited team members",
		],
		cta: { label: "Contact sales", to: "/sign-up" },
		prices: {
			monthly: { amount: "Custom", suffix: "" },
			annual: { amount: "Custom", suffix: "" },
		},
	},
] as const;

function PeriodToggle({
	value,
	onChange,
}: {
	value: BillingPeriod;
	onChange: (next: BillingPeriod) => void;
}) {
	const optionClass = (active: boolean) =>
		cn(
			"flex items-center gap-2 rounded-full px-4 py-1.5 font-medium text-sm transition-colors",
			active
				? "bg-primary text-primary-foreground"
				: "text-muted-foreground hover:text-foreground"
		);

	return (
		<div
			aria-label="Billing period"
			className="mt-8 inline-flex items-center gap-1 rounded-full border border-border p-1"
			role="group"
		>
			<button
				aria-pressed={value === "monthly"}
				className={optionClass(value === "monthly")}
				onClick={() => onChange("monthly")}
				type="button"
			>
				Monthly
			</button>
			<button
				aria-pressed={value === "annual"}
				className={optionClass(value === "annual")}
				onClick={() => onChange("annual")}
				type="button"
			>
				Annual
				<Badge variant={value === "annual" ? "secondary" : "default"}>
					Save 17%
				</Badge>
			</button>
		</div>
	);
}

function PricingPage() {
	const [period, setPeriod] = useState<BillingPeriod>("monthly");

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<main className="mx-auto w-full max-w-6xl flex-1 px-6 py-24">
				<header className="mx-auto flex max-w-2xl flex-col items-center text-center">
					<Badge variant="secondary">Pricing</Badge>
					<h1 className="mt-4 font-bold text-4xl tracking-tight sm:text-5xl">
						Geocoding that scales with you
					</h1>
					<p className="mt-4 text-balance text-muted-foreground">
						Australian address autocomplete, reverse geocoding, and geofencing
						on G-NAF data. Start free, upgrade when you ship.
					</p>
					<PeriodToggle onChange={setPeriod} value={period} />
				</header>

				<section
					aria-label="Pricing plans"
					className="mt-16 grid gap-6 lg:grid-cols-3"
				>
					{TIERS.map((tier) => {
						const price = tier.prices[period];
						return (
							<Card
								className={cn(
									"flex flex-col",
									tier.featured &&
										"border-primary shadow-lg ring-1 ring-primary"
								)}
								key={tier.name}
							>
								<CardHeader>
									<div className="flex items-center justify-between gap-2">
										<CardTitle className="text-lg">{tier.name}</CardTitle>
										{tier.featured ? <Badge>Most popular</Badge> : null}
									</div>
									<CardDescription>{tier.tagline}</CardDescription>
									<div className="mt-4 flex items-baseline gap-1">
										<span className="font-bold text-4xl tracking-tight">
											{price.amount}
										</span>
										{price.suffix ? (
											<span className="text-muted-foreground text-sm">
												{price.suffix}
											</span>
										) : null}
									</div>
									<p className="h-4 text-muted-foreground text-xs">
										{price.note ?? ""}
									</p>
								</CardHeader>

								<CardContent className="flex flex-1 flex-col">
									<ul className="flex flex-1 flex-col gap-3 text-sm">
										{tier.features.map((feature) => (
											<li className="flex items-start gap-2" key={feature}>
												<CheckIcon
													aria-hidden="true"
													className="mt-0.5 size-4 shrink-0 text-primary"
												/>
												<span>{feature}</span>
											</li>
										))}
									</ul>

									<Link
										className={cn(
											buttonVariants({
												variant: tier.featured ? "default" : "outline",
												size: "lg",
											}),
											"mt-8 w-full"
										)}
										to={tier.cta.to}
									>
										{tier.cta.label}
									</Link>
								</CardContent>
							</Card>
						);
					})}
				</section>

				<p className="mt-12 text-center text-muted-foreground text-sm">
					All plans include access to the full{" "}
					<Link className="underline underline-offset-4" to="/docs">
						API documentation
					</Link>
					. Need something in between?{" "}
					<Link className="underline underline-offset-4" to="/sign-up">
						Get in touch
					</Link>
					.
				</p>
			</main>

			<Footer />
		</div>
	);
}
