"use client";
import { useState } from "react";
import {
	endpointById,
	exampleParamsForEndpoint,
	featuredEndpointIds,
	featuredResponses,
} from "@/lib/landing-content";
import { buildSdkSnippet } from "@/lib/sdk-snippet";
import { cn } from "@/lib/utils";

const ApiInAction = () => {
	const [activeId, setActiveId] = useState(featuredEndpointIds[0]);
	const endpoint = endpointById(activeId);
	const snippet = buildSdkSnippet(
		activeId,
		exampleParamsForEndpoint(activeId),
		undefined
	);
	const response = featuredResponses[activeId];

	return (
		<section className="dark bg-background py-16 md:py-24" id="api">
			<div className="mx-auto max-w-7xl px-4 lg:px-8 xl:px-16">
				<div className="flex max-w-2xl flex-col gap-4">
					<h2 className="font-medium text-3xl text-foreground sm:text-4xl md:text-5xl">
						From API key to first result in minutes
					</h2>
					<p className="text-base text-muted-foreground sm:text-lg">
						Install the SDK or call the same endpoints over plain HTTP. Pick an
						endpoint to see a real request.
					</p>
				</div>

				<div className="mt-8 flex flex-wrap gap-2">
					{featuredEndpointIds.map((id) => (
						<button
							className={cn(
								"cursor-pointer rounded-full border px-4 py-1.5 text-sm transition-colors",
								id === activeId
									? "border-foreground/40 bg-foreground/10 text-foreground"
									: "border-border text-muted-foreground hover:text-foreground"
							)}
							key={id}
							onClick={() => setActiveId(id)}
							type="button"
						>
							{endpointById(id).summary}
						</button>
					))}
				</div>

				<div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div className="overflow-hidden rounded-2xl border border-border bg-background/70">
						<div className="flex items-center gap-2 border-border border-b px-4 py-2">
							<span className="rounded-full border border-border px-2 py-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
								{endpoint.method} {endpoint.path}
							</span>
						</div>
						<pre className="overflow-x-auto p-4 text-foreground text-sm">
							<code>{snippet}</code>
						</pre>
					</div>
					<div className="overflow-hidden rounded-2xl border border-border bg-background/70">
						<div className="flex items-center gap-2 border-border border-b px-4 py-2">
							<span className="rounded-full border border-border px-2 py-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
								Example response
							</span>
						</div>
						<pre className="overflow-x-auto p-4 text-muted-foreground text-sm">
							<code>
								{response ?? "// See the docs for the full response shape."}
							</code>
						</pre>
					</div>
				</div>
			</div>
		</section>
	);
};

export default ApiInAction;
