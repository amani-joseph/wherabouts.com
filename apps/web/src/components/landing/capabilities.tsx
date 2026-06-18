import { Link } from "@tanstack/react-router";
import {
	ArrowUpRight,
	Globe2,
	Locate,
	MapPin,
	Route,
	Shapes,
	Smartphone,
	Webhook,
} from "lucide-react";
import type { ComponentType } from "react";
import {
	type CapabilityIcon,
	capabilities,
	DOCS_HREF,
} from "@/lib/landing-content";

const ICONS: Record<CapabilityIcon, ComponentType<{ className?: string }>> = {
	MapPin,
	Locate,
	Shapes,
	Smartphone,
	Webhook,
	Globe2,
	Route,
};

const Capabilities = () => {
	return (
		<section className="dark bg-background py-16 md:py-24" id="capabilities">
			<div className="mx-auto max-w-7xl px-4 lg:px-8 xl:px-16">
				<div className="flex max-w-2xl flex-col gap-4">
					<h2 className="font-medium text-3xl text-foreground sm:text-4xl md:text-5xl">
						One API for the whole location stack
					</h2>
					<p className="text-base text-muted-foreground sm:text-lg">
						Everything below is live today over plain HTTP and the typed SDK.
					</p>
				</div>
				<div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{capabilities.map((card) => {
						const Icon = ICONS[card.icon];
						return (
							<Link
								className="group flex flex-col gap-3 rounded-2xl border border-border bg-background/60 p-6 transition-colors hover:border-foreground/30"
								key={card.id}
								to={DOCS_HREF}
							>
								<div className="flex items-center justify-between">
									<Icon className="size-6 text-foreground" />
									<ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
								</div>
								<p className="font-medium text-foreground text-lg">
									{card.title}
								</p>
								<p className="text-muted-foreground text-sm">
									{card.description}
								</p>
							</Link>
						);
					})}
				</div>
			</div>
		</section>
	);
};

export default Capabilities;
